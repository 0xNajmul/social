<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalyticsSnapshot extends Model
{
    protected $fillable = [
        'workspace_id', 'social_account_id', 'platform', 'date', 'followers',
        'followers_delta', 'posts_published', 'likes', 'comments', 'shares',
        'views', 'clicks', 'impressions', 'engagement_rate',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'engagement_rate' => 'float',
        ];
    }

    /** @return BelongsTo<SocialAccount, $this> */
    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(SocialAccount::class);
    }
}
