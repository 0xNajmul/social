<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class InstagramService extends AbstractPlatformService
{
    protected string $graphVersion = 'v21.0';

    public function key(): string
    {
        return 'instagram';
    }

    /**
     * Instagram publishing is a two-step container flow: create a media
     * container from a publicly reachable image/video URL, then publish it.
     */
    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $igUserId = $account->provider_account_id;
        $token = data_get($account->token_meta, 'page_access_token', $account->access_token);
        $base = "https://graph.facebook.com/{$this->graphVersion}/{$igUserId}";

        $media = collect($payload->media)->first();
        if (! $media || ! $media->url) {
            return PublishResult::failure('Instagram requires a publicly accessible image or video URL.', retryable: false);
        }

        $container = Http::post("{$base}/media", array_filter([
            'image_url' => $media->isImage() ? $media->url : null,
            'video_url' => $media->isVideo() ? $media->url : null,
            'media_type' => $media->isVideo() ? 'REELS' : null,
            'caption' => $payload->content,
            'access_token' => $token,
        ]));

        if (! $container->successful()) {
            return PublishResult::failure($container->json('error.message') ?? 'Instagram container error', $container->json() ?? []);
        }

        $publish = Http::post("{$base}/media_publish", [
            'creation_id' => $container->json('id'),
            'access_token' => $token,
        ]);

        if (! $publish->successful()) {
            return PublishResult::failure($publish->json('error.message') ?? 'Instagram publish error', $publish->json() ?? []);
        }

        $id = (string) $publish->json('id');

        return PublishResult::success($id, "https://instagram.com/p/{$id}", $publish->json() ?? []);
    }
}
