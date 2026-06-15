<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class InstagramService extends AbstractPlatformService
{
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
        $token = $account->access_token;
        $credentials = $this->credentials();
        $requiredScopes = $credentials['scopes'] ?? ['instagram_business_basic', 'instagram_business_content_publish'];
        $grantedScopes = data_get($account->token_meta, 'scopes', []);
        $missingScopes = array_values(array_diff($requiredScopes, $grantedScopes));

        if (! data_get($account->token_meta, 'permissions_verified_at') || $missingScopes) {
            return PublishResult::failure(
                'Reconnect this Instagram account to verify publishing permissions.'
                .($missingScopes ? ' Missing: '.implode(', ', $missingScopes).'.' : ''),
                ['missing_permissions' => $missingScopes],
                retryable: false,
            );
        }

        $graphVersion = $credentials['graph_version'] ?? 'v21.0';
        $authProvider = data_get($account->token_meta, 'auth_provider', 'facebook');
        $graphHost = $authProvider === 'instagram' ? 'graph.instagram.com' : 'graph.facebook.com';
        $token = data_get($account->token_meta, 'page_access_token', $account->access_token);
        $base = "https://{$graphHost}/{$graphVersion}/{$igUserId}";

        $media = collect($payload->media)->first();
        if (! $media || ! $media->url) {
            return PublishResult::failure('Instagram requires a publicly accessible image or video URL.', retryable: false);
        }

        $container = Http::asForm()->post("{$base}/media", array_filter([
            'image_url' => $media->isImage() ? $media->url : null,
            'video_url' => $media->isVideo() ? $media->url : null,
            'media_type' => $media->isVideo() ? 'REELS' : null,
            'caption' => $payload->content,
            'access_token' => $token,
        ]));

        if (! $container->successful()) {
            $errorCode = (int) $container->json('error.code');
            return PublishResult::failure(
                $container->json('error.message') ?? 'Instagram container error',
                $container->json() ?? [],
                retryable: ! in_array($errorCode, [10, 100, 190, 200], true),
            );
        }

        $publish = Http::asForm()->post("{$base}/media_publish", [
            'creation_id' => $container->json('id'),
            'access_token' => $token,
        ]);

        if (! $publish->successful()) {
            $errorCode = (int) $publish->json('error.code');
            return PublishResult::failure(
                $publish->json('error.message') ?? 'Instagram publish error',
                $publish->json() ?? [],
                retryable: ! in_array($errorCode, [10, 100, 190, 200], true),
            );
        }

        $id = (string) $publish->json('id');

        return PublishResult::success($id, "https://instagram.com/p/{$id}", $publish->json() ?? []);
    }
}
