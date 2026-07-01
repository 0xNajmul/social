<?php

namespace App\Services\Billing;

use App\Models\Plan;
use App\Models\AiGeneration;
use App\Models\Automation;
use App\Models\MediaAsset;
use App\Models\Post;
use App\Models\SocialAccount;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Evaluates a workspace's current usage against its plan limits. Controllers
 * call ensure() before creating limited resources; the dashboard reads usage()
 * to render quota meters.
 */
class UsageGuard
{
    public function plan(Workspace $workspace): ?Plan
    {
        return $this->accountSubscription($workspace)?->plan
            ?? $workspace->subscription?->plan
            ?? Plan::where('is_active', true)->orderBy('price_monthly')->first();
    }

    /**
     * @return array<string, array{used:int,limit:int|null,remaining:int|null}>
     */
    public function usage(Workspace $workspace): array
    {
        $plan = $this->plan($workspace);
        $workspaceIds = $this->accountWorkspaceIds($workspace);

        $metrics = [
            'workspaces' => $workspaceIds->count(),
            'social_accounts' => SocialAccount::whereIn('workspace_id', $workspaceIds)->count(),
            'team_members' => DB::table('workspace_users')->whereIn('workspace_id', $workspaceIds)->count(),
            'scheduled_posts' => Post::whereIn('workspace_id', $workspaceIds)->where('status', 'scheduled')->count(),
            'monthly_posts' => Post::whereIn('workspace_id', $workspaceIds)->where('created_at', '>=', now()->startOfMonth())->count(),
            'automations' => Automation::whereIn('workspace_id', $workspaceIds)->count(),
            'ai_credits' => $this->aiCreditsUsed($workspaceIds),
            'storage_mb' => (int) round(MediaAsset::whereIn('workspace_id', $workspaceIds)->sum('size') / 1048576),
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

    /**
     * @return array<string, array{used:int,limit:int|null,remaining:int|null}>
     */
    public function workspaceUsage(Workspace $workspace): array
    {
        $plan = $this->plan($workspace);

        $metrics = [
            'workspaces' => 1,
            'social_accounts' => $workspace->socialAccounts()->count(),
            'team_members' => $workspace->members()->count(),
            'scheduled_posts' => $workspace->posts()->where('status', 'scheduled')->count(),
            'monthly_posts' => $workspace->posts()->where('created_at', '>=', now()->startOfMonth())->count(),
            'automations' => $workspace->automations()->count(),
            'ai_credits' => $this->aiCreditsUsed(collect([$workspace->id])),
            'storage_mb' => (int) round($workspace->mediaAssets()->sum('size') / 1048576),
        ];

        $result = [];
        foreach ($metrics as $key => $used) {
            $limit = $plan?->limit($key);
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

    public function accountSubscription(Workspace $workspace): ?Subscription
    {
        return Subscription::query()
            ->whereIn('workspace_id', $this->accountWorkspaceIds($workspace))
            ->whereIn('status', ['trialing', 'active'])
            ->with('plan')
            ->latest('current_period_end')
            ->latest('id')
            ->first();
    }

    protected function accountWorkspaceIds(Workspace $workspace)
    {
        return Workspace::where('owner_id', $workspace->owner_id)->pluck('id');
    }

    protected function aiCreditsUsed($workspaceIds): int
    {
        return (int) AiGeneration::whereIn('workspace_id', $workspaceIds)
            ->where('created_at', '>=', now()->startOfMonth())
            ->sum('credits_used');
    }
}
