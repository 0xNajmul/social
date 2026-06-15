<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkspaceResource;
use App\Models\Workspace;
use App\Models\Plan;
use App\Models\User;
use App\Enums\WorkspaceRole;
use App\Services\WorkspaceProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminWorkspaceController extends Controller
{
    public function __construct(protected WorkspaceProvisioner $provisioner) {}

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

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'owner_id' => ['required', 'exists:users,id'],
            'name' => ['required', 'string', 'max:255'],
            'timezone' => ['nullable', 'timezone:all'],
            'plan_id' => ['nullable', 'exists:plans,id'],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        $owner = User::findOrFail($data['owner_id']);
        $plan = isset($data['plan_id']) ? Plan::find($data['plan_id']) : null;
        $workspace = $this->provisioner->create($owner, $data['name'], $plan);
        $workspace->update(array_filter([
            'timezone' => $data['timezone'] ?? null,
            'trial_ends_at' => isset($data['trial_days']) ? now()->addDays($data['trial_days']) : null,
        ], fn ($value) => ! is_null($value)));

        if (isset($data['trial_days']) && $workspace->subscription) {
            $workspace->subscription->update([
                'trial_ends_at' => now()->addDays($data['trial_days']),
                'current_period_end' => now()->addDays($data['trial_days']),
            ]);
        }

        return response()->json([
            'data' => new WorkspaceResource($workspace->load(['owner', 'subscription.plan'])->loadCount(['members', 'socialAccounts', 'posts'])),
        ], 201);
    }

    public function update(Request $request, Workspace $workspace): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'timezone:all'],
            'brand_color' => ['nullable', 'string', 'max:9'],
            'trial_ends_at' => ['nullable', 'date'],
            'owner_id' => ['sometimes', 'exists:users,id'],
            'plan_id' => ['sometimes', 'exists:plans,id'],
        ]);

        DB::transaction(function () use ($workspace, $data) {
            if (isset($data['owner_id']) && (int) $data['owner_id'] !== $workspace->owner_id) {
                $oldOwnerId = $workspace->owner_id;
                $workspace->addMember(User::findOrFail($data['owner_id']), WorkspaceRole::Owner);
                $workspace->members()->updateExistingPivot($oldOwnerId, ['role' => WorkspaceRole::Admin->value]);
                $workspace->owner_id = $data['owner_id'];
            }

            if (isset($data['plan_id']) && $workspace->subscription) {
                $workspace->subscription->update(['plan_id' => $data['plan_id']]);
            }

            $workspace->fill(collect($data)->except(['owner_id', 'plan_id'])->all())->save();
        });

        return response()->json([
            'data' => new WorkspaceResource($workspace->fresh()->load(['owner', 'subscription.plan'])->loadCount(['members', 'socialAccounts', 'posts'])),
        ]);
    }

    public function destroy(Workspace $workspace): JsonResponse
    {
        DB::transaction(function () use ($workspace) {
            User::where('current_workspace_id', $workspace->id)->update(['current_workspace_id' => null]);
            $workspace->delete();
        });

        return response()->json(['message' => 'Workspace deleted.']);
    }
}
