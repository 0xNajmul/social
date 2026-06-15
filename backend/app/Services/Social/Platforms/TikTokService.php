<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class TikTokService extends AbstractPlatformService
{
    private const API_BASE = 'https://open.tiktokapis.com';

    private const UPLOAD_CHUNK_BYTES = 10_000_000;

    public function key(): string
    {
        return 'tiktok';
    }

    /** @return array<string, mixed> */
    public function creatorInfo(SocialAccount $account): array
    {
        if ($account->isExpired() || $account->isExpiringSoon()) {
            $profile = $this->refreshToken($account);
            if ($profile?->accessToken) {
                $account->update([
                    'access_token' => $profile->accessToken,
                    'refresh_token' => $profile->refreshToken ?? $account->refresh_token,
                    'token_meta' => array_merge($account->token_meta ?? [], $profile->tokenMeta),
                    'token_expires_at' => $profile->expiresAt ?? $account->token_expires_at,
                    'status' => 'active',
                    'status_message' => null,
                ]);
                $account->refresh();
            }
        }

        if (empty($account->access_token)) {
            throw new \RuntimeException('TikTok access token is missing. Reconnect the account.');
        }

        $response = Http::withToken($account->access_token)
            ->asJson()
            ->post(self::API_BASE.'/v2/post/publish/creator_info/query/', []);

        if (! $this->isSuccessfulTikTokResponse($response)) {
            throw new \RuntimeException($this->errorMessage($response, 'Could not load TikTok creator settings.'));
        }

        return $response->json('data', []);
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        if ($this->usesDemoToken($account)) {
            return $this->simulatePublish($account, $payload);
        }

        /** @var MediaItem|null $video */
        $video = collect($payload->media)->first(fn (MediaItem $item) => $item->isVideo());
        if (! $video) {
            return PublishResult::failure('TikTok requires one video file.', retryable: false);
        }

        try {
            $creatorInfo = $this->creatorInfo($account);
        } catch (\RuntimeException $e) {
            return PublishResult::failure($e->getMessage(), retryable: false);
        }

        $privacy = trim((string) data_get($payload->options, 'privacy_level', ''));
        $privacyOptions = data_get($creatorInfo, 'privacy_level_options', []);
        if (! in_array($privacy, $privacyOptions, true)) {
            return PublishResult::failure(
                'The selected TikTok privacy setting is unavailable. Refresh creator settings and choose again.',
                ['privacy_level_options' => $privacyOptions],
                retryable: false,
            );
        }

        $postInfo = [
            'title' => $payload->content,
            'privacy_level' => $privacy,
            'disable_comment' => (bool) data_get($creatorInfo, 'comment_disabled', false)
                || (bool) data_get($payload->options, 'disable_comment', false),
            'disable_duet' => (bool) data_get($creatorInfo, 'duet_disabled', false)
                || (bool) data_get($payload->options, 'disable_duet', false),
            'disable_stitch' => (bool) data_get($creatorInfo, 'stitch_disabled', false)
                || (bool) data_get($payload->options, 'disable_stitch', false),
            'brand_content_toggle' => (bool) data_get($payload->options, 'brand_content_toggle', false),
            'brand_organic_toggle' => (bool) data_get($payload->options, 'brand_organic_toggle', false),
            'is_aigc' => (bool) data_get($payload->options, 'is_aigc', false),
        ];

        [$sourceInfo, $path] = $this->sourceInfo($video);
        if (! $sourceInfo) {
            return PublishResult::failure(
                'TikTok requires a readable server video file or a verified public HTTPS video URL.',
                retryable: false,
            );
        }

        $init = Http::withToken($account->access_token)
            ->asJson()
            ->timeout(120)
            ->post(self::API_BASE.'/v2/post/publish/video/init/', [
                'post_info' => $postInfo,
                'source_info' => $sourceInfo,
            ]);

        if (! $this->isSuccessfulTikTokResponse($init)) {
            return $this->failureFromResponse($init, 'TikTok publish initialization failed.');
        }

        $publishId = (string) $init->json('data.publish_id', '');
        if ($publishId === '') {
            return PublishResult::failure('TikTok did not return a publish ID.', $init->json() ?? [], retryable: false);
        }

        if ($path) {
            $uploadUrl = $init->json('data.upload_url');
            if (! is_string($uploadUrl) || $uploadUrl === '') {
                return PublishResult::failure('TikTok did not return a video upload URL.', $init->json() ?? [], retryable: false);
            }

            $uploadFailure = $this->uploadVideo($uploadUrl, $path, $video->mimeType);
            if ($uploadFailure) {
                return $uploadFailure;
            }
        }

        return PublishResult::success(
            providerPostId: $publishId,
            permalink: null,
            raw: $init->json() ?? [],
        );
    }

    /** @return array<int, string> */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = parent::validatePayload($payload);
        $videos = collect($payload->media)->filter(fn (MediaItem $item) => $item->isVideo());

        if ($videos->count() !== 1 || count($payload->media) !== 1) {
            $errors[] = 'TikTok requires exactly one video file per post.';
        }

        if (trim((string) data_get($payload->options, 'privacy_level', '')) === '') {
            $errors[] = 'Choose a TikTok privacy setting.';
        }

        if (! data_get($payload->options, 'tiktok_consent', false)) {
            $errors[] = 'TikTok publishing consent is required.';
        }

        return $errors;
    }

    public function refreshToken(SocialAccount $account): ?AccountProfile
    {
        if (empty($account->refresh_token)) {
            return null;
        }

        $credentials = $this->credentials();
        if (empty($credentials['client_id']) || empty($credentials['client_secret'])) {
            return null;
        }

        $response = Http::asForm()->post(self::API_BASE.'/v2/oauth/token/', [
            'client_key' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'grant_type' => 'refresh_token',
            'refresh_token' => $account->refresh_token,
        ]);

        if (! $response->successful() || $response->json('error') || ! $response->json('access_token')) {
            return null;
        }

        $tokens = $response->json();

        return new AccountProfile(
            providerAccountId: $account->provider_account_id,
            name: $account->name,
            username: $account->username,
            avatarUrl: $account->avatar_url,
            profileUrl: $account->profile_url,
            accessToken: $tokens['access_token'],
            refreshToken: $tokens['refresh_token'] ?? $account->refresh_token,
            expiresAt: isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
            tokenMeta: [
                'scopes' => array_values(array_filter(explode(',', (string) ($tokens['scope'] ?? '')))),
                'refresh_expires_at' => isset($tokens['refresh_expires_in'])
                    ? now()->addSeconds((int) $tokens['refresh_expires_in'])->toIso8601String()
                    : data_get($account->token_meta, 'refresh_expires_at'),
            ],
        );
    }

    /** @return array{0: array<string, mixed>|null, 1: string|null} */
    private function sourceInfo(MediaItem $video): array
    {
        try {
            $path = $video->absolutePath();
        } catch (\Throwable) {
            $path = null;
        }

        if ($path && is_readable($path)) {
            $size = filesize($path);
            if ($size === false || $size < 1) {
                return [null, null];
            }

            $chunkSize = min(self::UPLOAD_CHUNK_BYTES, $size);

            return [[
                'source' => 'FILE_UPLOAD',
                'video_size' => $size,
                'chunk_size' => $chunkSize,
                'total_chunk_count' => (int) ceil($size / $chunkSize),
            ], $path];
        }

        if ($video->url && str_starts_with($video->url, 'https://')) {
            return [[
                'source' => 'PULL_FROM_URL',
                'video_url' => $video->url,
            ], null];
        }

        return [null, null];
    }

    private function uploadVideo(string $uploadUrl, string $path, string $mimeType): ?PublishResult
    {
        $size = filesize($path);
        $stream = fopen($path, 'rb');
        if ($size === false || ! $stream) {
            return PublishResult::failure('TikTok video file could not be opened.', retryable: false);
        }

        try {
            $offset = 0;
            while ($offset < $size) {
                $length = min(self::UPLOAD_CHUNK_BYTES, $size - $offset);
                $chunk = fread($stream, $length);
                if ($chunk === false || strlen($chunk) !== $length) {
                    return PublishResult::failure('TikTok video file could not be read.', retryable: true);
                }

                $lastByte = $offset + $length - 1;
                $upload = Http::withHeaders([
                    'Content-Type' => $mimeType,
                    'Content-Length' => (string) $length,
                    'Content-Range' => "bytes {$offset}-{$lastByte}/{$size}",
                ])->timeout(600)->withBody($chunk, $mimeType)->put($uploadUrl);

                if (! $upload->successful()) {
                    return PublishResult::failure(
                        $this->errorMessage($upload, 'TikTok video upload failed.'),
                        $upload->json() ?? [],
                        retryable: $this->isRetryable($upload),
                    );
                }

                $offset += $length;
            }
        } finally {
            fclose($stream);
        }

        return null;
    }

    private function failureFromResponse(Response $response, string $fallback): PublishResult
    {
        return PublishResult::failure(
            $this->errorMessage($response, $fallback),
            $response->json() ?? [],
            retryable: $this->isRetryable($response),
        );
    }

    private function isSuccessfulTikTokResponse(Response $response): bool
    {
        return $response->successful() && data_get($response->json(), 'error.code') === 'ok';
    }

    private function errorMessage(Response $response, string $fallback): string
    {
        return (string) (
            data_get($response->json(), 'error.message')
            ?: $response->json('error_description')
            ?: $response->json('message')
            ?: $fallback
        );
    }

    private function isRetryable(Response $response): bool
    {
        return $response->status() === 429 || $response->status() >= 500;
    }

    private function usesDemoToken(SocialAccount $account): bool
    {
        return empty($account->access_token)
            || str_starts_with((string) $account->access_token, 'demo-token');
    }
}
