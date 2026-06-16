<?php

namespace App\Models;

use App\Enums\MediaType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaAsset extends Model
{
    /** @use HasFactory<\Database\Factories\MediaAssetFactory> */
    use HasFactory;

    protected $fillable = [
        'workspace_id', 'folder_id', 'uploaded_by', 'type', 'disk', 'path',
        'thumbnail_path', 'original_name', 'mime_type', 'size', 'width',
        'height', 'duration', 'tags', 'meta',
    ];

    protected $appends = ['url', 'thumbnail_url'];

    protected function casts(): array
    {
        return [
            'type' => MediaType::class,
            'tags' => 'array',
            'meta' => 'array',
        ];
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<MediaFolder, $this> */
    public function folder(): BelongsTo
    {
        return $this->belongsTo(MediaFolder::class, 'folder_id');
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function getUrlAttribute(): string
    {
        // Relative URL so the Vite dev proxy (/storage → Laravel) serves files correctly.
        return '/storage/'.ltrim(str_replace('\\', '/', $this->path), '/');
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if (! $this->thumbnail_path) {
            return $this->type === \App\Enums\MediaType::Image || $this->type === \App\Enums\MediaType::Gif
                ? $this->url
                : null;
        }

        return '/storage/'.ltrim(str_replace('\\', '/', $this->thumbnail_path), '/');
    }
}
