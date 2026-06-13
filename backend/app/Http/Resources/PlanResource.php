<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlanResource extends JsonResource
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
            'description' => $this->description,
            'price_monthly' => $this->price_monthly / 100,
            'price_yearly' => $this->price_yearly / 100,
            'currency' => $this->currency,
            'trial_days' => $this->trial_days,
            'is_featured' => $this->is_featured,
            'limits' => [
                'workspaces' => $this->max_workspaces,
                'team_members' => $this->max_team_members,
                'social_accounts' => $this->max_social_accounts,
                'scheduled_posts' => $this->max_scheduled_posts,
                'monthly_posts' => $this->max_monthly_posts,
                'automations' => $this->max_automations,
                'ai_credits' => $this->max_ai_credits,
                'storage_mb' => $this->max_storage_mb,
            ],
            'features' => $this->features ?? [],
        ];
    }
}
