<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FailedPost;
use App\Models\ScheduledPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Visibility + control over the queue, scheduled posts, and failed jobs.
 */
class AdminJobController extends Controller
{
    public function scheduled(): JsonResponse
    {
        return response()->json([
            'data' => ScheduledPost::with('variant.post:id,content')
                ->where('status', 'pending')
                ->orderBy('scheduled_at')
                ->limit(100)
                ->get(),
        ]);
    }

    public function pendingJobs(): JsonResponse
    {
        if (! Schema::hasTable('jobs')) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => DB::table('jobs')
                ->orderBy('available_at')
                ->limit(100)
                ->get()
                ->map(function ($job) {
                    $payload = json_decode($job->payload ?? '{}', true) ?: [];

                    return [
                        'id' => $job->id,
                        'queue' => $job->queue,
                        'attempts' => $job->attempts,
                        'available_at' => $job->available_at ? now()->setTimestamp((int) $job->available_at)->toIso8601String() : null,
                        'created_at' => $job->created_at ? now()->setTimestamp((int) $job->created_at)->toIso8601String() : null,
                        'display_name' => $payload['displayName'] ?? $payload['job'] ?? 'Queued job',
                    ];
                })
                ->values(),
        ]);
    }

    public function failedPosts(): JsonResponse
    {
        return response()->json([
            'data' => FailedPost::with('variant.post:id,content')
                ->where('is_resolved', false)
                ->latest()
                ->limit(100)
                ->get(),
        ]);
    }

    public function failedJobs(): JsonResponse
    {
        return response()->json([
            'data' => DB::table('failed_jobs')->orderByDesc('failed_at')->limit(100)->get(),
        ]);
    }

    public function retryFailedJobs(): JsonResponse
    {
        Artisan::call('queue:retry', ['id' => ['all']]);

        return response()->json(['message' => 'All failed jobs re-queued.']);
    }
}
