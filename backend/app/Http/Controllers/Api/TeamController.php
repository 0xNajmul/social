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
use Illuminate\Support\Str;

class TeamController extends Controller
{
    public function __construct(
        protected UsageGuard $usage,
        protected ActivityLogger $activity,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('viewMembers', $workspace);
        $role = $request->user()->roleIn($workspace);

        return response()->json([
            'members' => UserResource::collection($workspace->members()->get()),
            'invitations' => $workspace->invitations()
                ->with('inviter:id,name')
                ->whereNull('accepted_at')
                ->latest()
                ->get()
                ->map(fn (WorkspaceInvitation $invitation) => [
                    'id' => $invitation->id,
                    'email' => $invitation->email,
                    'role' => $invitation->role,
                    'expires_at' => $invitation->expires_at,
                    'created_at' => $invitation->created_at,
                    'is_expired' => ! $invitation->isPending(),
                    'invited_by' => $invitation->inviter?->name,
                ]),
            'current_user_id' => $request->user()->id,
            'current_role' => $role?->value,
            'permissions' => [
                'can_manage' => $role?->canManageTeam() ?? false,
                'is_owner' => $workspace->owner_id === $request->user()->id,
            ],
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);
        $this->usage->ensure($workspace, 'team_members');
        $remaining = $this->usage->remaining($workspace, 'team_members');
        $pendingInvitations = $workspace->invitations()
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->count();
        abort_if(
            ! is_null($remaining) && $pendingInvitations >= $remaining,
            403,
            'Your plan limit for team members has been reached, including pending invitations.',
        );

        $data = $request->validate([
            'email' => ['required', 'email'],
            'role' => ['required', Rule::in($this->assignableRoles($request))],
        ]);

        abort_if(
            $workspace->members()->where('email', $data['email'])->exists(),
            422,
            'This person is already a workspace member.',
        );

        $invitation = $workspace->invitations()->updateOrCreate(['email' => $data['email']], [
            'invited_by' => $request->user()->id,
            'role' => $data['role'],
            'token' => Str::random(48),
            'accepted_at' => null,
            'expires_at' => now()->addDays(7),
        ]);

        $invitation->notify(new WorkspaceInvitationNotification($invitation));
        $this->notifyInvitedUser($invitation);
        $this->activity->log($workspace->id, 'team.invited', $invitation, "Invited {$data['email']}");

        return response()->json(['data' => $invitation], 201);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);

        $data = $request->validate(['role' => ['required', Rule::in($this->assignableRoles($request))]]);

        abort_if($workspace->owner_id === $user->id, 422, "The workspace owner's role cannot be changed.");
        abort_unless($workspace->members()->whereKey($user->id)->exists(), 404, 'Member not found in this workspace.');
        $this->ensureCanManageTarget($request, $workspace, $user);

        $workspace->members()->updateExistingPivot($user->id, ['role' => $data['role']]);
        $this->activity->log($workspace->id, 'team.role_updated', $user, "Role changed to {$data['role']}");

        return response()->json(['message' => 'Role updated.']);
    }

    public function removeMember(Request $request, User $user): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);

        abort_if($workspace->owner_id === $user->id, 422, 'The workspace owner cannot be removed.');
        abort_unless($workspace->members()->whereKey($user->id)->exists(), 404, 'Member not found in this workspace.');
        $this->ensureCanManageTarget($request, $workspace, $user);

        $workspace->members()->detach($user->id);
        if ($user->current_workspace_id === $workspace->id) {
            $user->forceFill(['current_workspace_id' => $user->workspaces()->value('workspaces.id')])->save();
        }
        $this->activity->log($workspace->id, 'team.removed', $user, "Removed {$user->email}");

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
        $request->user()->forceFill(['current_workspace_id' => $invitation->workspace_id])->save();
        $request->user()->unreadNotifications()
            ->where('data->type', 'workspace.invitation')
            ->where('data->invitation_token', $token)
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Invitation accepted.',
            'workspace_slug' => $invitation->workspace->slug,
        ]);
    }

    public function resendInvitation(Request $request, WorkspaceInvitation $invitation): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);
        abort_unless($invitation->workspace_id === $workspace->id && is_null($invitation->accepted_at), 404);

        $invitation->update([
            'token' => Str::random(48),
            'expires_at' => now()->addDays(7),
            'invited_by' => $request->user()->id,
        ]);
        $invitation->notify(new WorkspaceInvitationNotification($invitation));
        $this->notifyInvitedUser($invitation);

        return response()->json(['message' => 'Invitation resent.']);
    }

    public function cancelInvitation(WorkspaceInvitation $invitation): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageTeam', $workspace);
        abort_unless($invitation->workspace_id === $workspace->id && is_null($invitation->accepted_at), 404);

        $invitation->delete();

        return response()->json(['message' => 'Invitation cancelled.']);
    }

    /** @return array<int, string> */
    protected function assignableRoles(Request $request): array
    {
        $roles = [WorkspaceRole::Manager->value, WorkspaceRole::Editor->value, WorkspaceRole::Viewer->value, WorkspaceRole::Client->value];

        if (workspace()->owner_id === $request->user()->id) {
            array_unshift($roles, WorkspaceRole::Admin->value);
        }

        return $roles;
    }

    protected function ensureCanManageTarget(Request $request, $workspace, User $user): void
    {
        $targetRole = $user->roleIn($workspace);
        abort_if(
            $targetRole === WorkspaceRole::Admin && $workspace->owner_id !== $request->user()->id,
            403,
            'Only the workspace owner can manage administrators.',
        );
    }

    protected function notifyInvitedUser(WorkspaceInvitation $invitation): void
    {
        $user = User::where('email', $invitation->email)->first();
        if ($user) {
            $user->unreadNotifications()
                ->where('data->type', 'workspace.invitation')
                ->where('data->invited_workspace_id', $invitation->workspace_id)
                ->update(['read_at' => now()]);
            $user->notify(new WorkspaceInvitationNotification($invitation));
        }
    }
}
