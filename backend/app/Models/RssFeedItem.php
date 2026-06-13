<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RssFeedItem extends Model
{
    protected $fillable = [
        'rss_feed_id', 'guid', 'title', 'summary', 'link',
        'image_url', 'published_at', 'is_processed',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'is_processed' => 'boolean',
        ];
    }

    /** @return BelongsTo<RssFeed, $this> */
    public function feed(): BelongsTo
    {
        return $this->belongsTo(RssFeed::class, 'rss_feed_id');
    }
}
