<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(protected UsageGuard $usage) {}

    public function index(Request $request): JsonResponse
    {
        $workspace = workspace();
        [$from, $to, $range] = $this->dateRange($request);

        $upcoming = $workspace->posts()
            ->with(['variants.socialAccount'])
            ->where('status', 'scheduled')
            ->when($from, fn ($query) => $query->where('scheduled_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('scheduled_at', '<=', $to))
            ->orderBy('scheduled_at')
            ->limit(6)
            ->get();

        $recentActivity = $workspace->activityLogs()
            ->with('user:id,name')
            ->latest()
            ->limit(10)
            ->get(['id', 'user_id', 'action', 'description', 'created_at']);

        return response()->json([
            'stats' => [
                'scheduled' => $this->between($workspace->posts()->where('status', 'scheduled'), $from, $to, 'scheduled_at')->count(),
                'published_this_month' => $this->between($workspace->posts()->where('status', 'published'), $from, $to, 'published_at')->count(),
                'drafts' => $this->between($workspace->posts()->where('status', 'draft'), $from, $to)->count(),
                'failed' => $this->between($workspace->posts()->where('status', 'failed'), $from, $to, 'updated_at')->count(),
                'connected_accounts' => $workspace->socialAccounts()->where('status', 'active')->count(),
                'pending_approval' => $this->between($workspace->posts()->where('status', 'pending_approval'), $from, $to)->count(),
            ],
            'range' => [
                'key' => $range,
                'from' => $from?->toDateString(),
                'to' => $to?->toDateString(),
            ],
            'usage' => $this->usage->usage($workspace),
            'upcoming' => PostResource::collection($upcoming),
            'recent_activity' => $recentActivity,
        ]);
    }

    protected function dateRange(Request $request): array
    {
        $range = $request->string('range', 'month')->toString();

        if ($range === 'today') {
            return [now()->startOfDay(), now()->endOfDay(), $range];
        }

        if ($range === 'custom') {
            return [
                $request->date('from')?->startOfDay(),
                $request->date('to')?->endOfDay(),
                $range,
            ];
        }

        return [now()->startOfMonth(), now()->endOfMonth(), 'month'];
    }

    protected function between($query, $from, $to, string $column = 'created_at')
    {
        return $query
            ->when($from, fn ($inner) => $inner->where($column, '>=', $from))
            ->when($to, fn ($inner) => $inner->where($column, '<=', $to));
    }
}
