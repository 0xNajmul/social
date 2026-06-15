<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatar_path ? asset('storage/'.$this->avatar_path) : null,
            'timezone' => $this->timezone,
            'locale' => $this->locale,
            'is_admin' => (bool) $this->is_admin,
            'two_factor_enabled' => $this->hasTwoFactorEnabled(),
            'current_workspace_id' => $this->current_workspace_id,
            'role' => $this->whenPivotLoaded('workspace_users', fn () => $this->pivot->role),
            'workspaces_count' => $this->whenCounted('workspaces'),
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
        ];
    }
}
