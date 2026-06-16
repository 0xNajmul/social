<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminPostController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $posts = Post::query()
            ->with(['workspace', 'author', 'variants.socialAccount'])
            ->when($request->status, fn ($query, $status) => $query->where('status', $status))
            ->when($request->workspace, fn ($query, $workspace) => $query->whereHas('workspace', fn ($workspaceQuery) => $workspaceQuery->where('name', 'like', "%{$workspace}%")->orWhere('slug', 'like', "%{$workspace}%")))
            ->when($request->author, fn ($query, $author) => $query->whereHas('author', fn ($authorQuery) => $authorQuery->where('name', 'like', "%{$author}%")->orWhere('email', 'like', "%{$author}%")))
            ->when($request->search, fn ($query, $search) => $query->where(fn ($searchQuery) => $searchQuery->where('title', 'like', "%{$search}%")->orWhere('content', 'like', "%{$search}%")))
            ->when($request->from, fn ($query, $date) => $query->where(function ($dateQuery) use ($date) {
                $dateQuery->where('scheduled_at', '>=', $date)->orWhere('published_at', '>=', $date);
            }))
            ->when($request->to, fn ($query, $date) => $query->where(function ($dateQuery) use ($date) {
                $dateQuery->where('scheduled_at', '<=', $date)->orWhere('published_at', '<=', $date);
            }))
            ->latest()
            ->paginate($request->integer('per_page', 100));

        return PostResource::collection($posts)->response();
    }

    public function show(Post $post): JsonResponse
    {
        return response()->json([
            'data' => new PostResource($this->loadPost($post)),
        ]);
    }

    public function update(Request $request, Post $post): JsonResponse
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'content' => ['nullable', 'string', 'max:50000'],
            'type' => ['nullable', 'string', 'max:50'],
            'status' => ['required', Rule::enum(PostStatus::class)],
            'link_url' => ['nullable', 'url', 'max:2048'],
            'hashtags' => ['nullable', 'array'],
            'hashtags.*' => ['string', 'max:80'],
            'mentions' => ['nullable', 'array'],
            'mentions.*' => ['string', 'max:80'],
            'scheduled_at' => ['nullable', 'date'],
            'published_at' => ['nullable', 'date'],
            'requires_approval' => ['boolean'],
        ]);

        $post->update($data);

        return response()->json([
            'data' => new PostResource($this->loadPost($post->fresh())),
        ]);
    }

    public function destroy(Post $post): JsonResponse
    {
        $post->delete();

        return response()->json(['message' => 'Post deleted.']);
    }

    protected function loadPost(Post $post): Post
    {
        return $post->load(['workspace', 'author', 'variants.socialAccount', 'media']);
    }
}
