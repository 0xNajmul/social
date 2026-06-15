<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class FacebookPageService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'facebook_page';
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $credentials = $this->credentials();
        $requiredScopes = $credentials['scopes'] ?? ['pages_read_engagement', 'pages_manage_posts'];
        $grantedScopes = data_get($account->token_meta, 'scopes', []);
        $permissionsVerifiedAt = data_get($account->token_meta, 'permissions_verified_at');
        $missingScopes = array_values(array_diff($requiredScopes, $grantedScopes));

        if (! $permissionsVerifiedAt || $missingScopes) {
            $details = $missingScopes ? ' Missing: '.implode(', ', $missingScopes).'.' : '';

            return PublishResult::failure(
                'Reconnect this Facebook Page to verify publishing permissions.'.$details,
                ['missing_permissions' => $missingScopes],
                retryable: false,
            );
        }

        // The page access token is stored in token_meta after OAuth.
        $pageToken = data_get($account->token_meta, 'page_access_token', $account->access_token);
        $pageId = $account->provider_account_id;
        $graphVersion = $credentials['graph_version'] ?? 'v21.0';
        $base = "https://graph.facebook.com/{$graphVersion}/{$pageId}";

        $firstImage = collect($payload->media)->first(fn ($m) => $m->isImage());

        if ($firstImage) {
            $response = Http::asMultipart()
                ->attach('source', $firstImage->contents(), 'image')
                ->post("{$base}/photos", [
                    'caption' => $payload->content,
                    'access_token' => $pageToken,
                ]);
        } else {
            $response = Http::asForm()->post("{$base}/feed", array_filter([
                'message' => $payload->content,
                'link' => $payload->link,
                'access_token' => $pageToken,
            ]));
        }

        if (! $response->successful()) {
            $errorCode = (int) $response->json('error.code');
            $message = $response->json('error.message') ?? 'Facebook Graph API error';

            if ($errorCode === 200) {
                $message = 'Facebook denied publishing permission. Add pages_manage_posts and pages_read_engagement to the Meta login configuration, then reconnect this Page.';
            }

            return PublishResult::failure(
                $message,
                $response->json() ?? [],
                retryable: ! in_array($errorCode, [100, 190, 200], true),
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
        $graphVersion = $this->credentials()['graph_version'] ?? 'v21.0';
        $response = Http::get("https://graph.facebook.com/{$graphVersion}/{$providerPostId}", [
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
