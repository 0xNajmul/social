<?php

use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\AdminContentController;
use App\Http\Controllers\Api\Admin\AdminFeedController;
use App\Http\Controllers\Api\Admin\AdminJobController;
use App\Http\Controllers\Api\Admin\AdminNewsController;
use App\Http\Controllers\Api\Admin\AdminPlanController;
use App\Http\Controllers\Api\Admin\AdminPostController;
use App\Http\Controllers\Api\Admin\AdminReportController;
use App\Http\Controllers\Api\Admin\AdminRoleController;
use App\Http\Controllers\Api\Admin\AdminSettingController;
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
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\MediaFolderController;
use App\Http\Controllers\Api\NewsController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OAuthController;
use App\Http\Controllers\Api\PlannerNoteController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\PublicProfileController;
use App\Http\Controllers\Api\PublicSettingController;
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
Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
Route::get('auth/google/redirect', [AuthController::class, 'googleRedirect']);
Route::get('auth/google/callback', [AuthController::class, 'googleCallback']);
Route::get('plans', [BillingController::class, 'plans']); // public pricing page
Route::post('billing/webhooks/{provider}', [BillingController::class, 'webhook'])->where('provider', 'dodo|creem');
Route::get('public/settings', [PublicSettingController::class, 'index']);
Route::get('public/news', [NewsController::class, 'index']);
Route::get('public/news/{newsPost:slug}', [NewsController::class, 'show']);
Route::get('public/profiles/{handle}', [PublicProfileController::class, 'show']);
Route::get('oauth/{provider}/callback', [OAuthController::class, 'callback']);

