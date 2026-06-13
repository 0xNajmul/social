<?php

namespace App\Policies;

use App\Models\SocialAccount;
use App\Models\User;

class SocialAccountPolicy
{
    public function view(User $user, SocialAccount $account): bool
    {
        return $user->belongsToWorkspace($account->workspace);
    }

    public function delete(User $user, SocialAccount $account): bool
    {
        return $user->roleIn($account->workspace)?->canManageTeam() ?? false;
    }
}
