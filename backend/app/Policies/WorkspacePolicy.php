<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;

class WorkspacePolicy
{
    public function view(User $user, Workspace $workspace): bool
    {
        return $user->belongsToWorkspace($workspace);
    }

    public function update(User $user, Workspace $workspace): bool
    {
        return $user->roleIn($workspace)?->canManageTeam() ?? false;
    }

    public function viewMembers(User $user, Workspace $workspace): bool
    {
        return $user->belongsToWorkspace($workspace);
    }

    public function manageTeam(User $user, Workspace $workspace): bool
    {
        return $user->roleIn($workspace)?->canManageTeam() ?? false;
    }

    public function manageBilling(User $user, Workspace $workspace): bool
    {
        return $user->roleIn($workspace)?->canManageBilling() ?? false;
    }

    public function delete(User $user, Workspace $workspace): bool
    {
        return $workspace->owner_id === $user->id;
    }
}
