<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\TikTokService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class TikTokOAuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_tiktok_connect_requires_an_https_redirect_uri(): void
    {
        config()->set('services.tiktok', array_merge($this->tiktokCredentials(), [
            'redirect' => 'http://localhost:8000/api/oauth/tiktok/callback',
        ]));
        $user = $this->actingAsUser();

        $this->postJson('/api/social/accounts/connect', [
            'platform' => 'tiktok',
        ], $this->workspaceHeaders($user))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'TikTok requires an HTTPS redirect URI.');
    }

    public function test_tiktok_connect_uses_login_kit_client_key_and_scopes(): void
    {
        config()->set('services.tiktok', $this->tiktokCredentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'tiktok',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://www.tiktok.com/v2/auth/authorize/?', $url);
        $this->assertSame('tiktok-client-key', $query['client_key']);
        $this->assertArrayNotHasKey('client_id', $query);
        $this->assertSame('https://postflow.test/api/oauth/tiktok/callback', $query['redirect_uri']);
        $this->assertSame('user.info.basic,video.publish', $query['scope']);
    }

    public function test_tiktok_callback_connects_creator_and_saves_posting_settings(): void
    {
        config()->set('services.tiktok', $this->tiktokCredentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://open.tiktokapis.com/v2/oauth/token/' => Http::response([
                'access_token' => 'tiktok-access-token',
                'expires_in' => 86400,
                'open_id' => 'creator-open-id',
                'refresh_expires_in' => 31536000,
                'refresh_token' => 'tiktok-refresh-token',
                'scope' => 'user.info.basic,video.publish',
            ]),
            'https://open.tiktokapis.com/v2/user/info/*' => Http::response([
                'data' => ['user' => [
                    'open_id' => 'creator-open-id',
                    'union_id' => 'creator-union-id',
                    'avatar_url' => 'https://example.com/tiktok.jpg',
                    'display_name' => 'Postflow Creator',
                ]],
                'error' => ['code' => 'ok', 'message' => ''],
            ]),
            'https://open.tiktokapis.com/v2/post/publish/creator_info/query/' => Http::response([
                'data' => $this->creatorInfo(),
                'error' => ['code' => 'ok', 'message' => ''],
            ]),
        ]);

        $response = $this->get('/api/oauth/tiktok/callback?'.http_build_query([
            'code' => 'tiktok-auth-code',
            'state' => $this->state($workspace->id, $user->id),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=tiktok&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'tiktok')
            ->where('provider_account_id', 'creator-open-id')
            ->firstOrFail();

        $this->assertSame('tiktok-access-token', $account->access_token);
        $this->assertSame('tiktok-refresh-token', $account->refresh_token);
        $this->assertSame('Postflow Creator', $account->name);
        $this->assertSame('@postflowcreator', $account->username);
        $this->assertSame(['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], data_get($account->settings, 'creator_info.privacy_level_options'));
        $this->assertSame(['user.info.basic', 'video.publish'], data_get($account->token_meta, 'scopes'));

        Http::assertSent(fn (Request $request) => $request->url() === 'https://open.tiktokapis.com/v2/oauth/token/'
            && $request['client_key'] === 'tiktok-client-key'
            && $request['redirect_uri'] === 'https://postflow.test/api/oauth/tiktok/callback');
    }

    public function test_tiktok_refresh_uses_the_rotated_refresh_token(): void
    {
        config()->set('services.tiktok', $this->tiktokCredentials());
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'tiktok',
            'provider_account_id' => 'creator-open-id',
            'name' => 'Postflow Creator',
            'access_token' => 'old-access-token',
            'refresh_token' => 'old-refresh-token',
            'status' => 'active',
        ]);

        Http::fake([
            'https://open.tiktokapis.com/v2/oauth/token/' => Http::response([
                'access_token' => 'new-access-token',
                'expires_in' => 86400,
                'refresh_token' => 'new-refresh-token',
                'refresh_expires_in' => 31536000,
                'scope' => 'user.info.basic,video.publish',
            ]),
        ]);

        $profile = app(TikTokService::class)->refreshToken($account);

        $this->assertSame('new-access-token', $profile?->accessToken);
        $this->assertSame('new-refresh-token', $profile?->refreshToken);
        $this->assertSame(['user.info.basic', 'video.publish'], $profile?->tokenMeta['scopes']);
        Http::assertSent(fn (Request $request) => $request['grant_type'] === 'refresh_token'
            && $request['refresh_token'] === 'old-refresh-token');
    }

    public function test_tiktok_publish_initializes_and_uploads_a_video_file(): void
    {
        config()->set('services.tiktok', $this->tiktokCredentials());
        Storage::fake('public');
        Storage::disk('public')->put('videos/tiktok.mp4', str_repeat('v', 1024));

        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'tiktok',
            'provider_account_id' => 'creator-open-id',
            'name' => 'Postflow Creator',
            'access_token' => 'tiktok-access-token',
            'refresh_token' => 'tiktok-refresh-token',
            'status' => 'active',
        ]);

        Http::fake([
            'https://open.tiktokapis.com/v2/post/publish/creator_info/query/' => Http::response([
                'data' => $this->creatorInfo(),
                'error' => ['code' => 'ok', 'message' => ''],
            ]),
            'https://open.tiktokapis.com/v2/post/publish/video/init/' => Http::response([
                'data' => [
                    'publish_id' => 'publish-id-123',
                    'upload_url' => 'https://upload.tiktok.test/video',
                ],
                'error' => ['code' => 'ok', 'message' => ''],
            ]),
            'https://upload.tiktok.test/video' => Http::response([], 201),
        ]);

        $media = new MediaItem('public', 'videos/tiktok.mp4', 'video', 'video/mp4');
        $result = app(TikTokService::class)->publish($account, new PublishPayload(
            content: 'A TikTok caption',
            media: [$media],
            options: [
                'privacy_level' => 'SELF_ONLY',
                'disable_comment' => false,
                'disable_duet' => true,
                'disable_stitch' => false,
                'brand_content_toggle' => false,
                'brand_organic_toggle' => false,
                'is_aigc' => true,
                'tiktok_consent' => true,
            ],
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'TikTok publish failed.');
        $this->assertSame('publish-id-123', $result->providerPostId);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://open.tiktokapis.com/v2/post/publish/video/init/'
            && $request['post_info']['privacy_level'] === 'SELF_ONLY'
            && $request['post_info']['disable_duet'] === true
            && $request['post_info']['is_aigc'] === true
            && $request['source_info']['source'] === 'FILE_UPLOAD'
            && $request['source_info']['video_size'] === 1024
            && $request['source_info']['total_chunk_count'] === 1);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://upload.tiktok.test/video'
            && $request->method() === 'PUT'
            && $request->hasHeader('Content-Range', 'bytes 0-1023/1024')
            && $request->hasHeader('Content-Length', '1024'));
    }

    protected function state(int $workspaceId, int $userId): string
    {
        return encrypt([
            'workspace_id' => $workspaceId,
            'platform' => 'tiktok',
            'user_id' => $userId,
            'nonce' => 'test-nonce',
        ]);
    }

    /** @return array<string, mixed> */
    protected function tiktokCredentials(): array
    {
        return [
            'client_id' => 'tiktok-client-key',
            'client_secret' => 'tiktok-client-secret',
            'redirect' => 'https://postflow.test/api/oauth/tiktok/callback',
            'scopes' => ['user.info.basic', 'video.publish'],
        ];
    }

    /** @return array<string, mixed> */
    protected function creatorInfo(): array
    {
        return [
            'creator_avatar_url' => 'https://example.com/tiktok.jpg',
            'creator_username' => '@postflowcreator',
            'privacy_level_options' => ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
            'comment_disabled' => false,
            'duet_disabled' => false,
            'stitch_disabled' => false,
            'max_video_post_duration_sec' => 600,
        ];
    }
}
