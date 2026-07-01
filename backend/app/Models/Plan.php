<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    /** @use HasFactory<\Database\Factories\PlanFactory> */
    use HasFactory;

    protected $fillable = [
        'name', 'slug', 'description', 'price_monthly', 'price_yearly',
        'price_lifetime', 'currency', 'stripe_monthly_price_id',
        'stripe_yearly_price_id', 'trial_days', 'lifetime_enabled',
        'preferred_payment_provider', 'dodo_monthly_product_id',
        'dodo_yearly_product_id', 'dodo_lifetime_product_id',
        'creem_monthly_product_id', 'creem_yearly_product_id',
        'creem_lifetime_product_id', 'checkout_success_url',
        'checkout_cancel_url', 'payment_meta',
        'max_workspaces', 'max_team_members', 'max_social_accounts',
        'max_scheduled_posts', 'max_monthly_posts', 'max_automations',
        'max_ai_credits', 'max_storage_mb', 'features', 'is_active',
        'is_featured', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array',
            'lifetime_enabled' => 'boolean',
            'payment_meta' => 'array',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
        ];
    }

    /** @return HasMany<Subscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Look up a usage limit column. Returns null for unlimited (-1).
     */
    public function limit(string $key): ?int
    {
        $value = $this->getAttribute('max_'.$key);

        return $value === -1 ? null : $value;
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