/*
|--------------------------------------------------------------------------
| Authenticated endpoints
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
    Route::post('profile', [AuthController::class, 'updateProfile']);
    Route::put('profile/password', [AuthController::class, 'updatePassword']);
    Route::get('public-profile', [PublicProfileController::class, 'current']);
    Route::put('public-profile', [PublicProfileController::class, 'update']);

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
        Route::post('workspace', [WorkspaceController::class, 'update']);
        Route::put('workspace', [WorkspaceController::class, 'update']);
        Route::delete('workspace', [WorkspaceController::class, 'destroy']);
        Route::post('workspace/leave', [WorkspaceController::class, 'leave']);
        Route::get('dashboard', [DashboardController::class, 'index']);

        // Team
        Route::get('team', [TeamController::class, 'index']);
        Route::post('team/invite', [TeamController::class, 'invite']);
        Route::put('team/{user}/role', [TeamController::class, 'updateRole']);
        Route::delete('team/{user}', [TeamController::class, 'removeMember']);
        Route::post('team/invitations/{invitation}/resend', [TeamController::class, 'resendInvitation']);
        Route::delete('team/invitations/{invitation}', [TeamController::class, 'cancelInvitation']);

        // Social accounts
        Route::get('social/platforms', [SocialAccountController::class, 'platforms']);
        Route::get('social/accounts', [SocialAccountController::class, 'index']);
        Route::post('social/accounts/connect', [SocialAccountController::class, 'connect']);
        Route::get('social/accounts/{socialAccount}/creator-info', [SocialAccountController::class, 'creatorInfo']);
        Route::post('social/accounts/{socialAccount}/reddit/communities', [SocialAccountController::class, 'redditCommunities']);
        Route::post('social/accounts/{socialAccount}/refresh', [SocialAccountController::class, 'refresh']);
        Route::delete('social/accounts/{socialAccount}', [SocialAccountController::class, 'destroy']);

        // Posts / composer
        Route::apiResource('posts', PostController::class);
        Route::get('planner-notes', [PlannerNoteController::class, 'index']);
        Route::post('planner-notes', [PlannerNoteController::class, 'store']);
        Route::put('planner-notes/{plannerNote}', [PlannerNoteController::class, 'update']);
        Route::delete('planner-notes/{plannerNote}', [PlannerNoteController::class, 'destroy']);
        Route::put('posts/{post}/status', [PostController::class, 'updateStatus']);
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
        Route::get('media/{media}', [MediaController::class, 'show']);
        Route::put('media/{media}', [MediaController::class, 'update']);
        Route::delete('media/{media}', [MediaController::class, 'destroy']);
        Route::apiResource('media-folders', MediaFolderController::class)->only(['index', 'store', 'update', 'destroy']);

        // Automations
        Route::apiResource('automations', AutomationController::class);
        Route::post('automations/{automation}/run', [AutomationController::class, 'run']);

        // Feed discovery
        Route::get('feeds', [FeedController::class, 'index']);
        Route::post('feeds', [FeedController::class, 'store']);
        Route::put('feeds/{rssFeed}', [FeedController::class, 'update']);
        Route::delete('feeds/{rssFeed}', [FeedController::class, 'destroy']);
        Route::post('feeds/{rssFeed}/refresh', [FeedController::class, 'refresh']);
        Route::get('feed/items', [FeedController::class, 'items']);

        // AI assistant
        Route::post('ai/generate', [AiController::class, 'generate']);

        // Analytics
        Route::get('analytics/overview', [AnalyticsController::class, 'overview']);
        Route::post('analytics/sync', [AnalyticsController::class, 'sync']);

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
        Route::post('users', [AdminUserController::class, 'store']);
        Route::get('users/{user}', [AdminUserController::class, 'show']);
        Route::put('users/{user}', [AdminUserController::class, 'update']);
        Route::post('users/{user}/impersonate', [AdminUserController::class, 'impersonationToken']);
        Route::delete('users/{user}', [AdminUserController::class, 'destroy']);

        Route::apiResource('roles', AdminRoleController::class)->except(['show']);

        Route::apiResource('plans', AdminPlanController::class)->except(['show']);
        Route::apiResource('news', AdminNewsController::class)->except(['show']);

        Route::get('planners', [AdminContentController::class, 'planners']);
        Route::post('planners', [AdminContentController::class, 'storePlanner']);
        Route::get('planners/{plannerNote}', [AdminContentController::class, 'showPlanner']);
        Route::put('planners/{plannerNote}', [AdminContentController::class, 'updatePlanner']);
        Route::delete('planners/{plannerNote}', [AdminContentController::class, 'destroyPlanner']);
        Route::get('media', [AdminContentController::class, 'media']);
        Route::post('media', [AdminContentController::class, 'storeMedia']);
        Route::get('media/{mediaAsset}', [AdminContentController::class, 'showMedia']);
        Route::put('media/{mediaAsset}', [AdminContentController::class, 'updateMedia']);
        Route::delete('media/{mediaAsset}', [AdminContentController::class, 'destroyMedia']);
        Route::get('automations', [AdminContentController::class, 'automations']);
        Route::post('automations', [AdminContentController::class, 'storeAutomation']);
        Route::get('automations/{automation}', [AdminContentController::class, 'showAutomation']);
        Route::put('automations/{automation}', [AdminContentController::class, 'updateAutomation']);
        Route::delete('automations/{automation}', [AdminContentController::class, 'destroyAutomation']);
        Route::get('accounts', [AdminContentController::class, 'accounts']);
        Route::post('accounts', [AdminContentController::class, 'storeAccount']);
        Route::get('accounts/{socialAccount}', [AdminContentController::class, 'showAccount']);
        Route::put('accounts/{socialAccount}', [AdminContentController::class, 'updateAccount']);
        Route::delete('accounts/{socialAccount}', [AdminContentController::class, 'destroyAccount']);
        Route::get('feeds', [AdminFeedController::class, 'index']);
        Route::post('feeds', [AdminFeedController::class, 'store']);
        Route::put('feeds/{rssFeed}', [AdminFeedController::class, 'update']);
        Route::delete('feeds/{rssFeed}', [AdminFeedController::class, 'destroy']);
        Route::post('feeds/{rssFeed}/refresh', [AdminFeedController::class, 'refresh']);

        Route::get('posts', [AdminPostController::class, 'index']);
        Route::get('posts/{post}', [AdminPostController::class, 'show']);
        Route::put('posts/{post}', [AdminPostController::class, 'update']);
        Route::delete('posts/{post}', [AdminPostController::class, 'destroy']);

        Route::get('workspaces', [AdminWorkspaceController::class, 'index']);
        Route::post('workspaces', [AdminWorkspaceController::class, 'store']);
        Route::get('workspaces/{workspace}', [AdminWorkspaceController::class, 'show']);
        Route::put('workspaces/{workspace}', [AdminWorkspaceController::class, 'update']);
        Route::delete('workspaces/{workspace}', [AdminWorkspaceController::class, 'destroy']);

        Route::get('settings', [AdminSettingController::class, 'index']);
        Route::put('settings', [AdminSettingController::class, 'update']);
        Route::post('settings/logo', [AdminSettingController::class, 'uploadLogo']);
        Route::get('languages', [AdminSettingController::class, 'languages']);
        Route::put('languages', [AdminSettingController::class, 'updateLanguages']);
        Route::put('translations', [AdminSettingController::class, 'updateTranslations']);
        Route::delete('translations', [AdminSettingController::class, 'deleteTranslation']);
        Route::post('translations/sync', [AdminSettingController::class, 'syncTranslationsFromFiles']);
        Route::get('settings/ai/providers', [AdminSettingController::class, 'aiProviders']);
        Route::post('settings/ai/models/sync', [AdminSettingController::class, 'syncAiModels']);

        Route::get('jobs/scheduled', [AdminJobController::class, 'scheduled']);
        Route::get('jobs/pending', [AdminJobController::class, 'pendingJobs']);
        Route::get('jobs/failed-posts', [AdminJobController::class, 'failedPosts']);
        Route::get('jobs/failed', [AdminJobController::class, 'failedJobs']);
        Route::post('jobs/retry-failed', [AdminJobController::class, 'retryFailedJobs']);

        Route::get('reports/notifications', [AdminReportController::class, 'notifications']);
        Route::get('reports/affiliate-incomes', [AdminReportController::class, 'affiliateIncomes']);
        Route::get('reports/login-history', [AdminReportController::class, 'loginHistory']);
        Route::get('reports/ai-usage', [AdminReportController::class, 'aiUsageHistory']);
        Route::get('reports/ai-usage-history', [AdminReportController::class, 'aiUsageHistory']);
        Route::get('reports/email-history', [AdminReportController::class, 'emailHistory']);
        Route::get('reports/user-transaction-history', [AdminReportController::class, 'userTransactionHistory']);
        Route::get('reports/activity-logs', [AdminReportController::class, 'activityLogs']);
    });
});
