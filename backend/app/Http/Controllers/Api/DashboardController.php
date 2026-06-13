<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(protected UsageGuard $usage) {}

    public function index(): JsonResponse
    {
        $workspace = workspace();

        $upcoming = $workspace->posts()
            ->with(['variants.socialAccount'])
            ->where('status', 'scheduled')
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
                'scheduled' => $workspace->posts()->where('status', 'scheduled')->count(),
                'published_this_month' => $workspace->posts()
                    ->where('status', 'published')
                    ->where('published_at', '>=', now()->startOfMonth())->count(),
                'drafts' => $workspace->posts()->where('status', 'draft')->count(),
                'failed' => $workspace->posts()->where('status', 'failed')->count(),
                'connected_accounts' => $workspace->socialAccounts()->where('status', 'active')->count(),
                'pending_approval' => $workspace->posts()->where('status', 'pending_approval')->count(),
            ],
            'usage' => $this->usage->usage($workspace),
            'upcoming' => PostResource::collection($upcoming),
            'recent_activity' => $recentActivity,
        ]);
    }
}
