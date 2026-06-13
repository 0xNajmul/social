<?php

namespace App\Services\Billing;

use App\Models\Plan;
use App\Models\Workspace;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Evaluates a workspace's current usage against its plan limits. Controllers
 * call ensure() before creating limited resources; the dashboard reads usage()
 * to render quota meters.
 */
class UsageGuard
{
    public function plan(Workspace $workspace): ?Plan
    {
        return $workspace->subscription?->plan
            ?? Plan::where('is_active', true)->orderBy('price_monthly')->first();
    }

    /**
     * @return array<string, array{used:int,limit:int|null,remaining:int|null}>
     */
    public function usage(Workspace $workspace): array
    {
        $plan = $this->plan($workspace);

        $metrics = [
            'social_accounts' => $workspace->socialAccounts()->count(),
            'team_members' => $workspace->members()->count(),
            'scheduled_posts' => $workspace->posts()->where('status', 'scheduled')->count(),
            'monthly_posts' => $workspace->posts()->where('created_at', '>=', now()->startOfMonth())->count(),
            'automations' => $workspace->automations()->count(),
            'ai_credits' => $this->aiCreditsUsed($workspace),
            'storage_mb' => (int) round($workspace->mediaAssets()->sum('size') / 1048576),
        ];

        $result = [];
        foreach ($metrics as $key => $used) {
            $limit = $plan?->limit($key); // null = unlimited
            $result[$key] = [
                'used' => $used,
                'limit' => $limit,
                'remaining' => is_null($limit) ? null : max(0, $limit - $used),
            ];
        }

        return $result;
    }

    public function remaining(Workspace $workspace, string $key): ?int
    {
        return $this->usage($workspace)[$key]['remaining'] ?? null;
    }

    /**
     * Throw when creating one more of $key would exceed the plan limit.
     *
     * @throws AuthorizationException
     */
    public function ensure(Workspace $workspace, string $key, int $additional = 1): void
    {
        $remaining = $this->remaining($workspace, $key);

        if (! is_null($remaining) && $remaining < $additional) {
            throw new AuthorizationException(
                "Your plan limit for ".str_replace('_', ' ', $key)." has been reached. Upgrade to add more."
            );
        }
    }

    protected function aiCreditsUsed(Workspace $workspace): int
    {
        return (int) $workspace->aiGenerations()
            ->where('created_at', '>=', now()->startOfMonth())
            ->sum('credits_used');
    }
}
