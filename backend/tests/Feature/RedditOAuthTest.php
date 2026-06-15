<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Platforms\RedditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class RedditOAuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_reddit_connect_requests_permanent_automation_scopes(): void
    {
        config()->set('services.reddit', $this->credentials());
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'reddit',
        ], $this->workspaceHeaders($user));

        $response->assertOk()->assertJsonPath('mode', 'oauth');
        $url = $response->json('redirect_url');
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://www.reddit.com/api/v1/authorize?', $url);
        $this->assertSame('permanent', $query['duration']);
        $this->assertSame('identity mysubreddits read submit edit', $query['scope']);
        $this->assertSame('http://localhost:8000/api/oauth/reddit/callback', $query['redirect_uri']);
    }

    public function test_reddit_callback_connects_account_and_discovers_communities(): void
    {
        config()->set('services.reddit', $this->credentials());
        config()->set('app.frontend_url', 'http://localhost:5173');
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        Http::fake([
            'https://www.reddit.com/api/v1/access_token' => Http::response([
                'access_token' => 'reddit-access-token',
                'refresh_token' => 'reddit-refresh-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
                'scope' => 'identity mysubreddits read submit edit',
            ]),
            'https://oauth.reddit.com/api/v1/me*' => Http::response([
                'id' => 'abc123',
                'name' => 'postflow_user',
                'icon_img' => 'https://styles.redditmedia.com/avatar.png',
                'link_karma' => 42,
                'comment_karma' => 84,
                'has_verified_email' => true,
            ]),
            'https://oauth.reddit.com/subreddits/mine/subscriber*' => Http::response($this->communityListing('socialmedia', 'Social Media')),
            'https://oauth.reddit.com/subreddits/mine/moderator*' => Http::response($this->communityListing('postflow', 'Postflow')),
        ]);

        $response = $this->get('/api/oauth/reddit/callback?'.http_build_query([
            'code' => 'reddit-auth-code',
            'state' => $this->state($workspace->id, $user->id),
        ]));

        $response->assertRedirect('http://localhost:5173/app/accounts?connected=reddit&connected_count=1');

        $account = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', 'reddit')
            ->firstOrFail();

        $this->assertSame('reddit-access-token', $account->access_token);
        $this->assertSame('reddit-refresh-token', $account->refresh_token);
        $this->assertSame('postflow_user', $account->name);
        $this->assertSame('u/postflow_user', $account->username);
        $this->assertSame(['postflow', 'socialmedia'], collect($account->settings['communities'])->pluck('name')->all());

        Http::assertSent(fn (Request $request) => $request->url() === 'https://www.reddit.com/api/v1/access_token'
            && $request->hasHeader('User-Agent', 'web:postflow.test:v1.0.0 (by /u/postflow_owner)'));
    }

    public function test_reddit_publishes_a_scheduled_self_post(): void
    {
        config()->set('services.reddit', $this->credentials());
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'reddit',
            'provider_account_id' => 'abc123',
            'name' => 'postflow_user',
            'username' => 'u/postflow_user',
            'access_token' => 'reddit-access-token',
            'refresh_token' => 'reddit-refresh-token',
            'token_expires_at' => now()->addHour(),
            'status' => 'active',
        ]);

        Http::fake([
            'https://www.reddit.com/api/v1/access_token' => Http::response([
                'access_token' => 'fresh-reddit-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
                'scope' => 'identity mysubreddits read submit edit',
            ]),
            'https://oauth.reddit.com/api/submit' => Http::response([
                'json' => [
                    'errors' => [],
                    'data' => [
                        'id' => 'post123',
                        'name' => 't3_post123',
                        'url' => 'https://www.reddit.com/r/socialmedia/comments/post123/automated_post/',
                    ],
                ],
            ]),
        ]);

        $result = app(RedditService::class)->publish($account, new PublishPayload(
            content: 'This body was published by the scheduler.',
            options: [
                'subreddit' => 'r/socialmedia',
                'reddit_title' => 'Automated post',
                'reddit_post_type' => 'self',
                'sendreplies' => true,
                'spoiler' => false,
                'nsfw' => false,
            ],
            scheduledAt: now()->addHour(),
        ));

        $this->assertTrue($result->success, $result->errorMessage ?? 'Reddit publish failed.');
        $this->assertSame('t3_post123', $result->providerPostId);

        Http::assertSent(fn (Request $request) => $request->url() === 'https://oauth.reddit.com/api/submit'
            && $request['kind'] === 'self'
            && $request['sr'] === 'socialmedia'
            && $request['title'] === 'Automated post'
            && $request['text'] === 'This body was published by the scheduler.'
            && $request->hasHeader('User-Agent', 'web:postflow.test:v1.0.0 (by /u/postflow_owner)'));
    }

    public function test_reddit_refreshes_an_expired_access_token(): void
    {
        config()->set('services.reddit', $this->credentials());
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $account = SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => 'reddit',
            'provider_account_id' => 'abc123',
            'name' => 'postflow_user',
            'access_token' => 'expired-token',
            'refresh_token' => 'reddit-refresh-token',
            'token_expires_at' => now()->subMinute(),
            'status' => 'active',
        ]);

        Http::fake([
            'https://www.reddit.com/api/v1/access_token' => Http::response([
                'access_token' => 'fresh-reddit-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
                'scope' => 'identity mysubreddits read submit edit',
            ]),
        ]);

        $profile = app(RedditService::class)->refreshToken($account);

        $this->assertSame('fresh-reddit-token', $profile?->accessToken);
        $this->assertSame('reddit-refresh-token', $profile?->refreshToken);
        $this->assertTrue($profile?->expiresAt?->getTimestamp() > now()->getTimestamp());
    }

    /** @return array<string, mixed> */
    private function credentials(): array
    {
        return [
            'client_id' => 'reddit-client-id',
            'client_secret' => 'reddit-client-secret',
            'redirect' => 'http://localhost:8000/api/oauth/reddit/callback',
            'api_base' => 'https://oauth.reddit.com',
            'user_agent' => 'web:postflow.test:v1.0.0 (by /u/postflow_owner)',
            'scopes' => ['identity', 'mysubreddits', 'read', 'submit', 'edit'],
        ];
    }

    /** @return array<string, mixed> */
    private function communityListing(string $name, string $title): array
    {
        return [
            'data' => [
                'children' => [[
                    'data' => [
                        'display_name' => $name,
                        'title' => $title,
                        'community_icon' => "https://styles.redditmedia.com/{$name}.png",
                        'over18' => false,
                        'submission_type' => 'any',
                    ],
                ]],
            ],
        ];
    }

    private function state(int $workspaceId, int $userId): string
    {
        return encrypt([
            'workspace_id' => $workspaceId,
            'platform' => 'reddit',
            'user_id' => $userId,
            'nonce' => 'test-nonce',
        ]);
    }
}
