<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class DiscordService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'discord';
    }

    protected function isConfigured(): bool
    {
        // Discord posts via a per-channel webhook URL stored on the account.
        return false;
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $webhook = data_get($account->settings, 'webhook_url');

        if (! $webhook) {
            return PublishResult::failure('No Discord webhook URL configured for this channel.', retryable: false);
        }

        $response = Http::post($webhook.'?wait=true', [
            'content' => mb_substr($payload->content, 0, 2000),
            'embeds' => $payload->link ? [['url' => $payload->link, 'title' => 'Link']] : [],
        ]);

        if (! $response->successful()) {
            return PublishResult::failure('Discord webhook error', $response->json() ?? []);
        }

        $id = (string) $response->json('id');

        return PublishResult::success($id, raw: $response->json() ?? []);
    }
}
