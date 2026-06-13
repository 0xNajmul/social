<?php

namespace App\Models;

use App\Enums\AutomationType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Automation extends Model
{
    protected $fillable = [
        'workspace_id', 'created_by', 'name', 'type', 'is_active',
        'social_account_ids', 'config', 'requires_approval', 'use_ai',
        'last_run_at', 'next_run_at', 'items_created',
    ];

    protected function casts(): array
    {
        return [
            'type' => AutomationType::class,
            'is_active' => 'boolean',
            'requires_approval' => 'boolean',
            'use_ai' => 'boolean',
            'social_account_ids' => 'array',
            'config' => 'array',
            'last_run_at' => 'datetime',
            'next_run_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return HasMany<RssFeed, $this> */
    public function feeds(): HasMany
    {
        return $this->hasMany(RssFeed::class);
    }

    /** @return HasMany<Post, $this> */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }
}
