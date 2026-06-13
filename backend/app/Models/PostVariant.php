<?php

namespace App\Models;

use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PostVariant extends Model
{
    protected $fillable = [
        'post_id', 'social_account_id', 'platform', 'content', 'hashtags',
        'options', 'status', 'scheduled_at', 'published_at',
        'provider_post_id', 'permalink', 'provider_response',
        'error_message', 'attempts',
    ];

    protected function casts(): array
    {
        return [
            'status' => PostStatus::class,
            'hashtags' => 'array',
            'options' => 'array',
            'provider_response' => 'array',
            'scheduled_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Post, $this> */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /** @return BelongsTo<SocialAccount, $this> */
    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(SocialAccount::class);
    }

    /** @return HasOne<PublishedPost, $this> */
    public function published(): HasOne
    {
        return $this->hasOne(PublishedPost::class);
    }

    /**
     * Effective content (variant override falls back to the parent post).
     */
    public function effectiveContent(): ?string
    {
        return $this->content ?: $this->post?->content;
    }
}
