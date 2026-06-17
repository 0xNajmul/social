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
            'member_id' => $this->memberId(),
            'referral_code' => $this->memberId(),
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatar_path ? asset('storage/'.$this->avatar_path) : null,
            'timezone' => $this->timezone,
            'locale' => $this->locale,
            'settings' => $this->settings ?? [],
            'is_admin' => (bool) $this->is_admin,
            'admin_role_id' => $this->admin_role_id,
            'admin_role' => $this->whenLoaded('adminRole'),
            'two_factor_enabled' => $this->hasTwoFactorEnabled(),
            'current_workspace_id' => $this->current_workspace_id,
            'role' => $this->whenPivotLoaded('workspace_users', fn () => $this->pivot->role),
            'workspaces_count' => $this->whenCounted('workspaces'),
            'social_accounts_count' => $this->whenCounted('socialAccounts'),
            'workspaces' => WorkspaceResource::collection($this->whenLoaded('workspaces')),
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
        ];
    }

    protected function memberId(): string
    {
        $seed = strtoupper(base_convert((string) (($this->id * 1000003) + 7919), 10, 36));

        return str_pad(substr($seed, 0, 10), 10, '0', STR_PAD_LEFT);
    }
}
