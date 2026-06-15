<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\BlueskyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class BlueskyAutomationTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_bluesky_connects_with_a_handle_and_server_side_app_password(): void
    {
        config()->set('services.bluesky', $this->credentials());
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $accessJwt = $this->jwt(now()->addMinutes(10)->timestamp);

        Http::fake([
            'https://bsky.social/xrpc/com.atproto.server.createSession' => Http::response([
                'did' => 'did:plc:creator123',
                'handle' => 'creator.bsky.social',
                'email' => 'creator@example.com',
                'accessJwt' => $accessJwt,
                'refreshJwt' => 'refresh-jwt',
            ]),
            'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile*' => Http::response([
                'did' => 'did:plc:creator123',
                'handle' => 'creator.bsky.social',
                'displayName' => 'Bluesky Creator',
                'avatar' => 'https://cdn.bsky.app/avatar.jpg',
            ]),
        ]);

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'bluesky',
            'identifier' => 'creator.bsky.social',
        ], $this->workspaceHeaders($user));

        $response->assertCreated()->assertJsonPath('mode', 'credentials');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'bluesky')
            ->firstOrFail();

        $this->assertSame('did:plc:creator123', $account->provider_account_id);
        $this->assertSame('Bluesky Creator', $account->name);
        $this->assertSame('@creator.bsky.social', $account->username);
        $this->assertSame($accessJwt, $account->access_token);
        $this->assertSame('refresh-jwt', $account->refresh_token);
        $this->assertSame('https://bsky.social', data_get($account->settings, 'pds_url'));

        Http::assertSent(fn (Request $request) => $request->url() === 'https://bsky.social/xrpc/com.atproto.server.createSession'
            && $request['identifier'] === 'creator.bsky.social'
            && $request['password'] === 'test-app-password');
    }

    public function test_bluesky_refreshes_its_short_lived_session(): void
    {
        config()->set('services.bluesky', $this->credentials());
        $account = new SocialAccount([
            'platform' => 'bluesky',
            'provider_account_id' => 'did:plc:creator123',
            'name' => 'Bluesky Creator',
            'username' => '@creator.bsky.social',
            'refresh_token' => 'old-refresh-jwt',
            'settings' => ['pds_url' => 'https://bsky.social'],
            'token_meta' => ['handle' => 'creator.bsky.social'],
        ]);
        $newAccessJwt = $this->jwt(now()->addMinutes(10)->timestamp);

        Http::fake([
            'https://bsky.social/xrpc/com.atproto.server.refreshSession' => Http::response([
                'did' => 'did:plc:creator123',
                'handle' => 'creator.bsky.social',
                'accessJwt' => $newAccessJwt,
                'refreshJwt' => 'new-refresh-jwt',
            ]),
        ]);

        $profile = app(BlueskyService::class)->refreshToken($account);

        $this->assertNotNull($profile);
        $this->assertSame($newAccessJwt, $profile->accessToken);
        $this->assertSame('new-refresh-jwt', $profile->refreshToken);
        $this->assertNotNull($profile->expiresAt);
        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer old-refresh-jwt'));
    }

    public function test_bluesky_publishes_link_facets_and_image_blobs(): void
    {
        config()->set('services.bluesky', $this->credentials());
        Storage::fake('public');
        Storage::disk('public')->put('images/sky.jpg', 'image-bytes');

        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'bluesky',
            'provider_account_id' => 'did:plc:creator123',
            'name' => 'Bluesky Creator',
            'username' => '@creator.bsky.social',
            'access_token' => 'access-jwt',
            'refresh_token' => 'refresh-jwt',
            'token_meta' => ['handle' => 'creator.bsky.social'],
            'token_expires_at' => now()->addDays(30),
            'status' => 'active',
            'settings' => ['pds_url' => 'https://bsky.social'],
        ]);

        Http::fake([
            'https://bsky.social/xrpc/com.atproto.repo.uploadBlob' => Http::response([
                'blob' => [
                    '$type' => 'blob',
                    'ref' => ['$link' => 'bafkreiblob123'],
                    'mimeType' => 'image/jpeg',
                    'size' => 11,
                ],
            ]),
            'https://bsky.social/xrpc/com.atproto.repo.createRecord' => Http::response([
                'uri' => 'at://did:plc:creator123/app.bsky.feed.post/3abcxyz',
                'cid' => 'bafyreipost123',
            ]),
        ]);

        $result = app(BlueskyService::class)->publish($account, new PublishPayload(
            content: 'Hello blue sky',
            media: [new MediaItem('public', 'images/sky.jpg', 'image', 'image/jpeg')],
            link: 'https://example.com/news',
            options: ['image_alt_texts' => ['A bright blue sky']],
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'Bluesky publish failed.');
        $this->assertSame('at://did:plc:creator123/app.bsky.feed.post/3abcxyz', $result->providerPostId);
        $this->assertSame('https://bsky.app/profile/creator.bsky.social/post/3abcxyz', $result->permalink);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://bsky.social/xrpc/com.atproto.repo.uploadBlob'
            && $request->hasHeader('Content-Type', 'image/jpeg'));
        Http::assertSent(function (Request $request) {
            if ($request->url() !== 'https://bsky.social/xrpc/com.atproto.repo.createRecord') {
                return false;
            }

            $record = $request['record'];
            $text = "Hello blue sky\n\nhttps://example.com/news";

            return $request['repo'] === 'did:plc:creator123'
                && $record['text'] === $text
                && data_get($record, 'facets.0.index.byteStart') === strlen("Hello blue sky\n\n")
                && data_get($record, 'facets.0.index.byteEnd') === strlen($text)
                && data_get($record, 'embed.images.0.alt') === 'A bright blue sky'
                && data_get($record, 'embed.images.0.image.ref.$link') === 'bafkreiblob123';
        });
    }

    /** @return array<string, string> */
    private function credentials(): array
    {
        return [
            'pds_url' => 'https://bsky.social',
            'app_password' => 'test-app-password',
        ];
    }

    private function jwt(int $expiresAt): string
    {
        $header = rtrim(strtr(base64_encode('{"alg":"none"}'), '+/', '-_'), '=');
        $payload = rtrim(strtr(base64_encode(json_encode(['exp' => $expiresAt])), '+/', '-_'), '=');

        return "{$header}.{$payload}.signature";
    }
}
