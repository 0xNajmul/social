<?php

namespace App\Jobs;

use App\Models\AnalyticsSnapshot;
use App\Models\PublishedPost;
use App\Models\SocialAccount;
use App\Services\Social\SocialManager;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Pulls fresh engagement metrics for an account's recent posts and rolls them
 * into a daily analytics snapshot.
 */
class SyncAnalyticsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $accountId) {}

    public function handle(SocialManager $manager): void
    {
        $account = SocialAccount::find($this->accountId);
        if (! $account) {
            return;
        }

        $driver = $manager->driver($account->platform);

        $totals = ['likes' => 0, 'comments' => 0, 'shares' => 0, 'views' => 0, 'clicks' => 0, 'impressions' => 0];
        $published = PublishedPost::where('social_account_id', $account->id)
            ->where('published_at', '>=', now()->subDays(30))
            ->get();

        foreach ($published as $post) {
            $metrics = $driver->fetchMetrics($account, $post->provider_post_id);
            if ($metrics) {
                $post->update($metrics + ['metrics_synced_at' => now()]);
                foreach ($totals as $k => $_) {
                    $totals[$k] += (int) ($metrics[$k] ?? 0);
                }
            }
        }

        $reach = max(1, $totals['impressions']);
        $engagement = $totals['likes'] + $totals['comments'] + $totals['shares'];

        AnalyticsSnapshot::updateOrCreate(
            ['social_account_id' => $account->id, 'date' => today()],
            [
                'workspace_id' => $account->workspace_id,
                'platform' => $account->platform,
                'posts_published' => $published->where('published_at', '>=', today())->count(),
                'likes' => $totals['likes'],
                'comments' => $totals['comments'],
                'shares' => $totals['shares'],
                'views' => $totals['views'],
                'clicks' => $totals['clicks'],
                'impressions' => $totals['impressions'],
                'engagement_rate' => round($engagement / $reach * 100, 4),
            ],
        );

        $account->update(['last_synced_at' => now()]);
    }
}
