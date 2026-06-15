<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
