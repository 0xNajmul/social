<?php

namespace App\Policies;

use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    protected function role(User $user, Post $post): ?\App\Enums\WorkspaceRole
    {
        return $user->roleIn($post->workspace);
    }

    public function view(User $user, Post $post): bool
    {
        return $user->belongsToWorkspace($post->workspace);
    }

    public function update(User $user, Post $post): bool
    {
        return $this->role($user, $post)?->canEdit() ?? false;
    }

    public function delete(User $user, Post $post): bool
    {
        return $this->role($user, $post)?->canEdit() ?? false;
    }

    public function publish(User $user, Post $post): bool
    {
        return $this->role($user, $post)?->canPublish() ?? false;
    }

    public function approve(User $user, Post $post): bool
    {
        return $this->role($user, $post)?->canApprove() ?? false;
    }
}
