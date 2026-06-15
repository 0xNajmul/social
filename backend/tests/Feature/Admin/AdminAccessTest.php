<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_non_admin_cannot_access_admin_dashboard(): void
    {
        $user = $this->actingAsUser();

        $response = $this->getJson('/api/admin/dashboard');

        $response->assertForbidden();
    }

    public function test_admin_can_access_dashboard(): void
    {
        $this->seedBasics();

        $admin = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/dashboard');

        $response->assertOk()
            ->assertJsonStructure([
                'stats' => ['users', 'workspaces', 'active_subscriptions'],
                'revenue' => ['mrr', 'arr', 'currency'],
                'signups',
                'plan_distribution',
                'health',
            ]);
    }
}
