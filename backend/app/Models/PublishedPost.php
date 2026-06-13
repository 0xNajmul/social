<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PublishedPost extends Model
{
    protected $fillable = [
        'post_variant_id', 'social_account_id', 'workspace_id', 'platform',
        'provider_post_id', 'permalink', 'published_at', 'likes', 'comments',
        'shares', 'views', 'clicks', 'impressions', 'metrics_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'metrics_synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PostVariant, $this> */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(PostVariant::class, 'post_variant_id');
    }

    /** @return BelongsTo<SocialAccount, $this> */
    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(SocialAccount::class);
    }

    public function totalEngagement(): int
    {
        return $this->likes + $this->comments + $this->shares + $this->clicks;
    }
}
