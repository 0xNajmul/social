<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class MastodonService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'mastodon';
    }

    protected function isConfigured(): bool
    {
        $credentials = $this->credentials();

        return ! empty($credentials['client_id'])
            && ! empty($credentials['client_secret'])
            && ! empty($credentials['instance']);
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $instance = rtrim((string) data_get($account->settings, 'instance_url'), '/');
        $token = $account->access_token;

        if (! $instance || ! $token) {
            return PublishResult::failure('Mastodon instance or token missing.', retryable: false);
        }

        $mediaIds = [];
        foreach ($payload->media as $media) {
            $upload = Http::withToken($token)
                ->attach(
                    'file',
                    Storage::disk($media->disk)->get($media->path),
                    basename($media->path),
                    ['Content-Type' => $media->mimeType],
                )
                ->post("{$instance}/api/v2/media");

            if (! $upload->successful()) {
                return PublishResult::failure(
                    $upload->json('error') ?? 'Mastodon media upload failed.',
                    $upload->json() ?? [],
                );
            }

            $mediaId = (string) $upload->json('id');
            if ($mediaId === '') {
                return PublishResult::failure('Mastodon did not return a media attachment ID.');
            }

            if ($upload->status() === 202 && ! $this->waitForMedia($instance, $token, $mediaId)) {
                return PublishResult::failure('Mastodon media processing timed out. Please try again.');
            }

            $mediaIds[] = $mediaId;
        }

        $status = $payload->content;
        if ($payload->link && ! str_contains($status, $payload->link)) {
            $status = trim($status."\n\n".$payload->link);
        }

        $body = [
            'status' => $status,
            'visibility' => data_get(
                $payload->options,
                'visibility',
                data_get($account->settings, 'default_visibility', 'public'),
            ),
            'sensitive' => (bool) data_get($payload->options, 'sensitive', false),
        ];

        if ($mediaIds) {
            $body['media_ids'] = $mediaIds;
        }
        if ($spoilerText = data_get($payload->options, 'spoiler_text')) {
            $body['spoiler_text'] = $spoilerText;
        }
        if ($language = data_get($payload->options, 'language', data_get($account->settings, 'default_language'))) {
            $body['language'] = $language;
        }

        $response = Http::withToken($token)->post("{$instance}/api/v1/statuses", $body);

        if (! $response->successful()) {
            return PublishResult::failure(
                $response->json('error') ?? 'Mastodon API error',
                $response->json() ?? [],
            );
        }

        return PublishResult::success(
            providerPostId: (string) $response->json('id'),
            permalink: $response->json('url'),
            raw: $response->json() ?? [],
        );
    }

    protected function waitForMedia(string $instance, string $token, string $mediaId): bool
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            usleep(500_000);
            $response = Http::withToken($token)->get("{$instance}/api/v1/media/{$mediaId}");

            if ($response->successful() && $response->json('url')) {
                return true;
            }
        }

        return false;
    }
}
