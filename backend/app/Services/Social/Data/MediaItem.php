<?php

namespace App\Services\Social\Data;

use Illuminate\Support\Facades\Storage;

class MediaItem
{
    public function __construct(
        public readonly string $disk,
        public readonly string $path,
        public readonly string $type,
        public readonly string $mimeType,
        public readonly ?string $url = null,
    ) {}

    public function isVideo(): bool
    {
        return $this->type === 'video';
    }

    public function isImage(): bool
    {
        return in_array($this->type, ['image', 'gif'], true);
    }

    /**
     * Absolute path on disk (for uploads requiring a binary stream).
     */
    public function absolutePath(): ?string
    {
        return Storage::disk($this->disk)->path($this->path);
    }

    public function contents(): string
    {
        return Storage::disk($this->disk)->get($this->path);
    }
}
