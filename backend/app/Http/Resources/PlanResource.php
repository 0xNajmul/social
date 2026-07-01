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
        $isAdmin = $request->is('api/admin/*');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'price_monthly' => $this->price_monthly / 100,
            'price_yearly' => $this->price_yearly / 100,
            'price_lifetime' => ((int) ($this->price_lifetime ?? 0)) / 100,
            'currency' => $this->currency,
            'trial_days' => $this->trial_days,
            'lifetime_enabled' => (bool) $this->lifetime_enabled,
            'preferred_payment_provider' => $this->when($isAdmin, $this->preferred_payment_provider),
            'checkout_success_url' => $this->when($isAdmin, $this->checkout_success_url),
            'checkout_cancel_url' => $this->when($isAdmin, $this->checkout_cancel_url),
            'product_ids' => $this->when($isAdmin, [
                'dodo' => [
                    'monthly' => $this->dodo_monthly_product_id,
                    'yearly' => $this->dodo_yearly_product_id,
                    'lifetime' => $this->dodo_lifetime_product_id,
                ],
                'creem' => [
                    'monthly' => $this->creem_monthly_product_id,
                    'yearly' => $this->creem_yearly_product_id,
                    'lifetime' => $this->creem_lifetime_product_id,
                ],
            ]),
            'billing_cycles' => [
                'monthly',
                'yearly',
                ...($this->lifetime_enabled ? ['lifetime'] : []),
            ],
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'sort_order' => $this->sort_order,
            'subscriptions_count' => $this->whenCounted('subscriptions'),
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
