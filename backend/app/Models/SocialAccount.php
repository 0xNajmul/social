<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SocialAccount extends Model
{
    /** @use HasFactory<\Database\Factories\SocialAccountFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'workspace_id', 'connected_by', 'platform', 'provider_account_id',
        'name', 'username', 'avatar_url', 'profile_url', 'access_token',
        'refresh_token', 'token_meta', 'token_expires_at', 'status',
        'status_message', 'settings', 'last_synced_at',
    ];

    protected $hidden = ['access_token', 'refresh_token'];

    protected function casts(): array
    {
        return [
            // Tokens are transparently encrypted at rest.
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_meta' => 'encrypted:array',
            'settings' => 'array',
            'token_expires_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return HasMany<PostVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(PostVariant::class);
    }

    public function platformConfig(): array
    {
        return config("social.platforms.{$this->platform}", []);
    }

    public function isExpired(): bool
    {
        return $this->token_expires_at && $this->token_expires_at->isPast();
    }

    public function isExpiringSoon(): bool
    {
        if (! $this->token_expires_at) {
            return false;
        }

        $days = config('social.token_expiry_warning_days', 5);

        return $this->token_expires_at->isFuture()
            && $this->token_expires_at->lte(now()->addDays($days));
    }

    /** @param Builder<SocialAccount> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('status', 'active');
    }
}
