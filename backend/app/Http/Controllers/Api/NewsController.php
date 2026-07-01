<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NewsPostResource;
use App\Models\NewsPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NewsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $limit = min(24, max(1, (int) $request->query('limit', 12)));

        $posts = NewsPost::query()
            ->where('status', 'published')
            ->where(fn ($query) => $query->whereNull('published_at')->orWhere('published_at', '<=', now()))
            ->latest('published_at')
            ->latest()
            ->limit($limit)
            ->get();

        return response()->json(['data' => NewsPostResource::collection($posts)]);
    }

    public function show(NewsPost $newsPost): JsonResponse
    {
        abort_unless(
            $newsPost->status === 'published' && (! $newsPost->published_at || $newsPost->published_at->lte(now())),
            404,
        );

        return response()->json(['data' => new NewsPostResource($newsPost)]);
    }
}
