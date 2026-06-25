<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RssFeedItemResource;
use App\Http\Resources\RssFeedResource;
use App\Models\RssFeed;
use App\Models\RssFeedItem;
use App\Models\Workspace;
use App\Services\Feeds\RssFeedIngestor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class FeedController extends Controller
{
    public function __construct(protected RssFeedIngestor $ingestor) {}

    public function index(Request $request): JsonResponse
    {
        $feeds = workspace()->rssFeeds()
            ->withCount('items')
            ->withMax('items', 'published_at')
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', "%{$search}%")
                ->orWhere('url', 'like', "%{$search}%")))
            ->when($request->status, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->get();

        return response()->json(['data' => RssFeedResource::collection($feeds)]);
    }

    public function items(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->refreshStaleFeeds($workspace, $request->boolean('refresh'));

        $items = RssFeedItem::query()
            ->with('feed:id,workspace_id,title,url,country,category,status')
            ->whereHas('feed', function ($query) use ($workspace, $request) {
                $query->where('workspace_id', $workspace->id);

                if (! $request->boolean('include_paused')) {
                    $query->where('status', 'active');
                }
            })
            ->when($request->feed_id, fn ($query, $feedId) => $query->where('rss_feed_id', $feedId))
            ->when($request->country && $request->country !== 'all', fn ($query) => $query
                ->whereHas('feed', fn ($feed) => $feed->where('country', $request->country)))
            ->when($request->category && $request->category !== 'all', fn ($query) => $query
                ->whereHas('feed', fn ($feed) => $feed->where('category', $request->category)))
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', "%{$search}%")
                ->orWhere('summary', 'like', "%{$search}%")
                ->orWhere('link', 'like', "%{$search}%")
                ->orWhereHas('feed', fn ($feed) => $feed->where('title', 'like', "%{$search}%"))))
            ->orderByRaw('published_at IS NULL')
            ->orderByDesc('published_at')
            ->latest('created_at')
            ->paginate($request->integer('per_page', 60));

        return RssFeedItemResource::collection($items)->response();
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedFeed($request);
        $feed = workspace()->rssFeeds()->create($data);

        if ($feed->status === 'active') {
            try {
                $this->ingestor->ingest($feed);
            } catch (RuntimeException $e) {
                $feed->delete();

                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        return response()->json([
            'data' => new RssFeedResource($feed->fresh()->loadCount('items')->loadMax('items', 'published_at')),
        ], 201);
    }

    public function update(Request $request, RssFeed $rssFeed): JsonResponse
    {
        $this->ensureWorkspaceFeed($rssFeed);
        $data = $this->validatedFeed($request, partial: true);
        $rssFeed->update($data);

        if (($data['url'] ?? null) || ($rssFeed->status === 'active' && $request->boolean('refresh'))) {
            try {
                $this->ingestor->ingest($rssFeed);
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        return response()->json([
            'data' => new RssFeedResource($rssFeed->fresh()->loadCount('items')->loadMax('items', 'published_at')),
        ]);
    }

    public function destroy(RssFeed $rssFeed): JsonResponse
    {
        $this->ensureWorkspaceFeed($rssFeed);
        $rssFeed->delete();

        return response()->json(['message' => 'Feed deleted.']);
    }

    public function refresh(RssFeed $rssFeed): JsonResponse
    {
        $this->ensureWorkspaceFeed($rssFeed);

        try {
            $created = $this->ingestor->ingest($rssFeed);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => "{$created} new feed item".($created === 1 ? '' : 's').' saved.',
            'created_count' => $created,
            'data' => new RssFeedResource($rssFeed->fresh()->loadCount('items')->loadMax('items', 'published_at')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validatedFeed(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
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

    protected function ensureWorkspaceFeed(RssFeed $feed): void
    {
        abort_unless((int) $feed->workspace_id === (int) workspace()->id, 404);
    }

    protected function refreshStaleFeeds(Workspace $workspace, bool $force = false): void
    {
        $query = $workspace->rssFeeds()
            ->where('status', 'active')
            ->limit(10);

        if (! $force) {
            $query->where(function ($query) {
                $query->whereNull('last_fetched_at')
                    ->orWhere('last_fetched_at', '<=', now()->subMinutes(30));
            });
        }

        foreach ($query->get() as $feed) {
            try {
                $this->ingestor->ingest($feed);
            } catch (RuntimeException) {
                $feed->update(['last_fetched_at' => now()]);
            }
        }
    }
}
