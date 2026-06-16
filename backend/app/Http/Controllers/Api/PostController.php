<?php

namespace App\Http\Controllers\Api;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\ScheduledPost;
use App\Services\ActivityLogger;
use App\Services\Billing\UsageGuard;
use App\Services\Posts\PostComposer;
use App\Services\Scheduling\PostScheduler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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

        $result = $this->composer->create($workspace, $request->user()->id, $request->validated());
        $post = $result['post'];
        $this->activity->log($workspace->id, 'post.created', $post, 'Draft created');

        return response()->json([
            'data' => new PostResource($post),
            'validation' => $this->composer->validate($post),
            'skipped_targets' => collect($result['skipped'])->map(function ($row) {
                $account = \App\Models\SocialAccount::find($row['social_account_id'] ?? null);

                return array_merge($row, [
                    'platform' => $row['platform'] ?? $account?->platform,
                    'account_name' => $account?->name,
                ]);
            })->values(),
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

        DB::transaction(function () use ($post) {
            $variantIds = $post->variants()->pluck('id');
            ScheduledPost::whereIn('post_variant_id', $variantIds)->delete();
            $post->variants()->delete();
            $post->delete();
        });

        return response()->json(['message' => 'Post deleted.']);
    }

    public function updateStatus(Request $request, Post $post): JsonResponse
    {
        $this->authorize('update', $post);

        $data = $request->validate([
            'status' => ['required', Rule::enum(PostStatus::class)],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $post->fill([
            'status' => $data['status'],
            'scheduled_at' => array_key_exists('scheduled_at', $data) ? $data['scheduled_at'] : $post->scheduled_at,
        ])->save();

        $this->activity->log($post->workspace_id, 'post.status_updated', $post, "Post status changed to {$post->status->value}");

        return response()->json([
            'data' => new PostResource($post->fresh()->load(['variants.socialAccount', 'media', 'author'])),
        ]);
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
        $post = $post->fresh('variants');
        $failed = $post->variants->where('status', PostStatus::Failed);

        if ($failed->isNotEmpty()) {
            return response()->json([
                'message' => $failed->first()->error_message ?? 'One or more platforms failed to publish.',
                'data' => new PostResource($post),
            ], 422);
        }

        $this->activity->log($post->workspace_id, 'post.publish_now', $post, 'Publishing now');

        return response()->json(['data' => new PostResource($post)]);
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

        if ($errors = $this->composer->validate($post)) {
            return response()->json(['message' => 'Validation failed', 'validation' => $errors], 422);
        }

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

        $approved = $data['decision'] === 'approved';
        $post->update(['status' => $approved ? PostStatus::Approved : PostStatus::Draft]);

        if ($approved) {
            $action = $post->options['approval_action'] ?? null;
            if ($action === 'schedule' && $post->scheduled_at?->isFuture()) {
                $this->scheduler->schedule($post->load('variants'), $post->scheduled_at);
            } elseif ($action === 'publish') {
                $this->scheduler->publishNow($post->load('variants'));
            }
        }

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
