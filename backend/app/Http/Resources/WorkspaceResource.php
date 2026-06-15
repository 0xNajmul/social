<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkspaceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'logo_url' => $this->logo_path ? asset('storage/'.$this->logo_path) : null,
            'timezone' => $this->timezone,
            'brand_color' => $this->brand_color,
            'settings' => $this->settings ?? [],
            'on_trial' => $this->onTrial(),
            'trial_ends_at' => $this->trial_ends_at,
            'role' => $this->whenPivotLoaded('workspace_users', fn () => $this->pivot->role),
            'owner' => new UserResource($this->whenLoaded('owner')),
            'subscription' => new SubscriptionResource($this->whenLoaded('subscription')),
            'members_count' => $this->whenCounted('members'),
            'social_accounts_count' => $this->whenCounted('socialAccounts'),
            'posts_count' => $this->whenCounted('posts'),
            'automations_count' => $this->whenCounted('automations'),
            'created_at' => $this->created_at,
        ];
    }
}
