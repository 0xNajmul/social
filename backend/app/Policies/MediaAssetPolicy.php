<?php

namespace App\Policies;

use App\Models\MediaAsset;
use App\Models\User;

class MediaAssetPolicy
{
    public function view(User $user, MediaAsset $asset): bool
    {
        return $user->belongsToWorkspace($asset->workspace);
    }

    public function delete(User $user, MediaAsset $asset): bool
    {
        return $user->roleIn($asset->workspace)?->canEdit() ?? false;
    }
}
