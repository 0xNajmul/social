<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class WorkspaceTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_user_can_fetch_active_workspace(): void
    {
        $user = $this->actingAsUser();

        $response = $this->getJson('/api/workspace', $this->workspaceHeaders($user));

        $response->assertOk()
            ->assertJsonStructure(['data' => ['id', 'name', 'slug', 'timezone']]);
    }

    public function test_user_can_list_social_platforms(): void
    {
        $user = $this->actingAsUser();

        $response = $this->getJson('/api/social/platforms', $this->workspaceHeaders($user));

        $response->assertOk()
            ->assertJsonStructure(['data' => [['key', 'label', 'capabilities']]]);
    }

    public function test_user_can_connect_demo_social_accounts_for_common_oauth_platforms(): void
    {
        $platforms = [
            ['twitter', 'twitter'],
            ['reddit', 'reddit'],
            ['thread', 'threads'],
            ['threads', 'threads'],
            ['snapchat', 'snapchat'],
        ];

        foreach ($platforms as [$requestedPlatform, $storedPlatform]) {
            $user = $this->actingAsUser();

            $response = $this->postJson('/api/social/accounts/connect', [
                'platform' => $requestedPlatform,
            ], $this->workspaceHeaders($user));

            $response->assertCreated()
                ->assertJsonPath('data.platform', $storedPlatform)
                ->assertJsonPath('mode', 'demo');

            $this->assertDatabaseHas('social_accounts', [
                'platform' => $storedPlatform,
            ]);
        }
    }

    public function test_dashboard_returns_stats(): void
    {
        $user = $this->actingAsUser();
        $this->connectDemoAccount($user);

        $response = $this->getJson('/api/dashboard', $this->workspaceHeaders($user));

        $response->assertOk()
            ->assertJsonStructure([
                'stats' => ['scheduled', 'published_this_month', 'failed', 'connected_accounts'],
                'upcoming',
                'usage',
                'recent_activity',
            ]);
    }
}
