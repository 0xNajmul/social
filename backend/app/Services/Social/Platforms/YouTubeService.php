<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * YouTube Data API v3 — resumable video upload using the connected channel token.
 */
class YouTubeService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'youtube';
    }

    protected function isConfigured(): bool
    {
        return ! empty(config('services.youtube.client_id'));
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        if ($this->usesDemoToken($account)) {
            return $this->simulatePublish($account, $payload);
        }

        $video = collect($payload->media)->first(fn ($m) => $m->isVideo());

        if (! $video) {
            return PublishResult::failure('YouTube requires a video file.', retryable: false);
        }

        $path = $video->absolutePath();

        if (! $path || ! is_readable($path)) {
            return PublishResult::failure('Video file is missing on the server.', retryable: false);
        }

        $title = trim((string) data_get($payload->options, 'title', ''));
        if ($title === '') {
            $title = Str::limit(trim($payload->content), 100, '') ?: 'Untitled video';
        }

        $description = trim($payload->content) ?: $title;
        $privacy = data_get($payload->options, 'privacy', 'public');

        if (! in_array($privacy, ['public', 'unlisted', 'private'], true)) {
            $privacy = 'public';
        }

        if ($this->key() === 'youtube_shorts' && ! str_contains($description, '#Shorts')) {
            $description = trim($description."\n\n#Shorts");
        }

        $size = filesize($path);

        $account = $this->ensureFreshAccessToken($account);

        $init = Http::withToken($account->access_token)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'X-Upload-Content-Type' => $video->mimeType,
                'X-Upload-Content-Length' => (string) $size,
            ])
            ->timeout(120)
            ->post('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', [
                'snippet' => [
                    'title' => Str::limit($title, 100, ''),
                    'description' => Str::limit($description, 5000, ''),
                ],
                'status' => [
                    'privacyStatus' => $privacy,
                ],
            ]);

        if (! $init->successful()) {
            $message = $init->json('error.message') ?? 'YouTube upload initialization failed.';

            return PublishResult::failure($message, $init->json() ?? [], retryable: $init->status() >= 500);
        }

        $uploadUrl = $this->resumableUploadUrl($init);

        if (! $uploadUrl) {
            return PublishResult::failure('YouTube did not return an upload URL.', retryable: false);
        }

        $upload = Http::withToken($account->access_token)
            ->withHeaders(['Content-Type' => $video->mimeType])
            ->timeout(600)
            ->withBody(file_get_contents($path), $video->mimeType)
            ->put($uploadUrl);

        if (! $upload->successful()) {
            $message = $upload->json('error.message') ?? 'YouTube video upload failed.';

            return PublishResult::failure($message, $upload->json() ?? [], retryable: $upload->status() >= 500);
        }

        $videoId = (string) $upload->json('id');

        return PublishResult::success(
            providerPostId: $videoId,
            permalink: "https://www.youtube.com/watch?v={$videoId}",
            raw: $upload->json() ?? [],
        );
    }

    /**
     * @return array<int, string>
     */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = parent::validatePayload($payload);

        if (empty($payload->media) || ! collect($payload->media)->contains(fn ($m) => $m->isVideo())) {
            $errors[] = 'YouTube requires one video file.';
        }

        if ($this->key() === 'youtube_shorts') {
            $opts = $payload->options;
            if (data_get($opts, 'youtube_format') === 'short') {
                // Shorts should ideally be vertical and <= 60s — warn only in UI for now.
            }
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

        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'refresh_token' => $account->refresh_token,
            'grant_type' => 'refresh_token',
        ]);

        if (! $response->successful()) {
            return null;
        }

        $tokens = $response->json();

        if (empty($tokens['access_token'])) {
            return null;
        }

        return new AccountProfile(
            providerAccountId: $account->provider_account_id,
            name: $account->name,
            username: $account->username,
            avatarUrl: $account->avatar_url,
            profileUrl: $account->profile_url,
            accessToken: $tokens['access_token'],
            refreshToken: $tokens['refresh_token'] ?? $account->refresh_token,
            expiresAt: isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
            tokenMeta: ['scope' => $tokens['scope'] ?? null],
        );
    }

    protected function ensureFreshAccessToken(SocialAccount $account): SocialAccount
    {
        if (! $account->isExpired() && ! $account->isExpiringSoon()) {
            return $account;
        }

        $profile = $this->refreshToken($account);

        if (! $profile?->accessToken) {
            return $account;
        }

        $account->update([
            'access_token' => $profile->accessToken,
            'refresh_token' => $profile->refreshToken ?? $account->refresh_token,
            'token_expires_at' => $profile->expiresAt ?? $account->token_expires_at,
            'status' => 'active',
            'status_message' => null,
        ]);

        return $account->fresh();
    }

    protected function resumableUploadUrl(\Illuminate\Http\Client\Response $response): ?string
    {
        $location = $response->header('Location');

        if ($location) {
            return $location;
        }

        foreach ($response->headers() as $name => $values) {
            if (strcasecmp($name, 'Location') === 0) {
                return $values[0] ?? null;
            }
        }

        return null;
    }

    protected function usesDemoToken(SocialAccount $account): bool
    {
        return empty($account->access_token)
            || str_starts_with((string) $account->access_token, 'demo-token');
    }
}
