<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\InstagramService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class InstagramOAuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_instagram_connect_requires_dedicated_instagram_credentials(): void
    {
        config()->set('services.instagram', [
            'client_id' => null,
            'client_secret' => null,
            'redirect' => 'http://localhost:8000/api/oauth/instagram/callback',
        ]);
        $user = $this->actingAsUser();

        $this->postJson('/api/social/accounts/connect', [
            'platform' => 'instagram',
        ], $this->workspaceHeaders($user))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Instagram Login is not configured. Add the Instagram App ID and App Secret from Meta App Dashboard → Instagram → API setup with Instagram business login.');
    }

    public function test_instagram_connect_uses_instagram_login_scopes(): void
    {
        config()->set('services.instagram', $this->instagramCredentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'instagram',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://www.instagram.com/oauth/authorize?', $url);
        $this->assertSame('instagram-app-id', $query['client_id']);
        $this->assertSame('0', (string) $query['enable_fb_login']);
        $this->assertSame('1', (string) $query['force_authentication']);
        $this->assertSame(
            ['instagram_business_basic', 'instagram_business_content_publish'],
            tap(explode(',', $query['scope']), fn (&$scopes) => sort($scopes)),
        );
    }

    #[DataProvider('professionalAccountProvider')]
    public function test_instagram_callback_connects_business_and_creator_accounts(string $accountType, string $label): void
    {
        config()->set('services.instagram', $this->instagramCredentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://api.instagram.com/oauth/access_token' => Http::response([
                'access_token' => 'short-instagram-token',
                'user_id' => 'app-user-id',
            ]),
            'https://graph.instagram.com/access_token*' => Http::response([
                'access_token' => 'long-instagram-token',
                'expires_in' => 5184000,
            ]),
            'https://graph.instagram.com/v21.0/me*' => Http::response([
                'data' => [[
                    'id' => 'app-scoped-id',
                    'user_id' => '17841400000000000',
                    'username' => 'postflow.pro',
                    'name' => 'Postflow Professional',
                    'account_type' => $accountType,
                    'profile_picture_url' => 'https://example.com/instagram.jpg',
                ]],
            ]),
        ]);

        $response = $this->get('/api/oauth/instagram/callback?'.http_build_query([
            'code' => 'instagram-auth-code',
            'state' => $this->state($workspace->id, $user->id),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=instagram&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'instagram')
            ->where('provider_account_id', '17841400000000000')
            ->firstOrFail();

        $this->assertSame('long-instagram-token', $account->access_token);
        $this->assertSame('@postflow.pro', $account->username);
        $this->assertSame('instagram', data_get($account->token_meta, 'auth_provider'));
        $this->assertSame($accountType, data_get($account->settings, 'account_type'));
        $this->assertSame($label, data_get($account->settings, 'account_type_label'));
    }

    public function test_instagram_callback_rejects_personal_accounts(): void
    {
        config()->set('services.instagram', $this->instagramCredentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://api.instagram.com/oauth/access_token' => Http::response(['access_token' => 'short-token']),
            'https://graph.instagram.com/access_token*' => Http::response(['access_token' => 'long-token']),
            'https://graph.instagram.com/v21.0/me*' => Http::response([
                'id' => 'personal-id',
                'username' => 'personal.user',
                'account_type' => 'PERSONAL',
            ]),
        ]);

        $response = $this->get('/api/oauth/instagram/callback?'.http_build_query([
            'code' => 'instagram-auth-code',
            'state' => $this->state($workspace->id, $user->id),
        ]));

        $this->assertStringContainsString(
            'Only Instagram Business and Creator accounts are supported.',
            urldecode($response->headers->get('Location')),
        );
        $this->assertDatabaseMissing('social_accounts', ['platform' => 'instagram']);
    }

    public function test_instagram_callback_surfaces_meta_error_parameters(): void
    {
        config()->set('app.frontend_url', 'http://localhost:5173');

        $response = $this->get('/api/oauth/instagram/callback?'.http_build_query([
            'error_code' => '200',
            'error_reason' => 'user_denied',
            'error_description' => 'Permissions error: instagram_business_content_publish is unavailable.',
        ]));

        $response->assertRedirect(
            'http://localhost:5173/app/accounts?oauth_error='.
            urlencode('Permissions error: instagram_business_content_publish is unavailable.')
        );
    }

    public function test_instagram_publish_uses_instagram_graph_and_user_token(): void
    {
        config()->set('services.instagram', $this->instagramCredentials());
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'instagram',
            'provider_account_id' => '17841400000000000',
            'name' => 'Postflow Professional',
            'access_token' => 'instagram-user-token',
            'token_meta' => [
                'auth_provider' => 'instagram',
                'scopes' => $this->instagramCredentials()['scopes'],
                'permissions_verified_at' => now()->toIso8601String(),
            ],
            'settings' => ['account_type' => 'BUSINESS'],
            'status' => 'active',
        ]);

        Http::fake([
            'https://graph.instagram.com/v21.0/17841400000000000/media' => Http::response(['id' => 'container-id']),
            'https://graph.instagram.com/v21.0/17841400000000000/media_publish' => Http::response(['id' => 'media-id']),
        ]);

        $media = new MediaItem('public', 'image.jpg', 'image', 'image/jpeg', 'https://example.com/image.jpg');
        $result = app(InstagramService::class)->publish($account, new PublishPayload('Instagram post', [$media]));

        $this->assertTrue($result->success);
        $this->assertSame('media-id', $result->providerPostId);
        Http::assertSent(fn ($request) => $request->url() === 'https://graph.instagram.com/v21.0/17841400000000000/media'
            && $request['access_token'] === 'instagram-user-token');
    }

    public static function professionalAccountProvider(): array
    {
        return [
            'business' => ['BUSINESS', 'Business'],
            'creator' => ['MEDIA_CREATOR', 'Creator'],
        ];
    }

    protected function state(int $workspaceId, int $userId): string
    {
        return encrypt([
            'workspace_id' => $workspaceId,
            'platform' => 'instagram',
            'user_id' => $userId,
            'nonce' => 'test-nonce',
        ]);
    }

    /** @return array<string, mixed> */
    protected function instagramCredentials(): array
    {
        return [
            'client_id' => 'instagram-app-id',
            'client_secret' => 'instagram-app-secret',
            'redirect' => 'http://localhost:8000/api/oauth/instagram/callback',
            'graph_version' => 'v21.0',
            'scopes' => ['instagram_business_basic', 'instagram_business_content_publish'],
        ];
    }
}
