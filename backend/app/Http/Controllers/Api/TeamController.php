<?php

namespace App\Http\Controllers\Api;

use App\Enums\WorkspaceRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use App\Services\ActivityLogger;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class TeamController extends Controller
{
    public function __construct(
        protected UsageGuard $usage,
        protected ActivityLogger $activity,
    ) {}

    public function index(): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('viewMembers', $workspace);

        return response()->json([
            'members' => UserResource::collection($workspace->members()->get()),
            'invitations' => $workspace->invitations()->whereNull('accepted_at')->get(),
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);
        $this->usage->ensure($workspace, 'team_members');

        $data = $request->validate([
            'email' => ['required', 'email', Rule::unique('workspace_invitations')->where('workspace_id', $workspace->id)],
            'role' => ['required', new Enum(WorkspaceRole::class)],
        ]);

        $invitation = $workspace->invitations()->create([
            'invited_by' => $request->user()->id,
            'email' => $data['email'],
            'role' => $data['role'],
        ]);

        $invitation->notify(new WorkspaceInvitationNotification($invitation));
        $this->activity->log($workspace->id, 'team.invited', $invitation, "Invited {$data['email']}");

        return response()->json(['data' => $invitation], 201);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);

        $data = $request->validate(['role' => ['required', new Enum(WorkspaceRole::class)]]);

        abort_if($workspace->owner_id === $user->id, 422, "The workspace owner's role cannot be changed.");

        $workspace->members()->updateExistingPivot($user->id, ['role' => $data['role']]);

        return response()->json(['message' => 'Role updated.']);
    }

    public function removeMember(User $user): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);

        abort_if($workspace->owner_id === $user->id, 422, 'The workspace owner cannot be removed.');

        $workspace->members()->detach($user->id);

        return response()->json(['message' => 'Member removed.']);
    }

    /**
     * Accept an invitation (authenticated user matching the invite email).
     */
    public function acceptInvitation(Request $request, string $token): JsonResponse
    {
        $invitation = WorkspaceInvitation::where('token', $token)->firstOrFail();

        abort_unless($invitation->isPending(), 410, 'This invitation has expired.');
        abort_unless($request->user()->email === $invitation->email, 403, 'This invitation is for a different email.');

        $invitation->workspace->addMember($request->user(), WorkspaceRole::from($invitation->role));
        $invitation->update(['accepted_at' => now()]);

        return response()->json(['message' => 'Invitation accepted.']);
    }
}
