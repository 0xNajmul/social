<?php

namespace App\Enums;

enum MediaType: string
{
    case Image = 'image';
    case Video = 'video';
    case Gif = 'gif';
    case Document = 'document';

    public static function fromMime(string $mime): self
    {
        return match (true) {
            str_starts_with($mime, 'image/gif') => self::Gif,
            str_starts_with($mime, 'image/') => self::Image,
            str_starts_with($mime, 'video/') => self::Video,
            default => self::Document,
        };
    }
}
