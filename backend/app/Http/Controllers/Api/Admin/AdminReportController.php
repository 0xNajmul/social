<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AiGeneration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminReportController extends Controller
{
    public function notifications(Request $request): JsonResponse
    {
        $notifications = DB::table('notifications')
            ->leftJoin('users', function ($join) {
                $join->on('notifications.notifiable_id', '=', 'users.id')
                    ->where('notifications.notifiable_type', '=', User::class);
            })
            ->select('notifications.*', 'users.name as user_name', 'users.email as user_email')
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('users.name', 'like', "%{$search}%")
                ->orWhere('users.email', 'like', "%{$search}%")
                ->orWhere('notifications.type', 'like', "%{$search}%")
                ->orWhere('notifications.data', 'like', "%{$search}%")))
            ->orderByDesc('notifications.created_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $notifications->getCollection()->map(fn ($notification) => [
                'id' => $notification->id,
                'type' => class_basename($notification->type),
                'user' => $notification->user_name ? ['name' => $notification->user_name, 'email' => $notification->user_email] : null,
                'data' => json_decode($notification->data, true) ?: [],
                'read_at' => $notification->read_at,
                'created_at' => $notification->created_at,
            ])->values(),
            'meta' => $this->meta($notifications),
        ]);
    }

    public function affiliateIncomes(Request $request): JsonResponse
    {
        return $this->emptyReport($request, 'Affiliate income records will appear here when payouts are recorded.');
    }

    public function loginHistory(Request $request): JsonResponse
    {
        $users = User::query()
            ->whereNotNull('last_login_at')
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('last_login_ip', 'like', "%{$search}%")))
            ->latest('last_login_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $user) => [
                'id' => $user->id,
                'user' => ['name' => $user->name, 'email' => $user->email],
                'ip_address' => $user->last_login_ip,
                'last_login_at' => $user->last_login_at,
            ])->values(),
            'meta' => $this->meta($users),
        ]);
    }

    public function aiUsageHistory(Request $request): JsonResponse
    {
        $generations = AiGeneration::query()
            ->with(['user:id,name,email', 'workspace:id,name,slug'])
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('type', 'like', "%{$search}%")
                ->orWhere('model', 'like', "%{$search}%")
                ->orWhere('prompt', 'like', "%{$search}%")))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $generations->getCollection()->map(fn (AiGeneration $generation) => [
                'id' => $generation->id,
                'type' => $generation->type,
                'model' => $generation->model,
                'prompt' => Str::limit($generation->prompt, 160),
                'tokens_used' => $generation->tokens_used,
                'credits_used' => $generation->credits_used,
                'user' => $generation->user,
                'workspace' => $generation->workspace,
                'created_at' => $generation->created_at,
            ])->values(),
            'meta' => $this->meta($generations),
        ]);
    }

    public function emailHistory(Request $request): JsonResponse
    {
        $invitations = WorkspaceInvitation::query()
            ->with(['workspace:id,name,slug', 'inviter:id,name,email'])
            ->when($request->search, fn ($query, $search) => $query->where('email', 'like', "%{$search}%"))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $invitations->getCollection()->map(fn (WorkspaceInvitation $invitation) => [
                'id' => $invitation->id,
                'recipient' => $invitation->email,
                'type' => 'Workspace invitation',
                'status' => $invitation->accepted_at ? 'accepted' : 'sent',
                'workspace' => $invitation->workspace,
                'sender' => $invitation->inviter,
                'sent_at' => $invitation->created_at,
                'accepted_at' => $invitation->accepted_at,
            ])->values(),
            'meta' => $this->meta($invitations),
        ]);
    }

    public function userTransactionHistory(Request $request): JsonResponse
    {
        $subscriptions = Subscription::query()
            ->with(['workspace:id,name,slug,owner_id', 'workspace.owner:id,name,email', 'plan:id,name,price_monthly,price_yearly'])
            ->when($request->search, fn ($query, $search) => $query->whereHas('workspace', fn ($workspace) => $workspace
                ->where('name', 'like', "%{$search}%")
                ->orWhere('slug', 'like', "%{$search}%")))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $subscriptions->getCollection()->map(fn (Subscription $subscription) => [
                'id' => $subscription->id,
                'workspace' => $subscription->workspace,
                'user' => $subscription->workspace?->owner,
                'plan' => $subscription->plan,
                'status' => $subscription->status->value,
                'billing_cycle' => $subscription->billing_cycle,
                'provider' => $subscription->provider,
                'provider_customer_id' => $subscription->provider_customer_id,
                'current_period_start' => $subscription->current_period_start,
                'current_period_end' => $subscription->current_period_end,
                'created_at' => $subscription->created_at,
            ])->values(),
            'meta' => $this->meta($subscriptions),
        ]);
    }

    public function activityLogs(Request $request): JsonResponse
    {
        $logs = ActivityLog::query()
            ->with(['workspace:id,name,slug', 'user:id,name,email'])
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('action', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "%{$search}%")))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $logs->getCollection()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'properties' => $log->properties ?? [],
                'ip_address' => $log->ip_address,
                'workspace' => $log->workspace,
                'user' => $log->user,
                'subject_type' => $log->subject_type ? class_basename($log->subject_type) : null,
                'subject_id' => $log->subject_id,
                'created_at' => $log->created_at,
            ])->values(),
            'meta' => $this->meta($logs),
        ]);
    }

    protected function emptyReport(Request $request, string $message): JsonResponse
    {
        $paginator = new LengthAwarePaginator([], 0, $request->integer('per_page', 50));

        return response()->json([
            'data' => [],
            'meta' => $this->meta($paginator),
            'message' => $message,
        ]);
    }

    protected function meta($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
