<?php

namespace App\Services\Posts;

use App\Models\MediaAsset;

/**
 * Determines which platforms can receive a post based on attached media types
 * and each network's configured capabilities.
 */
class PlatformMediaCompatibility
{
    /**
     * @param  array<int, int>  $mediaIds
     * @return array{targets: array<int, array<string, mixed>>, skipped: array<int, array<string, mixed>>}
     */
    public function partitionTargets(array $targets, array $mediaIds): array
    {
        $mediaTypes = $this->mediaTypes($mediaIds);
        $kept = [];
        $skipped = [];

        foreach ($targets as $target) {
            $accountId = $target['social_account_id'] ?? null;
            $platform = $target['platform'] ?? null;

            if (! $platform && $accountId) {
                $account = \App\Models\SocialAccount::find($accountId);
                $platform = $account?->platform;
                $options = $target['options'] ?? [];

                if ($account && in_array($platform, ['youtube', 'youtube_shorts'], true)) {
                    $platform = ($options['youtube_format'] ?? 'video') === 'short'
                        ? 'youtube_shorts'
                        : 'youtube';
                }
            }

            if (! $platform) {
                continue;
            }

            $reason = $this->unsupportedReason($platform, $mediaTypes);

            if ($reason) {
                $skipped[] = array_merge($target, [
                    'platform' => $platform,
                    'skip_reason' => $reason,
                ]);
            } else {
                $kept[] = $target;
            }
        }

        return ['targets' => $kept, 'skipped' => $skipped];
    }

    /**
     * @param  array<int, int>  $mediaIds
     * @return array<int, string>
     */
    public function mediaTypes(array $mediaIds): array
    {
        if ($mediaIds === []) {
            return [];
        }

        return MediaAsset::whereIn('id', $mediaIds)
            ->pluck('type')
            ->map(fn ($type) => $type->value ?? (string) $type)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $mediaTypes
     */
    public function unsupportedReason(string $platform, array $mediaTypes): ?string
    {
        $capabilities = config("social.platforms.{$platform}.capabilities", []);

        if ($mediaTypes === []) {
            return in_array('text', $capabilities, true)
                ? null
                : 'This platform requires media — text-only posts are not supported.';
        }

        $hasVideo = in_array('video', $mediaTypes, true);
        $hasImage = (bool) array_intersect(['image', 'gif'], $mediaTypes);
        $hasDocument = in_array('document', $mediaTypes, true);

        if ($hasVideo) {
            return $this->hasAny($capabilities, ['video', 'reels'])
                ? null
                : 'Video uploads are not supported on this platform.';
        }

        if ($hasImage) {
            return $this->hasAny($capabilities, ['image', 'carousel'])
                ? null
                : 'Image uploads are not supported on this platform.';
        }

        if ($hasDocument) {
            return in_array($platform, ['telegram', 'discord', 'whatsapp'], true)
                ? null
                : 'File attachments are not supported on this platform.';
        }

        return null;
    }

    /**
     * @param  array<int, int>  $mediaIds
     */
    public function inferPostType(array $mediaIds): string
    {
        $types = $this->mediaTypes($mediaIds);

        if ($types === []) {
            return 'text';
        }

        if (in_array('video', $types, true)) {
            return count($types) > 1 || count($mediaIds) > 1 ? 'carousel' : 'video';
        }

        if (count($mediaIds) > 1) {
            return 'carousel';
        }

        return 'image';
    }

    /**
     * @param  array<int, string>  $capabilities
     * @param  array<int, string>  $need
     */
    protected function hasAny(array $capabilities, array $need): bool
    {
        return (bool) array_intersect($capabilities, $need);
    }
}
