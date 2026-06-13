<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class TelegramService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'telegram';
    }

    protected function isConfigured(): bool
    {
        return ! empty(config('services.telegram.bot_token'));
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $token = config('services.telegram.bot_token');
        $chatId = $account->provider_account_id; // @channel or numeric id
        $base = "https://api.telegram.org/bot{$token}";

        // Send a photo when the first media item is an image, otherwise text.
        $firstImage = collect($payload->media)->first(fn ($m) => $m->isImage());

        $response = $firstImage
            ? Http::asMultipart()
                ->attach('photo', $firstImage->contents(), 'image')
                ->post("{$base}/sendPhoto", [
                    'chat_id' => $chatId,
                    'caption' => mb_substr($payload->content, 0, 1024),
                ])
            : Http::post("{$base}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $payload->content,
                'disable_web_page_preview' => false,
            ]);

        $data = $response->json();

        if (! $response->successful() || ! ($data['ok'] ?? false)) {
            return PublishResult::failure(
                $data['description'] ?? 'Telegram API error',
                $data ?? [],
            );
        }

        $messageId = (string) ($data['result']['message_id'] ?? '');
        $handle = ltrim((string) $chatId, '@');

        return PublishResult::success(
            providerPostId: $messageId,
            permalink: "https://t.me/{$handle}/{$messageId}",
            raw: $data,
        );
    }
}
