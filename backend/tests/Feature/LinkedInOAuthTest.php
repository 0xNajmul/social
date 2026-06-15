<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\LinkedInProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class LinkedInOAuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_linkedin_profile_connect_uses_profile_scopes(): void
    {
        config()->set('services.linkedin', $this->credentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'linkedin_profile',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://www.linkedin.com/oauth/v2/authorization?', $url);
        $this->assertSame('linkedin-client-id', $query['client_id']);
        $this->assertSame('openid profile email w_member_social', $query['scope']);
        $this->assertSame('http://localhost:8000/api/oauth/linkedin/callback', $query['redirect_uri']);
    }

    public function test_linkedin_page_connect_uses_organization_scopes(): void
    {
        config()->set('services.linkedin', $this->credentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'linkedin_page',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        parse_str(parse_url($response->json('redirect_url'), PHP_URL_QUERY), $query);

        $this->assertSame(
            'openid profile email rw_organization_admin w_organization_social',
            $query['scope'],
        );
    }

    public function test_linkedin_profile_callback_connects_the_member(): void
    {
        config()->set('services.linkedin', $this->credentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://www.linkedin.com/oauth/v2/accessToken' => Http::response([
                'access_token' => 'linkedin-member-token',
                'expires_in' => 5184000,
                'scope' => 'openid profile email w_member_social',
            ]),
            'https://api.linkedin.com/v2/userinfo' => Http::response([
                'sub' => 'member-123',
                'name' => 'LinkedIn Creator',
                'picture' => 'https://media.example/member.jpg',
                'email' => 'creator@example.com',
            ]),
        ]);

        $response = $this->get('/api/oauth/linkedin/callback?'.http_build_query([
            'code' => 'linkedin-auth-code',
            'state' => $this->state($workspace->id, $user->id, 'linkedin_profile'),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=linkedin_profile&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'linkedin_profile')
            ->firstOrFail();

        $this->assertSame('member-123', $account->provider_account_id);
        $this->assertSame('linkedin-member-token', $account->access_token);
        $this->assertSame('LinkedIn Creator', $account->name);
        $this->assertSame('https://media.example/member.jpg', $account->avatar_url);
    }

    public function test_linkedin_page_callback_connects_managed_organizations(): void
    {
        config()->set('services.linkedin', $this->credentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://www.linkedin.com/oauth/v2/accessToken' => Http::response([
                'access_token' => 'linkedin-page-token',
                'expires_in' => 5184000,
            ]),
            'https://api.linkedin.com/v2/userinfo' => Http::response([
                'sub' => 'member-123',
                'name' => 'Page Admin',
            ]),
            'https://api.linkedin.com/rest/organizationAcls*' => Http::response([
                'elements' => [[
                    'organization' => 'urn:li:organization:98765',
                    'role' => 'ADMINISTRATOR',
                    'state' => 'APPROVED',
                ]],
            ]),
            'https://api.linkedin.com/rest/organizations/98765' => Http::response([
                'id' => 98765,
                'localizedName' => 'Postflow Company',
                'vanityName' => 'postflow-company',
            ]),
        ]);

        $response = $this->get('/api/oauth/linkedin/callback?'.http_build_query([
            'code' => 'linkedin-page-code',
            'state' => $this->state($workspace->id, $user->id, 'linkedin_page'),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=linkedin_page&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'linkedin_page')
            ->firstOrFail();

        $this->assertSame('98765', $account->provider_account_id);
        $this->assertSame('Postflow Company', $account->name);
        $this->assertSame('@postflow-company', $account->username);
        $this->assertSame('urn:li:organization:98765', data_get($account->settings, 'organization_urn'));
    }

    public function test_linkedin_publishes_an_uploaded_image_with_current_api_version(): void
    {
        config()->set('services.linkedin', $this->credentials());
        Storage::fake('public');
        Storage::disk('public')->put('images/linkedin.jpg', 'image-bytes');

        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'linkedin_profile',
            'provider_account_id' => 'member-123',
            'name' => 'LinkedIn Creator',
            'access_token' => 'linkedin-member-token',
            'status' => 'active',
        ]);

        Http::fake([
            'https://api.linkedin.com/rest/images?action=initializeUpload' => Http::response([
                'value' => [
                    'uploadUrl' => 'https://upload.linkedin.test/image',
                    'image' => 'urn:li:image:image-123',
                ],
            ]),
            'https://upload.linkedin.test/image' => Http::response([], 201),
            'https://api.linkedin.com/rest/posts' => Http::response([], 201, [
                'x-restli-id' => 'urn:li:share:post-456',
            ]),
        ]);

        $result = app(LinkedInProfileService::class)->publish($account, new PublishPayload(
            content: 'Hello LinkedIn',
            media: [new MediaItem('public', 'images/linkedin.jpg', 'image', 'image/jpeg')],
            link: 'https://example.com/news',
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'LinkedIn publish failed.');
        $this->assertSame('urn:li:share:post-456', $result->providerPostId);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.linkedin.com/rest/posts'
            && $request->hasHeader('LinkedIn-Version', '202606')
            && $request['author'] === 'urn:li:person:member-123'
            && $request['commentary'] === "Hello LinkedIn\n\nhttps://example.com/news"
            && data_get($request->data(), 'content.media.id') === 'urn:li:image:image-123');
    }

    public function test_linkedin_initializes_uploads_and_finalizes_video_posts(): void
    {
        config()->set('services.linkedin', $this->credentials());
        Storage::fake('public');
        Storage::disk('public')->put('videos/linkedin.mp4', 'video-bytes');

        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'linkedin_profile',
            'provider_account_id' => 'member-123',
            'name' => 'LinkedIn Creator',
            'access_token' => 'linkedin-member-token',
            'status' => 'active',
        ]);

        Http::fake([
            'https://api.linkedin.com/rest/videos?action=initializeUpload' => Http::response([
                'value' => [
                    'video' => 'urn:li:video:video-123',
                    'uploadToken' => '',
                    'uploadInstructions' => [[
                        'uploadUrl' => 'https://upload.linkedin.test/video-part',
                        'firstByte' => 0,
                        'lastByte' => 10,
                    ]],
                ],
            ]),
            'https://upload.linkedin.test/video-part' => Http::response([], 200, ['ETag' => '"part-123"']),
            'https://api.linkedin.com/rest/videos?action=finalizeUpload' => Http::response([]),
            'https://api.linkedin.com/rest/posts' => Http::response([], 201, [
                'x-restli-id' => 'urn:li:share:video-post-456',
            ]),
        ]);

        $result = app(LinkedInProfileService::class)->publish($account, new PublishPayload(
            content: 'LinkedIn video',
            media: [new MediaItem('public', 'videos/linkedin.mp4', 'video', 'video/mp4')],
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'LinkedIn video publish failed.');
        Http::assertSent(fn (Request $request) => str_starts_with(
            $request->url(),
            'https://api.linkedin.com/rest/videos?action=finalizeUpload',
        ) && data_get($request->data(), 'finalizeUploadRequest.uploadedPartIds') === ['part-123']);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://api.linkedin.com/rest/posts'
            && data_get($request->data(), 'content.media.id') === 'urn:li:video:video-123');
    }

    /** @return array<string, mixed> */
    private function credentials(): array
    {
        return [
            'client_id' => 'linkedin-client-id',
            'client_secret' => 'linkedin-client-secret',
            'redirect' => 'http://localhost:8000/api/oauth/linkedin/callback',
            'version' => '202606',
            'profile_scopes' => ['openid', 'profile', 'email', 'w_member_social'],
            'page_scopes' => ['openid', 'profile', 'email', 'rw_organization_admin', 'w_organization_social'],
        ];
    }

    private function state(int $workspaceId, int $userId, string $platform): string
    {
        return encrypt([
            'workspace_id' => $workspaceId,
            'platform' => $platform,
            'user_id' => $userId,
            'nonce' => 'test-nonce',
        ]);
    }
}
