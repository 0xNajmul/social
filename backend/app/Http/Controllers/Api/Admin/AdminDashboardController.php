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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SaaS operator dashboard: platform-wide metrics, revenue, and system health.
 */
class AdminDashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        [$from, $to, $range] = $this->dateRange($request);

        return response()->json([
            'stats' => [
                'users' => $this->between(User::query(), $from, $to)->count(),
                'workspaces' => $this->between(Workspace::query(), $from, $to)->count(),
                'social_accounts' => $this->between(SocialAccount::query(), $from, $to)->count(),
                'posts' => $this->between(Post::query(), $from, $to)->count(),
                'published_posts' => $this->between(Post::where('status', 'published'), $from, $to, 'published_at')->count(),
                'active_subscriptions' => Subscription::whereIn('status', ['active', 'trialing'])->count(),
                'new_users_30d' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'range' => [
                'key' => $range,
                'from' => $from?->toDateString(),
                'to' => $to?->toDateString(),
            ],
            'revenue' => $this->revenue(),
            'signups' => $this->signupTrend($from, $to),
            'plan_distribution' => $this->planDistribution(),
            'health' => $this->health(),
        ]);
    }

    protected function dateRange(Request $request): array
    {
        $range = $request->string('range', 'month')->toString();

        if ($range === 'today') {
            return [now()->startOfDay(), now()->endOfDay(), $range];
        }

        if ($range === 'week') {
            return [now()->startOfWeek(), now()->endOfWeek(), $range];
        }

        if ($range === 'all') {
            return [null, null, $range];
        }

        if ($range === 'custom') {
            $from = $request->date('from')?->startOfDay();
            $to = $request->date('to')?->endOfDay();

            return [$from, $to, $range];
        }

        return [now()->startOfMonth(), now()->endOfMonth(), 'month'];
    }

    protected function between($query, $from, $to, string $column = 'created_at')
    {
        return $query
            ->when($from, fn ($inner) => $inner->where($column, '>=', $from))
            ->when($to, fn ($inner) => $inner->where($column, '<=', $to));
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

    protected function signupTrend($from = null, $to = null): array
    {
        return User::query()
            ->when(! $from && ! $to, fn ($query) => $query->where('created_at', '>=', now()->subDays(30)))
            ->when($from, fn ($query) => $query->where('created_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('created_at', '<=', $to))
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
