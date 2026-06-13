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

    public function test_user_can_connect_demo_social_account(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/social/accounts/connect', [
            'platform' => 'twitter',
            'name' => 'My Twitter',
        ], $this->workspaceHeaders($user));

        $response->assertCreated()
            ->assertJsonPath('data.platform', 'twitter');

        $this->assertDatabaseHas('social_accounts', [
            'platform' => 'twitter',
            'name' => 'My Twitter',
        ]);
    }

    public function test_dashboard_returns_stats(): void
    {
        $user = $this->actingAsUser();
        $this->connectDemoAccount($user);

        $response = $this->getJson('/api/dashboard', $this->workspaceHeaders($user));

        $response->assertOk()
            ->assertJsonStructure([
                'stats' => ['scheduled', 'published', 'failed', 'accounts'],
                'upcoming',
                'usage',
                'recent_activity',
            ]);
    }
}
