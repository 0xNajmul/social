<?php

use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\AdminJobController;
use App\Http\Controllers\Api\Admin\AdminPlanController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AdminWorkspaceController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AutomationController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeveloperController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\MediaFolderController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\SocialAccountController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\WorkspaceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public endpoints
|--------------------------------------------------------------------------
*/
Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);
Route::get('plans', [BillingController::class, 'plans']); // public pricing page

/*
|--------------------------------------------------------------------------
| Authenticated endpoints
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);

    // Notifications (user scoped, no workspace required).
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);

    // Workspaces (selecting / creating).
    Route::get('workspaces', [WorkspaceController::class, 'index']);
    Route::post('workspaces', [WorkspaceController::class, 'store']);
    Route::post('workspaces/{workspace}/switch', [WorkspaceController::class, 'switch']);
    Route::post('invitations/{token}/accept', [TeamController::class, 'acceptInvitation']);

    /*
    |----------------------------------------------------------------------
    | Workspace-scoped endpoints (resolve + authorize active workspace)
    |----------------------------------------------------------------------
    */
    Route::middleware('workspace')->group(function () {
        Route::get('workspace', [WorkspaceController::class, 'show']);
        Route::put('workspace', [WorkspaceController::class, 'update']);
        Route::get('dashboard', [DashboardController::class, 'index']);

        // Team
        Route::get('team', [TeamController::class, 'index']);
        Route::post('team/invite', [TeamController::class, 'invite']);
        Route::put('team/{user}/role', [TeamController::class, 'updateRole']);
        Route::delete('team/{user}', [TeamController::class, 'removeMember']);

        // Social accounts
        Route::get('social/platforms', [SocialAccountController::class, 'platforms']);
        Route::get('social/accounts', [SocialAccountController::class, 'index']);
        Route::post('social/accounts/connect', [SocialAccountController::class, 'connect']);
        Route::post('social/accounts/{socialAccount}/refresh', [SocialAccountController::class, 'refresh']);
        Route::delete('social/accounts/{socialAccount}', [SocialAccountController::class, 'destroy']);

        // Posts / composer
        Route::apiResource('posts', PostController::class);
        Route::post('posts/{post}/schedule', [PostController::class, 'schedule']);
        Route::post('posts/{post}/publish', [PostController::class, 'publishNow']);
        Route::post('posts/{post}/cancel', [PostController::class, 'cancel']);
        Route::post('posts/{post}/duplicate', [PostController::class, 'duplicate']);
        Route::post('posts/{post}/request-approval', [PostController::class, 'requestApproval']);
        Route::post('posts/{post}/review', [PostController::class, 'review']);
        Route::post('posts/{post}/comments', [PostController::class, 'comment']);

        // Calendar
        Route::get('calendar', [CalendarController::class, 'index']);
        Route::post('calendar/{post}/reschedule', [CalendarController::class, 'reschedule']);

        // Media library
        Route::get('media', [MediaController::class, 'index']);
        Route::post('media', [MediaController::class, 'store']);
        Route::put('media/{media}', [MediaController::class, 'update']);
        Route::delete('media/{media}', [MediaController::class, 'destroy']);
        Route::apiResource('media-folders', MediaFolderController::class)->only(['index', 'store', 'update', 'destroy']);

        // Automations
        Route::apiResource('automations', AutomationController::class)->except(['show']);
        Route::post('automations/{automation}/run', [AutomationController::class, 'run']);

        // AI assistant
        Route::post('ai/generate', [AiController::class, 'generate']);

        // Analytics
        Route::get('analytics/overview', [AnalyticsController::class, 'overview']);

        // Billing
        Route::get('billing/subscription', [BillingController::class, 'current']);
        Route::post('billing/subscribe', [BillingController::class, 'subscribe']);
        Route::post('billing/cancel', [BillingController::class, 'cancel']);

        // Developer platform
        Route::get('developer/api-keys', [DeveloperController::class, 'apiKeys']);
        Route::post('developer/api-keys', [DeveloperController::class, 'createApiKey']);
        Route::delete('developer/api-keys/{apiKey}', [DeveloperController::class, 'revokeApiKey']);
        Route::get('developer/webhooks', [DeveloperController::class, 'webhooks']);
        Route::post('developer/webhooks', [DeveloperController::class, 'createWebhook']);
        Route::delete('developer/webhooks/{webhook}', [DeveloperController::class, 'deleteWebhook']);
    });

    /*
    |----------------------------------------------------------------------
    | SaaS admin panel (platform administrators only)
    |----------------------------------------------------------------------
    */
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('dashboard', [AdminDashboardController::class, 'index']);

        Route::get('users', [AdminUserController::class, 'index']);
        Route::get('users/{user}', [AdminUserController::class, 'show']);
        Route::put('users/{user}', [AdminUserController::class, 'update']);
        Route::post('users/{user}/impersonate', [AdminUserController::class, 'impersonationToken']);
        Route::delete('users/{user}', [AdminUserController::class, 'destroy']);

        Route::apiResource('plans', AdminPlanController::class)->except(['show']);

        Route::get('workspaces', [AdminWorkspaceController::class, 'index']);
        Route::get('workspaces/{workspace}', [AdminWorkspaceController::class, 'show']);

        Route::get('jobs/scheduled', [AdminJobController::class, 'scheduled']);
        Route::get('jobs/failed-posts', [AdminJobController::class, 'failedPosts']);
        Route::get('jobs/failed', [AdminJobController::class, 'failedJobs']);
        Route::post('jobs/retry-failed', [AdminJobController::class, 'retryFailedJobs']);
    });
});
