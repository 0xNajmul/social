<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkspaceResource;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWorkspaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspaces = Workspace::query()
            ->with(['owner:id,name,email', 'subscription.plan'])
            ->withCount(['members', 'socialAccounts', 'posts'])
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return WorkspaceResource::collection($workspaces)->response();
    }

    public function show(Workspace $workspace): JsonResponse
    {
        return response()->json([
            'data' => new WorkspaceResource(
                $workspace->load(['owner', 'subscription.plan', 'socialAccounts'])
                    ->loadCount(['members', 'posts', 'automations'])
            ),
        ]);
    }
}
