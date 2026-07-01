<?php

namespace App\Services\Social\Data;

use App\Models\PostVariant;
use Illuminate\Support\Carbon;

/**
 * Immutable value object describing what should be published. Built from a
 * PostVariant and handed to a SocialPublisher implementation.
 */
class PublishPayload
{
    /**
     * @param  array<int, MediaItem>  $media
     * @param  array<string, mixed>  $options
     */
    public function __construct(
        public readonly string $content,
        public readonly array $media = [],
        public readonly ?string $link = null,
        public readonly array $options = [],
        public readonly ?Carbon $scheduledAt = null,
    ) {}

    public static function fromVariant(PostVariant $variant): self
    {
        $post = $variant->post;
        $options = array_merge($post?->options ?? [], $variant->options ?? []);

        $media = collect($variant->post?->media
            ->filter(fn ($asset) => in_array(
                $asset->pivot->post_variant_id,
                [null, $variant->id],
                true
            ))
            ->map(fn ($asset) => new MediaItem(
                disk: $asset->disk,
                path: $asset->path,
                type: $asset->type->value,
                mimeType: $asset->mime_type,
                url: $asset->url,
            ))->values()->all() ?? []);

        $externalUrls = collect($options['media_urls'] ?? [])
            ->merge(array_filter([$options['image_url'] ?? null]))
            ->filter(fn ($url) => is_string($url) && filter_var($url, FILTER_VALIDATE_URL) && in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true))
            ->unique()
            ->values();

        $externalUrls->each(function (string $url) use ($media): void {
            $media->push(new MediaItem(
                disk: 'public',
                path: '',
                type: self::mediaTypeFromUrl($url),
                mimeType: self::mimeTypeFromUrl($url),
                url: $url,
            ));
        });

        $hashtags = $variant->hashtags ?: ($post?->hashtags ?? []);
        $content = trim($variant->effectiveContent() ?? '');

        if ($hashtags) {
            $content .= "\n\n".collect($hashtags)
                ->map(fn ($tag) => str_starts_with($tag, '#') ? $tag : '#'.$tag)
                ->implode(' ');
        }

        return new self(
            content: $content,
            media: $media->values()->all(),
            link: $post?->link_url,
            options: $options,
            scheduledAt: $variant->scheduled_at,
        );
    }

    protected static function mediaTypeFromUrl(string $url): string
    {
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));

        return match (true) {
            str_ends_with($path, '.gif') => 'gif',
            str_ends_with($path, '.mp4'), str_ends_with($path, '.mov'), str_ends_with($path, '.webm') => 'video',
            default => 'image',
        };
    }

    protected static function mimeTypeFromUrl(string $url): string
    {
        $path = strtolower((string) parse_url($url, PHP_URL_PATH));

        return match (true) {
            str_ends_with($path, '.gif') => 'image/gif',
            str_ends_with($path, '.png') => 'image/png',
            str_ends_with($path, '.webp') => 'image/webp',
            str_ends_with($path, '.mp4') => 'video/mp4',
            str_ends_with($path, '.mov') => 'video/quicktime',
            str_ends_with($path, '.webm') => 'video/webm',
            default => 'image/jpeg',
        };
    }
}
