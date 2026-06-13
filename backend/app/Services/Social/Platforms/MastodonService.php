<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class MastodonService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'mastodon';
    }

    protected function isConfigured(): bool
    {
        // Mastodon is per-instance; configuration lives on the connected account.
        return false;
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $instance = rtrim((string) data_get($account->settings, 'instance_url'), '/');
        $token = $account->access_token;

        if (! $instance || ! $token) {
            return PublishResult::failure('Mastodon instance or token missing.', retryable: false);
        }

        $response = Http::withToken($token)->post("{$instance}/api/v1/statuses", [
            'status' => $payload->content,
            'visibility' => data_get($payload->options, 'visibility', 'public'),
        ]);

        if (! $response->successful()) {
            return PublishResult::failure('Mastodon API error', $response->json() ?? []);
        }

        return PublishResult::success(
            providerPostId: (string) $response->json('id'),
            permalink: $response->json('url'),
            raw: $response->json() ?? [],
        );
    }
}
