<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class BlueskyService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'bluesky';
    }

    protected function isConfigured(): bool
    {
        return false; // Uses per-account app-password session.
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $pds = rtrim((string) data_get($account->settings, 'pds_url', 'https://bsky.social'), '/');

        $response = Http::withToken($account->access_token)
            ->post("{$pds}/xrpc/com.atproto.repo.createRecord", [
                'repo' => $account->provider_account_id,
                'collection' => 'app.bsky.feed.post',
                'record' => [
                    'text' => mb_substr($payload->content, 0, 300),
                    'createdAt' => now()->toIso8601String(),
                    '$type' => 'app.bsky.feed.post',
                ],
            ]);

        if (! $response->successful()) {
            return PublishResult::failure('Bluesky API error', $response->json() ?? []);
        }

        $uri = (string) $response->json('uri');

        return PublishResult::success($uri, raw: $response->json() ?? []);
    }
}
