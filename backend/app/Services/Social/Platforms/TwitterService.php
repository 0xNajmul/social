<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class TwitterService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'twitter';
    }

    /**
     * Publish a tweet using the X API v2 with the account's OAuth2 bearer token.
     * Media upload requires the v1.1 media endpoint and is omitted here for
     * brevity; text + link posting is fully wired.
     */
    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $text = $payload->content;
        if ($payload->link && ! str_contains($text, $payload->link)) {
            $text = trim($text."\n".$payload->link);
        }

        $response = Http::withToken($account->access_token)
            ->post('https://api.twitter.com/2/tweets', ['text' => $text]);

        if (! $response->successful()) {
            return PublishResult::failure(
                $response->json('detail') ?? 'X (Twitter) API error',
                $response->json() ?? [],
            );
        }

        $id = (string) $response->json('data.id');

        return PublishResult::success(
            providerPostId: $id,
            permalink: "https://x.com/{$account->username}/status/{$id}",
            raw: $response->json() ?? [],
        );
    }
}
