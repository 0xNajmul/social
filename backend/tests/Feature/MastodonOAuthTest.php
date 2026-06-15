<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\MastodonService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class MastodonOAuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_mastodon_connect_uses_instance_authorization_url_and_scopes(): void
    {
        config()->set('services.mastodon', $this->credentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'mastodon',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://mastodon.social/oauth/authorize?', $url);
        $this->assertSame('mastodon-client-id', $query['client_id']);
        $this->assertSame('read:accounts write:statuses write:media', $query['scope']);
        $this->assertSame('http://localhost:8000/api/oauth/mastodon/callback', $query['redirect_uri']);
    }

    public function test_mastodon_callback_connects_the_authorized_account(): void
    {
        config()->set('services.mastodon', $this->credentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://mastodon.social/oauth/token' => Http::response([
                'access_token' => 'mastodon-user-token',
                'token_type' => 'Bearer',
                'scope' => 'read:accounts write:statuses write:media',
            ]),
            'https://mastodon.social/api/v1/accounts/verify_credentials' => Http::response([
                'id' => '10987654321',
                'username' => 'postflow',
                'acct' => 'postflow',
                'display_name' => 'Postflow Creator',
                'avatar_static' => 'https://files.mastodon.social/avatar.png',
                'url' => 'https://mastodon.social/@postflow',
                'source' => ['privacy' => 'public', 'language' => 'en'],
            ]),
        ]);

        $response = $this->get('/api/oauth/mastodon/callback?'.http_build_query([
            'code' => 'mastodon-auth-code',
            'state' => $this->state($workspace->id, $user->id),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=mastodon&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'mastodon')
            ->firstOrFail();

        $this->assertSame('mastodon-user-token', $account->access_token);
        $this->assertSame('Postflow Creator', $account->name);
        $this->assertSame('@postflow', $account->username);
        $this->assertSame('https://mastodon.social', data_get($account->settings, 'instance_url'));
    }

    public function test_mastodon_publishes_text_and_uploaded_media(): void
    {
        config()->set('services.mastodon', $this->credentials());
        Storage::fake('public');
        Storage::disk('public')->put('images/mastodon.jpg', 'image-bytes');

        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'mastodon',
            'provider_account_id' => '10987654321',
            'name' => 'Postflow Creator',
            'access_token' => 'mastodon-user-token',
            'status' => 'active',
            'settings' => ['instance_url' => 'https://mastodon.social', 'default_visibility' => 'public'],
        ]);

        Http::fake([
            'https://mastodon.social/api/v2/media' => Http::response(['id' => 'media-123', 'url' => 'https://files.example/image.jpg']),
            'https://mastodon.social/api/v1/statuses' => Http::response([
                'id' => 'status-456',
                'url' => 'https://mastodon.social/@postflow/status-456',
            ]),
        ]);

        $result = app(MastodonService::class)->publish($account, new PublishPayload(
            content: 'Hello Mastodon',
            media: [new MediaItem('public', 'images/mastodon.jpg', 'image', 'image/jpeg')],
            options: ['visibility' => 'unlisted'],
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'Mastodon publish failed.');
        $this->assertSame('status-456', $result->providerPostId);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://mastodon.social/api/v2/media'
            && $request->method() === 'POST');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://mastodon.social/api/v1/statuses'
            && $request['status'] === 'Hello Mastodon'
            && $request['media_ids'] === ['media-123']
            && $request['visibility'] === 'unlisted');
    }

    /** @return array<string, mixed> */
    private function credentials(): array
    {
        return [
            'instance' => 'https://mastodon.social',
            'client_id' => 'mastodon-client-id',
            'client_secret' => 'mastodon-client-secret',
            'redirect' => 'http://localhost:8000/api/oauth/mastodon/callback',
            'scopes' => ['read:accounts', 'write:statuses', 'write:media'],
        ];
    }

    private function state(int $workspaceId, int $userId): string
    {
        return encrypt([
            'workspace_id' => $workspaceId,
            'platform' => 'mastodon',
            'user_id' => $userId,
            'nonce' => 'test-nonce',
        ]);
    }
}
