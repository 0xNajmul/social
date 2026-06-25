<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\RssFeedResource;
use App\Models\RssFeed;
use App\Models\Workspace;
use App\Services\Feeds\RssFeedIngestor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class AdminFeedController extends Controller
{
    public function __construct(protected RssFeedIngestor $ingestor) {}

    public function index(Request $request): JsonResponse
    {
        $feeds = RssFeed::query()
            ->with('workspace:id,name,slug')
            ->withCount('items')
            ->withMax('items', 'published_at')
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', "%{$search}%")
                ->orWhere('url', 'like', "%{$search}%")
                ->orWhereHas('workspace', fn ($workspace) => $workspace->where('name', 'like', "%{$search}%"))))
            ->when($request->workspace_id, fn ($query, $workspaceId) => $query->where('workspace_id', $workspaceId))
            ->when($request->country, fn ($query, $country) => $query->where('country', $country))
            ->when($request->category, fn ($query, $category) => $query->where('category', $category))
            ->when($request->status, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return RssFeedResource::collection($feeds)->response();
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedFeed($request);
        Workspace::findOrFail($data['workspace_id']);
        $feed = RssFeed::create($data);

        if ($feed->status === 'active') {
            try {
                $this->ingestor->ingest($feed);
            } catch (RuntimeException $e) {
                $feed->delete();

                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        return response()->json([
            'data' => new RssFeedResource($feed->fresh()->load('workspace:id,name,slug')->loadCount('items')->loadMax('items', 'published_at')),
        ], 201);
    }

    public function update(Request $request, RssFeed $rssFeed): JsonResponse
    {
        $data = $this->validatedFeed($request, partial: true);
        if (isset($data['workspace_id'])) {
            Workspace::findOrFail($data['workspace_id']);
        }

        $rssFeed->update($data);

        if (($data['url'] ?? null) || ($rssFeed->status === 'active' && $request->boolean('refresh'))) {
            try {
                $this->ingestor->ingest($rssFeed);
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        return response()->json([
            'data' => new RssFeedResource($rssFeed->fresh()->load('workspace:id,name,slug')->loadCount('items')->loadMax('items', 'published_at')),
        ]);
    }

    public function destroy(RssFeed $rssFeed): JsonResponse
    {
        $rssFeed->delete();

        return response()->json(['message' => 'Feed deleted.']);
    }

    public function refresh(RssFeed $rssFeed): JsonResponse
    {
        try {
            $created = $this->ingestor->ingest($rssFeed);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => "{$created} new feed item".($created === 1 ? '' : 's').' saved.',
            'created_count' => $created,
            'data' => new RssFeedResource($rssFeed->fresh()->load('workspace:id,name,slug')->loadCount('items')->loadMax('items', 'published_at')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validatedFeed(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
            'workspace_id' => [$required, 'integer', 'exists:workspaces,id'],
            'title' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:255'],
            'url' => [$required, 'url', 'max:2048'],
            'country' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:80'],
            'category' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:80'],
            'status' => [$partial ? 'sometimes' : 'nullable', 'nullable', Rule::in(['active', 'paused'])],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        foreach (['country' => 'Global', 'category' => 'General', 'status' => 'active'] as $key => $default) {
            if (! $partial || array_key_exists($key, $data)) {
                $data[$key] = trim((string) ($data[$key] ?? '')) ?: $default;
            }
        }

        return $data;
    }
}
