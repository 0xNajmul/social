<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkspaceResource;
use App\Models\Workspace;
use App\Services\Billing\UsageGuard;
use App\Services\WorkspaceProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $referenceWorkspace = $request->user()->ownedWorkspaces()->with('subscription.plan')->first();
        $limit = $referenceWorkspace?->subscription?->plan?->limit('workspaces');
        abort_if(
            ! is_null($limit) && $request->user()->ownedWorkspaces()->count() >= $limit,
            422,
            'Your current plan does not allow another workspace.',
        );

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
        $role = $request->user()->roleIn($workspace);

        return response()->json([
            'data' => new WorkspaceResource($workspace),
            'usage' => $this->usage->usage($workspace),
            'current_role' => $role?->value,
            'permissions' => [
                'can_update' => $role?->canManageTeam() ?? false,
                'is_owner' => $workspace->owner_id === $request->user()->id,
            ],
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

    public function destroy(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('delete', $workspace);

        DB::transaction(function () use ($workspace) {
            foreach ($workspace->members()->get() as $member) {
                if ($member->current_workspace_id === $workspace->id) {
                    $nextWorkspaceId = $member->workspaces()->where('workspaces.id', '!=', $workspace->id)->value('workspaces.id');
                    $member->forceFill(['current_workspace_id' => $nextWorkspaceId])->save();
                }
            }
            $workspace->delete();
        });

        return response()->json(['message' => 'Workspace deleted.']);
    }

    public function leave(Request $request): JsonResponse
    {
        $workspace = workspace();
        abort_if($workspace->owner_id === $request->user()->id, 422, 'Transfer ownership or delete the workspace instead.');

        $workspace->members()->detach($request->user()->id);
        $nextWorkspaceId = $request->user()->workspaces()->value('workspaces.id');
        $request->user()->forceFill(['current_workspace_id' => $nextWorkspaceId])->save();

        return response()->json(['message' => 'You left the workspace.']);
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
