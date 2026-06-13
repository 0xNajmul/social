<?php

namespace App\Models;

use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    /** @use HasFactory<\Database\Factories\PostFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'workspace_id', 'created_by', 'automation_id', 'title', 'content',
        'type', 'status', 'link_url', 'hashtags', 'mentions', 'options',
        'scheduled_at', 'published_at', 'requires_approval',
    ];

    protected function casts(): array
    {
        return [
            'status' => PostStatus::class,
            'hashtags' => 'array',
            'mentions' => 'array',
            'options' => 'array',
            'requires_approval' => 'boolean',
            'scheduled_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<PostVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(PostVariant::class);
    }

    /** @return BelongsToMany<MediaAsset, $this> */
    public function media(): BelongsToMany
    {
        return $this->belongsToMany(MediaAsset::class, 'post_media')
            ->withPivot('position', 'post_variant_id')
            ->orderByPivot('position')
            ->withTimestamps();
    }

    /** @return HasMany<PostComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class)->latest();
    }

    /** @return HasOne<PostApproval, $this> */
    public function approval(): HasOne
    {
        return $this->hasOne(PostApproval::class)->latestOfMany();
    }

    public function markStatus(PostStatus $status): void
    {
        $this->update(['status' => $status]);
    }
}
