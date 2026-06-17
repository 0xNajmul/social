<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $workspaceId = $this->activeWorkspaceId($request);
        $filter = function ($query) use ($workspaceId) {
            $query->whereNull('data->workspace_id');
            if ($workspaceId) {
                $query->orWhere('data->workspace_id', $workspaceId);
            }
        };

        return response()->json([
            'unread_count' => $user->unreadNotifications()->where($filter)->count(),
            'data' => $user->notifications()->where($filter)->latest()->limit(30)->get(),
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->where('id', $id)->update(['read_at' => now()]);

        return response()->json(['message' => 'Marked as read.']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $workspaceId = $this->activeWorkspaceId($request);
        $request->user()
            ->unreadNotifications()
            ->where(function ($query) use ($workspaceId) {
                $query->whereNull('data->workspace_id');
                if ($workspaceId) {
                    $query->orWhere('data->workspace_id', $workspaceId);
                }
            })
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    protected function activeWorkspaceId(Request $request): ?int
    {
        $identifier = $request->header('X-Workspace') ?? $request->user()->current_workspace_id;

        if (! $identifier) {
            return null;
        }

        $workspace = Workspace::query()
            ->when(is_numeric($identifier), fn ($query) => $query->where('id', $identifier))
            ->when(! is_numeric($identifier), fn ($query) => $query->where('slug', $identifier))
            ->first();

        if (! $workspace || ! $request->user()->belongsToWorkspace($workspace)) {
            return null;
        }

        return $workspace->id;
    }
}
