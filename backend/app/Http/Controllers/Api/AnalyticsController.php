<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsSnapshot;
use App\Models\Post;
use App\Models\PublishedPost;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AnalyticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $workspace = workspace();
        $from = $request->date('from') ?? now()->subDays(30);
        $to = $request->date('to') ?? now();
        $accountId = $request->integer('account_id') ?: null;

        $published = PublishedPost::where('workspace_id', $workspace->id)
            ->whereBetween('published_at', [$from, $to]);
        $this->filterPublishedByAccount($published, $accountId);

        $totals = (clone $published)->selectRaw(
            'COUNT(*) as posts, SUM(likes) as likes, SUM(comments) as comments, '.
            'SUM(shares) as shares, SUM(views) as views, SUM(clicks) as clicks, SUM(impressions) as impressions'
        )->first();

        $failed = $workspace->posts()->where('status', 'failed')
            ->when($accountId, fn ($query) => $query->whereHas('variants', fn ($variant) => $variant->where('social_account_id', $accountId)))
            ->whereBetween('updated_at', [$from, $to])->count();

        return response()->json([
            'summary' => [
                'published' => (int) $totals->posts,
                'failed' => $failed,
                'likes' => (int) $totals->likes,
                'comments' => (int) $totals->comments,
                'shares' => (int) $totals->shares,
                'views' => (int) $totals->views,
                'clicks' => (int) $totals->clicks,
                'impressions' => (int) $totals->impressions,
                'engagement_rate' => $totals->impressions > 0
                    ? round(($totals->likes + $totals->comments + $totals->shares) / $totals->impressions * 100, 2)
                    : 0,
            ],
            'by_platform' => $this->byPlatform($workspace->id, $from, $to, $accountId),
            'by_account' => $this->byAccount($workspace->id, $from, $to, $accountId),
            'timeseries' => $this->timeseries($workspace->id, $from, $to, $accountId),
            'top_posts' => $this->performancePosts($workspace->id, $from, $to, $accountId, 'top'),
            'latest_posts' => $this->latestPosts($workspace->id, $from, $to, $accountId),
            'worst_posts' => $this->performancePosts($workspace->id, $from, $to, $accountId, 'worst'),
            'upcoming_posts' => $this->upcomingPosts($workspace->id, $accountId),
            'account_growth' => $this->accountGrowth($workspace->id, $from, $to, $accountId),
        ]);
    }

    protected function byPlatform(int $workspaceId, $from, $to, ?int $accountId = null): array
    {
        $query = PublishedPost::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to]);
        $this->filterPublishedByAccount($query, $accountId);

        return $query
            ->groupBy('platform')
            ->selectRaw('platform, COUNT(*) as posts, SUM(likes+comments+shares) as engagement, SUM(impressions) as impressions')
            ->get()
            ->map(fn ($r) => [
                'platform' => $r->platform,
                'posts' => (int) $r->posts,
                'engagement' => (int) $r->engagement,
                'impressions' => (int) $r->impressions,
            ])->all();
    }

    protected function byAccount(int $workspaceId, $from, $to, ?int $accountId = null): array
    {
        $query = PublishedPost::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to]);
        $this->filterPublishedByAccount($query, $accountId);

        return $query
            ->groupBy('social_account_id', 'platform')
            ->selectRaw(
                'social_account_id, platform, COUNT(*) as posts, SUM(likes) as likes, '.
                'SUM(comments) as comments, SUM(shares) as shares, SUM(views) as views, '.
                'SUM(clicks) as clicks, SUM(impressions) as impressions'
            )
            ->get()
            ->map(fn ($r) => [
                'social_account_id' => (int) $r->social_account_id,
                'platform' => $r->platform,
                'posts' => (int) $r->posts,
                'likes' => (int) $r->likes,
                'comments' => (int) $r->comments,
                'shares' => (int) $r->shares,
                'views' => (int) $r->views,
                'clicks' => (int) $r->clicks,
                'impressions' => (int) $r->impressions,
                'engagement' => (int) $r->likes + (int) $r->comments + (int) $r->shares + (int) $r->clicks,
                'engagement_rate' => $r->impressions > 0
                    ? round(((int) $r->likes + (int) $r->comments + (int) $r->shares + (int) $r->clicks) / (int) $r->impressions * 100, 2)
                    : 0,
            ])->all();
    }

    protected function timeseries(int $workspaceId, $from, $to, ?int $accountId = null): array
    {
        $query = AnalyticsSnapshot::where('workspace_id', $workspaceId)
            ->whereBetween('date', [$from, $to]);
        $this->filterSnapshotsByAccount($query, $accountId);

        return $query
            ->groupBy('date')
            ->orderBy('date')
            ->selectRaw('date, SUM(likes) as likes, SUM(comments) as comments, SUM(shares) as shares, SUM(impressions) as impressions, SUM(posts_published) as posts')
            ->get()
            ->map(fn ($r) => [
                'date' => (string) $r->date,
                'likes' => (int) $r->likes,
                'comments' => (int) $r->comments,
                'shares' => (int) $r->shares,
                'impressions' => (int) $r->impressions,
                'posts' => (int) $r->posts,
            ])->all();
    }

    protected function latestPosts(int $workspaceId, $from, $to, ?int $accountId = null): array
    {
        $query = PublishedPost::with('variant.post')
            ->where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to]);
        $this->filterPublishedByAccount($query, $accountId);

        return $query
            ->latest('published_at')
            ->limit(5)
            ->get()
            ->map(fn ($post) => $this->serializePublishedPost($post))
            ->all();
    }

    protected function performancePosts(int $workspaceId, $from, $to, ?int $accountId = null, string $direction = 'top'): array
    {
        $query = PublishedPost::with('variant.post')
            ->where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to]);
        $this->filterPublishedByAccount($query, $accountId);

        return $query
            ->orderByRaw('(likes + comments + shares + clicks) '.($direction === 'worst' ? 'ASC' : 'DESC'))
            ->limit(5)
            ->get()
            ->map(fn ($post) => $this->serializePublishedPost($post))
            ->all();
    }

    protected function upcomingPosts(int $workspaceId, ?int $accountId = null): array
    {
        return Post::with('variants.socialAccount')
            ->where('workspace_id', $workspaceId)
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '>=', now()->subDay())
            ->when($accountId, fn ($query) => $query->whereHas('variants', fn ($variant) => $variant->where('social_account_id', $accountId)))
            ->orderBy('scheduled_at')
            ->limit(5)
            ->get()
            ->map(function (Post $post) use ($accountId) {
                $variant = $accountId
                    ? $post->variants->firstWhere('social_account_id', $accountId)
                    : $post->variants->first();

                return [
                    'id' => $post->id,
                    'platform' => $variant?->platform,
                    'permalink' => null,
                    'content' => Str::limit($variant?->effectiveContent() ?? $post->content ?? '', 120),
                    'likes' => 0,
                    'comments' => 0,
                    'shares' => 0,
                    'impressions' => 0,
                    'engagement' => 0,
                    'published_at' => null,
                    'scheduled_at' => $post->scheduled_at,
                    'status' => $post->status->value,
                ];
            })->all();
    }

    protected function accountGrowth(int $workspaceId, $from, $to, ?int $accountId = null): array
    {
        $query = AnalyticsSnapshot::where('workspace_id', $workspaceId)
            ->whereBetween('date', [$from, $to]);
        $this->filterSnapshotsByAccount($query, $accountId);

        return $query
            ->groupBy('platform')
            ->selectRaw('platform, SUM(followers_delta) as growth')
            ->get()
            ->map(fn ($r) => ['platform' => $r->platform, 'growth' => (int) $r->growth])
            ->all();
    }

    protected function serializePublishedPost(PublishedPost $post): array
    {
        return [
            'id' => $post->id,
            'platform' => $post->platform,
            'permalink' => $post->permalink,
            'content' => Str::limit($post->variant?->effectiveContent() ?? '', 120),
            'likes' => (int) $post->likes,
            'comments' => (int) $post->comments,
            'shares' => (int) $post->shares,
            'impressions' => (int) $post->impressions,
            'engagement' => $post->totalEngagement(),
            'published_at' => $post->published_at,
            'scheduled_at' => null,
            'status' => 'published',
        ];
    }

    protected function filterPublishedByAccount(Builder $query, ?int $accountId): void
    {
        if ($accountId) {
            $query->where('social_account_id', $accountId);
        }
    }

    protected function filterSnapshotsByAccount(Builder $query, ?int $accountId): void
    {
        if ($accountId) {
            $query->where('social_account_id', $accountId);
        }
    }
}
