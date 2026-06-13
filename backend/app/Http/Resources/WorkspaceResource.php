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
            'on_trial' => $this->onTrial(),
            'trial_ends_at' => $this->trial_ends_at,
            'role' => $this->whenPivotLoaded('workspace_users', fn () => $this->pivot->role),
            'subscription' => new SubscriptionResource($this->whenLoaded('subscription')),
            'members_count' => $this->whenCounted('members'),
            'social_accounts_count' => $this->whenCounted('socialAccounts'),
            'created_at' => $this->created_at,
        ];
    }
}
