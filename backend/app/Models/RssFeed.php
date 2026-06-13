<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RssFeed extends Model
{
    protected $fillable = [
        'workspace_id', 'automation_id', 'title', 'url',
        'last_item_guid', 'last_fetched_at',
    ];

    protected function casts(): array
    {
        return ['last_fetched_at' => 'datetime'];
    }

    /** @return BelongsTo<Automation, $this> */
    public function automation(): BelongsTo
    {
        return $this->belongsTo(Automation::class);
    }

    /** @return HasMany<RssFeedItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(RssFeedItem::class);
    }
}
