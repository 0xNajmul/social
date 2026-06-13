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

        $media = $variant->post?->media
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
            ))->values()->all() ?? [];

        $hashtags = $variant->hashtags ?: ($post?->hashtags ?? []);
        $content = trim($variant->effectiveContent() ?? '');

        if ($hashtags) {
            $content .= "\n\n".collect($hashtags)
                ->map(fn ($tag) => str_starts_with($tag, '#') ? $tag : '#'.$tag)
                ->implode(' ');
        }

        return new self(
            content: $content,
            media: $media,
            link: $post?->link_url,
            options: array_merge($post?->options ?? [], $variant->options ?? []),
            scheduledAt: $variant->scheduled_at,
        );
    }
}
