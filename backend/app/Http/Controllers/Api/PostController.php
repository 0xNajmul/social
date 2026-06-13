<?php

namespace App\Http\Controllers\Api;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Services\ActivityLogger;
use App\Services\Billing\UsageGuard;
use App\Services\Posts\PostComposer;
use App\Services\Scheduling\PostScheduler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function __construct(
        protected PostComposer $composer,
        protected PostScheduler $scheduler,
        protected UsageGuard $usage,
        protected ActivityLogger $activity,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $posts = workspace()->posts()
            ->with(['variants.socialAccount', 'media', 'author'])
            ->withCount('comments')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->platform, fn ($q, $p) => $q->whereHas('variants', fn ($v) => $v->where('platform', $p)))
            ->when($request->from, fn ($q, $d) => $q->where('scheduled_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->where('scheduled_at', '<=', $d))
            ->when($request->search, fn ($q, $s) => $q->where('content', 'like', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return PostResource::collection($posts)->response();
    }

    public function store(StorePostRequest $request): JsonResponse
    {
        $workspace = workspace();
        $this->usage->ensure($workspace, 'monthly_posts');

        $post = $this->composer->create($workspace, $request->user()->id, $request->validated());
        $this->activity->log($workspace->id, 'post.created', $post, 'Draft created');

        return response()->json([
            'data' => new PostResource($post),
            'validation' => $this->composer->validate($post),
        ], 201);
    }

    public function show(Post $post): JsonResponse
    {
        $this->authorize('view', $post);

        return response()->json([
            'data' => new PostResource(
                $post->load(['variants.socialAccount', 'media', 'author', 'comments.user', 'approval'])
            ),
        ]);
    }

    public function update(StorePostRequest $request, Post $post): JsonResponse
    {
        $this->authorize('update', $post);
        $post = $this->composer->update($post, $request->validated());

        return response()->json([
            'data' => new PostResource($post),
            'validation' => $this->composer->validate($post),
        ]);
    }

    public function destroy(Post $post): JsonResponse
    {
        $this->authorize('delete', $post);
        $post->delete();

        return response()->json(['message' => 'Post deleted.']);
    }

    /**
     * Schedule a post for its target time (or immediately enqueue at now).
     */
    public function schedule(Request $request, Post $post): JsonResponse
    {
        $this->authorize('publish', $post);

        $data = $request->validate(['scheduled_at' => ['required', 'date', 'after_or_equal:now']]);

        if ($errors = $this->composer->validate($post)) {
            return response()->json(['message' => 'Validation failed', 'validation' => $errors], 422);
        }

        $this->usage->ensure(workspace(), 'scheduled_posts');
        $this->scheduler->schedule($post, \Illuminate\Support\Carbon::parse($data['scheduled_at']));
        $this->activity->log($post->workspace_id, 'post.scheduled', $post, "Scheduled for {$data['scheduled_at']}");

        return response()->json(['data' => new PostResource($post->fresh('variants'))]);
    }

    /**
     * Publish immediately.
     */
    public function publishNow(Post $post): JsonResponse
    {
        $this->authorize('publish', $post);

        if ($errors = $this->composer->validate($post)) {
            return response()->json(['message' => 'Validation failed', 'validation' => $errors], 422);
        }

        $this->scheduler->publishNow($post);
        $this->activity->log($post->workspace_id, 'post.publish_now', $post, 'Publishing now');

        return response()->json(['data' => new PostResource($post->fresh('variants'))]);
    }

    public function cancel(Post $post): JsonResponse
    {
        $this->authorize('publish', $post);
        $this->scheduler->cancel($post->load('variants'));

        return response()->json(['data' => new PostResource($post->fresh('variants'))]);
    }

    public function duplicate(Post $post): JsonResponse
    {
        $this->authorize('view', $post);

        $copy = $post->replicate(['status', 'published_at']);
        $copy->status = PostStatus::Draft;
        $copy->scheduled_at = null;
        $copy->published_at = null;
        $copy->save();

        foreach ($post->variants as $variant) {
            $copy->variants()->create($variant->only(['social_account_id', 'platform', 'content', 'hashtags', 'options']) + [
                'status' => PostStatus::Draft,
            ]);
        }
        $copy->media()->sync($post->media->pluck('id'));

        return response()->json(['data' => new PostResource($copy->load('variants.socialAccount'))], 201);
    }

    /**
     * Submit a post for approval.
     */
    public function requestApproval(Request $request, Post $post): JsonResponse
    {
        $this->authorize('update', $post);

        $post->update(['status' => PostStatus::PendingApproval, 'requires_approval' => true]);
        $post->approval()->create([
            'requested_by' => $request->user()->id,
            'status' => 'pending',
        ]);

        return response()->json(['data' => new PostResource($post->fresh('approval'))]);
    }

    /**
     * Approve or reject a pending post.
     */
    public function review(Request $request, Post $post): JsonResponse
    {
        $this->authorize('approve', $post);

        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $post->approval()->update([
            'reviewed_by' => $request->user()->id,
            'status' => $data['decision'],
            'note' => $data['note'] ?? null,
            'reviewed_at' => now(),
        ]);

        $post->update([
            'status' => $data['decision'] === 'approved' ? PostStatus::Approved : PostStatus::Draft,
        ]);

        $this->activity->log($post->workspace_id, "post.{$data['decision']}", $post, $data['note'] ?? '');

        return response()->json(['data' => new PostResource($post->fresh('approval'))]);
    }

    public function comment(Request $request, Post $post): JsonResponse
    {
        $this->authorize('view', $post);
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);

        $comment = $post->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        return response()->json(['data' => $comment->load('user')], 201);
    }
}
