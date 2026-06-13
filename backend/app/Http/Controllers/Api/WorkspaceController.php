<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkspaceResource;
use App\Models\Workspace;
use App\Services\Billing\UsageGuard;
use App\Services\WorkspaceProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceController extends Controller
{
    public function __construct(
        protected WorkspaceProvisioner $provisioner,
        protected UsageGuard $usage,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $workspaces = $request->user()->workspaces()
            ->withCount(['members', 'socialAccounts'])
            ->with('subscription.plan')
            ->get();

        return response()->json(['data' => WorkspaceResource::collection($workspaces)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'timezone' => ['nullable', 'string', 'timezone'],
        ]);

        $workspace = $this->provisioner->create($request->user(), $data['name']);

        if (! empty($data['timezone'])) {
            $workspace->update(['timezone' => $data['timezone']]);
        }

        return response()->json([
            'data' => new WorkspaceResource($workspace->load('subscription.plan')),
        ], 201);
    }

    public function show(Request $request): JsonResponse
    {
        $workspace = workspace()->load(['subscription.plan'])
            ->loadCount(['members', 'socialAccounts']);

        return response()->json([
            'data' => new WorkspaceResource($workspace),
            'usage' => $this->usage->usage($workspace),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('update', $workspace);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'string', 'timezone'],
            'brand_color' => ['nullable', 'string', 'max:9'],
            'settings' => ['nullable', 'array'],
        ]);

        $workspace->update($data);

        return response()->json(['data' => new WorkspaceResource($workspace)]);
    }

    /**
     * Switch the user's active workspace.
     */
    public function switch(Request $request, Workspace $workspace): JsonResponse
    {
        abort_unless($request->user()->belongsToWorkspace($workspace), 403);

        $request->user()->forceFill(['current_workspace_id' => $workspace->id])->save();

        return response()->json(['data' => new WorkspaceResource($workspace)]);
    }
}
