<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\PinterestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class PinterestAutomationTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_pinterest_oauth_requests_board_and_pin_scopes(): void
    {
        config()->set('services.pinterest', $this->credentials(accessToken: null));
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'pinterest',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://www.pinterest.com/oauth/?', $url);
        $this->assertSame('pinterest-client-id', $query['client_id']);
        $this->assertSame('boards:read,pins:read,pins:write,user_accounts:read', $query['scope']);
        $this->assertSame('http://localhost:8000/api/oauth/pinterest/callback', $query['redirect_uri']);
    }

    public function test_configured_token_connects_each_pinterest_board_as_a_target(): void
    {
        config()->set('services.pinterest', $this->credentials());
        $user = $this->actingAsUser();

        Http::fake([
            'https://api.pinterest.com/v5/user_account' => Http::response([
                'id' => 'user-123',
                'username' => 'postflow',
                'account_type' => 'BUSINESS',
                'profile_image' => 'https://images.example/avatar.jpg',
            ]),
            'https://api.pinterest.com/v5/boards*' => Http::response([
                'items' => [
                    ['id' => 'board-1', 'name' => 'Marketing Ideas', 'privacy' => 'PUBLIC'],
                    ['id' => 'board-2', 'name' => 'Product Launches', 'privacy' => 'PUBLIC'],
                ],
            ]),
        ]);

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'pinterest',
        ], $this->workspaceHeaders($user));

        $response->assertCreated()
            ->assertJsonPath('mode', 'credentials')
            ->assertJsonPath('connected_count', 2);

        $this->assertDatabaseHas('social_accounts', [
            'platform' => 'pinterest',
            'provider_account_id' => 'board-1',
            'name' => 'Marketing Ideas',
        ]);
        $this->assertDatabaseHas('social_accounts', [
            'platform' => 'pinterest',
            'provider_account_id' => 'board-2',
            'name' => 'Product Launches',
        ]);

        $account = SocialAccount::where('provider_account_id', 'board-1')->firstOrFail();
        $this->assertSame('configured-pinterest-token', $account->access_token);
        $this->assertSame('board-1', data_get($account->settings, 'board_id'));
    }

    public function test_rejected_configured_token_falls_back_to_oauth(): void
    {
        config()->set('services.pinterest', $this->credentials());
        $user = $this->actingAsUser();

        Http::fake([
            'https://api.pinterest.com/v5/user_account' => Http::response([
                'code' => 2,
                'message' => 'Authentication failed.',
            ], 401),
        ]);

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'pinterest',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $this->assertStringStartsWith(
            'https://www.pinterest.com/oauth/?',
            $response->json('redirect_url'),
        );
    }

    public function test_pinterest_callback_exchanges_code_and_connects_boards(): void
    {
        config()->set('services.pinterest', $this->credentials(accessToken: null));
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://api.pinterest.com/v5/oauth/token' => Http::response([
                'access_token' => 'pina-access-token',
                'refresh_token' => 'pinr-refresh-token',
                'expires_in' => 2592000,
                'refresh_token_expires_in' => 5184000,
                'scope' => 'boards:read pins:read pins:write user_accounts:read',
                'token_type' => 'bearer',
            ]),
            'https://api.pinterest.com/v5/user_account' => Http::response([
                'id' => 'user-123',
                'username' => 'postflow',
                'account_type' => 'BUSINESS',
            ]),
            'https://api.pinterest.com/v5/boards*' => Http::response([
                'items' => [['id' => 'board-1', 'name' => 'Marketing Ideas']],
            ]),
        ]);

        $response = $this->get('/api/oauth/pinterest/callback?'.http_build_query([
            'code' => 'pinterest-auth-code',
            'state' => $this->state($workspace->id, $user->id),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=pinterest&connected_count=1');

        $account = SocialAccount::where('platform', 'pinterest')->firstOrFail();
        $this->assertSame('pina-access-token', $account->access_token);
        $this->assertSame('pinr-refresh-token', $account->refresh_token);
        $this->assertNotNull($account->token_expires_at);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.pinterest.com/v5/oauth/token'
            && $request['grant_type'] === 'authorization_code'
            && $request['redirect_uri'] === 'http://localhost:8000/api/oauth/pinterest/callback');
    }

    public function test_pinterest_publishes_a_local_image_pin_to_the_connected_board(): void
    {
        config()->set('services.pinterest', $this->credentials());
        Storage::fake('public');
        Storage::disk('public')->put('images/pin.jpg', 'image-bytes');
        $account = $this->pinterestAccount();

        Http::fake([
            'https://api.pinterest.com/v5/pins' => Http::response([
                'id' => 'pin-456',
                'title' => 'Launch day',
            ], 201),
        ]);

        $result = app(PinterestService::class)->publish($account, new PublishPayload(
            content: 'A new launch announcement',
            media: [new MediaItem('public', 'images/pin.jpg', 'image', 'image/jpeg')],
            link: 'https://example.com/launch',
            options: ['pinterest_title' => 'Launch day', 'alt_text' => 'Product launch artwork'],
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'Pinterest publish failed.');
        $this->assertSame('pin-456', $result->providerPostId);
        $this->assertSame('https://www.pinterest.com/pin/pin-456/', $result->permalink);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.pinterest.com/v5/pins'
            && $request['board_id'] === 'board-1'
            && $request['title'] === 'Launch day'
            && $request['link'] === 'https://example.com/launch'
            && data_get($request->data(), 'media_source.source_type') === 'image_base64'
            && data_get($request->data(), 'media_source.data') === base64_encode('image-bytes'));
    }

    public function test_pinterest_uploads_video_before_creating_the_pin(): void
    {
        config()->set('services.pinterest', $this->credentials());
        Storage::fake('public');
        Storage::disk('public')->put('videos/pin.mp4', 'video-bytes');
        $account = $this->pinterestAccount();

        Http::fake([
            'https://api.pinterest.com/v5/media' => Http::response([
                'media_id' => 'media-123',
                'upload_url' => 'https://upload.pinterest.test/video',
                'upload_parameters' => ['key' => 'upload-key', 'policy' => 'upload-policy'],
            ]),
            'https://upload.pinterest.test/video' => Http::response([], 204),
            'https://api.pinterest.com/v5/media/media-123' => Http::response(['status' => 'succeeded']),
            'https://api.pinterest.com/v5/pins' => Http::response(['id' => 'video-pin-456'], 201),
        ]);

        $result = app(PinterestService::class)->publish($account, new PublishPayload(
            content: 'Pinterest video',
            media: [new MediaItem('public', 'videos/pin.mp4', 'video', 'video/mp4')],
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'Pinterest video publish failed.');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.pinterest.com/v5/pins'
            && data_get($request->data(), 'media_source.source_type') === 'video_id'
            && data_get($request->data(), 'media_source.media_id') === 'media-123');
    }

    public function test_pinterest_refreshes_continuous_refresh_tokens(): void
    {
        config()->set('services.pinterest', $this->credentials());
        $account = $this->pinterestAccount(['refresh_token' => 'old-refresh-token']);

        Http::fake([
            'https://api.pinterest.com/v5/oauth/token' => Http::response([
                'access_token' => 'fresh-access-token',
                'refresh_token' => 'fresh-refresh-token',
                'expires_in' => 2592000,
                'refresh_token_expires_in' => 5184000,
                'scope' => 'boards:read pins:read pins:write user_accounts:read',
            ]),
        ]);

        $profile = app(PinterestService::class)->refreshToken($account);

        $this->assertSame('fresh-access-token', $profile?->accessToken);
        $this->assertSame('fresh-refresh-token', $profile?->refreshToken);
        $this->assertTrue($profile?->expiresAt?->getTimestamp() > now()->getTimestamp());
    }

    /** @return array<string, mixed> */
    private function credentials(?string $accessToken = 'configured-pinterest-token'): array
    {
        return [
            'client_id' => 'pinterest-client-id',
            'client_secret' => 'pinterest-client-secret',
            'redirect' => 'http://localhost:8000/api/oauth/pinterest/callback',
            'access_token' => $accessToken,
            'api_base' => 'https://api.pinterest.com/v5',
            'scopes' => ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'],
        ];
    }

    /** @param array<string, mixed> $overrides */
    private function pinterestAccount(array $overrides = []): SocialAccount
    {
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        return SocialAccount::create(array_merge([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'pinterest',
            'provider_account_id' => 'board-1',
            'name' => 'Marketing Ideas',
            'username' => '@postflow',
            'access_token' => 'pinterest-access-token',
            'status' => 'active',
            'settings' => ['board_id' => 'board-1', 'board_name' => 'Marketing Ideas'],
        ], $overrides));
    }

    private function state(int $workspaceId, int $userId): string
    {
        return encrypt([
            'workspace_id' => $workspaceId,
            'platform' => 'pinterest',
            'user_id' => $userId,
            'nonce' => 'test-nonce',
        ]);
    }
}
