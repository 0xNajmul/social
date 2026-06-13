<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Post;
use App\Models\SocialAccount;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * SaaS operator dashboard: platform-wide metrics, revenue, and system health.
 */
class AdminDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'stats' => [
                'users' => User::count(),
                'workspaces' => Workspace::count(),
                'social_accounts' => SocialAccount::count(),
                'posts' => Post::count(),
                'published_posts' => Post::where('status', 'published')->count(),
                'active_subscriptions' => Subscription::whereIn('status', ['active', 'trialing'])->count(),
                'new_users_30d' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'revenue' => $this->revenue(),
            'signups' => $this->signupTrend(),
            'plan_distribution' => $this->planDistribution(),
            'health' => $this->health(),
        ]);
    }

    protected function revenue(): array
    {
        $mrr = Subscription::where('subscriptions.status', 'active')
            ->join('plans', 'plans.id', '=', 'subscriptions.plan_id')
            ->selectRaw("SUM(CASE WHEN billing_cycle = 'yearly' THEN price_yearly/12 ELSE price_monthly END) as mrr")
            ->value('mrr') ?? 0;

        return [
            'mrr' => round($mrr / 100, 2),
            'arr' => round($mrr / 100 * 12, 2),
            'currency' => 'USD',
        ];
    }

    protected function signupTrend(): array
    {
        return User::where('created_at', '>=', now()->subDays(30))
            ->groupBy('day')
            ->orderBy('day')
            ->get([DB::raw('DATE(created_at) as day'), DB::raw('COUNT(*) as count')])
            ->map(fn ($r) => ['date' => $r->day, 'count' => (int) $r->count])
            ->all();
    }

    protected function planDistribution(): array
    {
        return Plan::leftJoin('subscriptions', 'subscriptions.plan_id', '=', 'plans.id')
            ->groupBy('plans.id', 'plans.name')
            ->get(['plans.name', DB::raw('COUNT(subscriptions.id) as subscribers')])
            ->map(fn ($r) => ['plan' => $r->name, 'subscribers' => (int) $r->subscribers])
            ->all();
    }

    protected function health(): array
    {
        $pendingJobs = DB::table('jobs')->count();
        $failedJobs = DB::table('failed_jobs')->count();

        return [
            'queue_pending' => $pendingJobs,
            'queue_failed' => $failedJobs,
            'database' => 'ok',
            'scheduler' => 'ok',
            'storage_driver' => config('filesystems.default'),
            'queue_driver' => config('queue.default'),
        ];
    }
}
