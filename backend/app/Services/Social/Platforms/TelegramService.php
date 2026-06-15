<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Http\Client\Response;
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
        $chatId = data_get($account->settings, 'chat_id') ?? $account->provider_account_id;

        if (empty($chatId) || str_contains($account->name, 'Demo Account')) {
            return PublishResult::failure(
                'This Telegram account was connected in demo mode. Disconnect it in Accounts, then reconnect with your real @channel name or numeric chat id.',
                retryable: false,
            );
        }

        $base = "https://api.telegram.org/bot{$token}";
        $caption = $this->caption($payload->content);
        $media = collect($payload->media);

        $video = $media->first(fn (MediaItem $m) => $m->isVideo());
        if ($video) {
            return $this->sendFile($base, $chatId, 'sendVideo', 'video', $video, $caption, [
                'supports_streaming' => 'true',
            ]);
        }

        $images = $media->filter(fn (MediaItem $m) => $m->isImage())->values();

        if ($images->count() === 1) {
            return $this->sendFile($base, $chatId, 'sendPhoto', 'photo', $images->first(), $caption);
        }

        if ($images->count() > 1) {
            return $this->sendMediaGroup($base, $chatId, $images->all(), $caption);
        }

        $document = $media->first(fn (MediaItem $m) => $m->type === 'document');
        if ($document) {
            return $this->sendFile($base, $chatId, 'sendDocument', 'document', $document, $caption);
        }

        if ($caption === '') {
            return PublishResult::failure('Nothing to publish — add text or media.', retryable: false);
        }

        $response = Http::timeout(30)->post("{$base}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $caption,
            'disable_web_page_preview' => false,
        ]);

        return $this->parseResponse($response, $chatId);
    }

    /**
     * @param  array<string, string>  $extra
     */
    protected function sendFile(
        string $base,
        string $chatId,
        string $method,
        string $field,
        MediaItem $file,
        string $caption,
        array $extra = [],
    ): PublishResult {
        $path = $file->absolutePath();

        if (! $path || ! is_readable($path)) {
            return PublishResult::failure('Media file is missing on the server.', retryable: false);
        }

        $request = Http::asMultipart()->timeout(300);

        $handle = fopen($path, 'r');
        if ($handle === false) {
            return PublishResult::failure('Could not read media file.', retryable: false);
        }

        try {
            $request = $request->attach($field, $handle, basename($path));

            $fields = array_merge([
                'chat_id' => $chatId,
            ], $extra);

            if ($caption !== '') {
                $fields['caption'] = $caption;
            }

            $response = $request->post("{$base}/{$method}", $fields);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }

        return $this->parseResponse($response, $chatId);
    }

    /**
     * @param  array<int, MediaItem>  $images
     */
    protected function sendMediaGroup(string $base, string $chatId, array $images, string $caption): PublishResult
    {
        $mediaPayload = [];
        $request = Http::asMultipart()->timeout(120);
        $handles = [];

        try {
            foreach ($images as $index => $image) {
                $path = $image->absolutePath();
                if (! $path || ! is_readable($path)) {
                    return PublishResult::failure('An image file is missing on the server.', retryable: false);
                }

                $attachName = "photo{$index}";
                $handle = fopen($path, 'r');
                if ($handle === false) {
                    return PublishResult::failure('Could not read an image file.', retryable: false);
                }
                $handles[] = $handle;
                $request = $request->attach($attachName, $handle, basename($path));

                $entry = [
                    'type' => 'photo',
                    'media' => "attach://{$attachName}",
                ];

                if ($index === 0 && $caption !== '') {
                    $entry['caption'] = $caption;
                }

                $mediaPayload[] = $entry;
            }

            $response = $request->post("{$base}/sendMediaGroup", [
                'chat_id' => $chatId,
                'media' => json_encode($mediaPayload),
            ]);
        } finally {
            foreach ($handles as $handle) {
                if (is_resource($handle)) {
                    fclose($handle);
                }
            }
        }

        return $this->parseResponse($response, $chatId, useFirstMessage: true);
    }

    protected function parseResponse(Response $response, string $chatId, bool $useFirstMessage = false): PublishResult
    {
        $data = $response->json();

        if (! $response->successful() || ! ($data['ok'] ?? false)) {
            return PublishResult::failure(
                $data['description'] ?? 'Telegram API error',
                $data ?? [],
                retryable: $response->status() >= 500,
            );
        }

        $result = $data['result'];
        if ($useFirstMessage && is_array($result)) {
            $result = $result[0] ?? [];
        }

        $messageId = (string) ($result['message_id'] ?? '');
        $username = data_get($result, 'chat.username');
        $permalink = $username
            ? "https://t.me/{$username}/{$messageId}"
            : "https://t.me/c/".ltrim(str_replace('-100', '', $chatId), '-')."/{$messageId}";

        return PublishResult::success(
            providerPostId: $messageId,
            permalink: $permalink,
            raw: $data,
        );
    }

    protected function caption(string $content): string
    {
        return mb_substr(trim($content), 0, 1024);
    }
}
