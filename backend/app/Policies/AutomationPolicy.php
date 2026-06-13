<?php

namespace App\Policies;

use App\Models\Automation;
use App\Models\User;

class AutomationPolicy
{
    public function view(User $user, Automation $automation): bool
    {
        return $user->belongsToWorkspace($automation->workspace);
    }

    public function update(User $user, Automation $automation): bool
    {
        return $user->roleIn($automation->workspace)?->canEdit() ?? false;
    }

    public function delete(User $user, Automation $automation): bool
    {
        return $user->roleIn($automation->workspace)?->canManageTeam() ?? false;
    }
}
