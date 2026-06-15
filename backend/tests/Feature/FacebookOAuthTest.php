<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\FacebookPageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class FacebookOAuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_facebook_connect_url_requests_page_permissions(): void
    {
        config()->set('services.facebook', $this->facebookCredentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'facebook_page',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');

        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertSame('facebook-app-id', $query['client_id']);
        $this->assertSame('facebook-config-id', $query['config_id']);
        $this->assertSame('code', $query['response_type']);
        $this->assertSame(
            ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
            tap(explode(',', $query['scope']), fn (&$scopes) => sort($scopes)),
        );
    }

    public function test_facebook_callback_connects_managed_pages(): void
    {
        config()->set('services.facebook', $this->facebookCredentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://graph.facebook.com/v21.0/oauth/access_token*' => Http::sequence()
                ->push(['access_token' => 'short-user-token', 'expires_in' => 3600])
                ->push(['access_token' => 'long-user-token', 'expires_in' => 5184000]),
            'https://graph.facebook.com/v21.0/me/permissions*' => Http::response([
                'data' => [
                    ['permission' => 'pages_show_list', 'status' => 'granted'],
                    ['permission' => 'pages_read_engagement', 'status' => 'granted'],
                    ['permission' => 'pages_manage_posts', 'status' => 'granted'],
                ],
            ]),
            'https://graph.facebook.com/v21.0/me/accounts*' => Http::response([
                'data' => [[
                    'id' => '123456789',
                    'name' => 'Postflow Page',
                    'username' => 'postflowpage',
                    'link' => 'https://www.facebook.com/postflowpage',
                    'picture' => ['data' => ['url' => 'https://example.com/page.jpg']],
                    'access_token' => 'page-access-token',
                    'tasks' => ['CREATE_CONTENT', 'MODERATE'],
                ]],
            ]),
        ]);

        $state = encrypt([
            'workspace_id' => $workspace->id,
            'platform' => 'facebook_page',
            'user_id' => $user->id,
            'nonce' => 'test-nonce',
        ]);

        $response = $this->get('/api/oauth/facebook/callback?'.http_build_query([
            'code' => 'facebook-auth-code',
            'state' => $state,
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=facebook_page&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'facebook_page')
            ->where('provider_account_id', '123456789')
            ->firstOrFail();

        $this->assertSame('Postflow Page', $account->name);
        $this->assertSame('page-access-token', $account->access_token);
        $this->assertSame('long-user-token', data_get($account->token_meta, 'user_access_token'));
        $this->assertNotNull(data_get($account->token_meta, 'permissions_verified_at'));
    }

    public function test_facebook_callback_rejects_missing_publish_permissions(): void
    {
        config()->set('services.facebook', $this->facebookCredentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://graph.facebook.com/v21.0/oauth/access_token*' => Http::sequence()
                ->push(['access_token' => 'short-user-token'])
                ->push(['access_token' => 'long-user-token']),
            'https://graph.facebook.com/v21.0/me/permissions*' => Http::response([
                'data' => [
                    ['permission' => 'pages_show_list', 'status' => 'granted'],
                    ['permission' => 'public_profile', 'status' => 'granted'],
                ],
            ]),
        ]);

        $state = encrypt([
            'workspace_id' => $workspace->id,
            'platform' => 'facebook_page',
            'user_id' => $user->id,
            'nonce' => 'test-nonce',
        ]);

        $response = $this->get('/api/oauth/facebook/callback?'.http_build_query([
            'code' => 'facebook-auth-code',
            'state' => $state,
        ]));

        $location = urldecode($response->headers->get('Location'));
        $this->assertStringContainsString('Facebook did not grant: pages_read_engagement, pages_manage_posts.', $location);
        $this->assertStringContainsString('configuration facebook-config-id', $location);
        $this->assertDatabaseMissing('social_accounts', ['platform' => 'facebook_page']);
    }

    public function test_unverified_facebook_page_requires_reconnection_before_publish(): void
    {
        config()->set('services.facebook', $this->facebookCredentials());
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        Http::fake();

        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'facebook_page',
            'provider_account_id' => '123456789',
            'name' => 'Unverified Page',
            'access_token' => 'page-token',
            'token_meta' => [
                'page_access_token' => 'page-token',
                'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
            ],
            'status' => 'active',
        ]);

        $result = app(FacebookPageService::class)->publish($account, new PublishPayload('Hello Facebook'));

        $this->assertFalse($result->success);
        $this->assertFalse($result->retryable);
        $this->assertStringContainsString('Reconnect this Facebook Page', $result->errorMessage);
        Http::assertNothingSent();
    }

    /** @return array<string, mixed> */
    protected function facebookCredentials(): array
    {
        return [
            'client_id' => 'facebook-app-id',
            'client_secret' => 'facebook-app-secret',
            'redirect' => 'http://localhost:8000/api/oauth/facebook/callback',
            'config_id' => 'facebook-config-id',
            'graph_version' => 'v21.0',
            'scopes' => ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
        ];
    }
}
