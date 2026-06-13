<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class FacebookPageService extends AbstractPlatformService
{
    protected string $graphVersion = 'v21.0';

    public function key(): string
    {
        return 'facebook_page';
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        // The page access token is stored in token_meta after OAuth.
        $pageToken = data_get($account->token_meta, 'page_access_token', $account->access_token);
        $pageId = $account->provider_account_id;
        $base = "https://graph.facebook.com/{$this->graphVersion}/{$pageId}";

        $firstImage = collect($payload->media)->first(fn ($m) => $m->isImage());

        if ($firstImage) {
            $response = Http::asMultipart()
                ->attach('source', $firstImage->contents(), 'image')
                ->post("{$base}/photos", [
                    'caption' => $payload->content,
                    'access_token' => $pageToken,
                ]);
        } else {
            $response = Http::post("{$base}/feed", array_filter([
                'message' => $payload->content,
                'link' => $payload->link,
                'access_token' => $pageToken,
            ]));
        }

        if (! $response->successful()) {
            return PublishResult::failure(
                $response->json('error.message') ?? 'Facebook Graph API error',
                $response->json() ?? [],
            );
        }

        $id = (string) ($response->json('post_id') ?? $response->json('id'));

        return PublishResult::success(
            providerPostId: $id,
            permalink: "https://facebook.com/{$id}",
            raw: $response->json() ?? [],
        );
    }

    public function fetchMetrics(SocialAccount $account, string $providerPostId): array
    {
        if (! $this->isConfigured()) {
            return parent::fetchMetrics($account, $providerPostId);
        }

        $token = data_get($account->token_meta, 'page_access_token', $account->access_token);
        $response = Http::get("https://graph.facebook.com/{$this->graphVersion}/{$providerPostId}", [
            'fields' => 'likes.summary(true),comments.summary(true),shares',
            'access_token' => $token,
        ]);

        $data = $response->json() ?? [];

        return [
            'likes' => (int) data_get($data, 'likes.summary.total_count', 0),
            'comments' => (int) data_get($data, 'comments.summary.total_count', 0),
            'shares' => (int) data_get($data, 'shares.count', 0),
        ];
    }
}
