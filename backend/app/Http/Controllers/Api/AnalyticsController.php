<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsSnapshot;
use App\Models\PublishedPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $workspace = workspace();
        $from = $request->date('from') ?? now()->subDays(30);
        $to = $request->date('to') ?? now();

        $published = PublishedPost::where('workspace_id', $workspace->id)
            ->whereBetween('published_at', [$from, $to]);

        $totals = (clone $published)->selectRaw(
            'COUNT(*) as posts, SUM(likes) as likes, SUM(comments) as comments, '.
            'SUM(shares) as shares, SUM(views) as views, SUM(clicks) as clicks, SUM(impressions) as impressions'
        )->first();

        $failed = $workspace->posts()->where('status', 'failed')
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
            'by_platform' => $this->byPlatform($workspace->id, $from, $to),
            'timeseries' => $this->timeseries($workspace->id, $from, $to),
            'top_posts' => $this->topPosts($workspace->id, $from, $to),
            'account_growth' => $this->accountGrowth($workspace->id, $from, $to),
        ]);
    }

    protected function byPlatform(int $workspaceId, $from, $to): array
    {
        return PublishedPost::where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to])
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

    protected function timeseries(int $workspaceId, $from, $to): array
    {
        return AnalyticsSnapshot::where('workspace_id', $workspaceId)
            ->whereBetween('date', [$from, $to])
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

    protected function topPosts(int $workspaceId, $from, $to): array
    {
        return PublishedPost::with('variant.post')
            ->where('workspace_id', $workspaceId)
            ->whereBetween('published_at', [$from, $to])
            ->orderByRaw('(likes + comments + shares) DESC')
            ->limit(5)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'platform' => $p->platform,
                'permalink' => $p->permalink,
                'content' => \Illuminate\Support\Str::limit($p->variant?->effectiveContent() ?? '', 120),
                'likes' => $p->likes,
                'comments' => $p->comments,
                'shares' => $p->shares,
                'engagement' => $p->totalEngagement(),
            ])->all();
    }

    protected function accountGrowth(int $workspaceId, $from, $to): array
    {
        return AnalyticsSnapshot::where('workspace_id', $workspaceId)
            ->whereBetween('date', [$from, $to])
            ->groupBy('platform')
            ->selectRaw('platform, SUM(followers_delta) as growth')
            ->get()
            ->map(fn ($r) => ['platform' => $r->platform, 'growth' => (int) $r->growth])
            ->all();
    }
}
