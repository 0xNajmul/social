<?php

namespace Tests\Feature\Admin;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class AdminCrudTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedBasics();
        $this->admin = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($this->admin);
    }

    public function test_admin_can_create_update_and_delete_user(): void
    {
        $userId = $this->postJson('/api/admin/users', [
            'name' => 'Managed User',
            'email' => 'managed@example.com',
            'password' => 'password123',
            'timezone' => 'UTC',
            'locale' => 'en',
            'is_admin' => false,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/admin/users/{$userId}", ['name' => 'Updated User'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated User');

        $this->deleteJson("/api/admin/users/{$userId}")->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $userId]);
    }

    public function test_admin_can_manage_plans(): void
    {
        $payload = [
            'name' => 'Agency',
            'description' => 'Agency plan',
            'price_monthly' => 7900,
            'price_yearly' => 79000,
            'trial_days' => 14,
            'max_workspaces' => 10,
            'max_team_members' => 25,
            'max_social_accounts' => 50,
            'max_scheduled_posts' => 1000,
            'max_monthly_posts' => 5000,
            'max_automations' => 50,
            'max_ai_credits' => 2000,
            'max_storage_mb' => 102400,
            'features' => ['Team collaboration'],
            'is_active' => true,
            'is_featured' => false,
            'sort_order' => 5,
        ];

        $this->postJson('/api/admin/plans', $payload)->assertCreated();
        $plan = Plan::where('slug', 'agency')->firstOrFail();

        $this->putJson("/api/admin/plans/{$plan->slug}", array_merge($payload, ['name' => 'Agency Plus']))
            ->assertOk();

        $this->deleteJson("/api/admin/plans/{$plan->slug}")->assertOk();
    }

    public function test_admin_can_manage_workspaces_and_platform_settings(): void
    {
        $owner = User::factory()->create();
        $plan = Plan::where('is_active', true)->firstOrFail();

        $workspaceSlug = $this->postJson('/api/admin/workspaces', [
            'owner_id' => $owner->id,
            'name' => 'Managed Workspace',
            'timezone' => 'UTC',
            'plan_id' => $plan->id,
            'trial_days' => 21,
        ])->assertCreated()->json('data.slug');

        $this->putJson("/api/admin/workspaces/{$workspaceSlug}", [
            'name' => 'Updated Workspace',
            'timezone' => 'Asia/Dhaka',
            'brand_color' => '#123456',
            'owner_id' => $owner->id,
            'plan_id' => $plan->id,
        ])->assertOk()->assertJsonPath('data.name', 'Updated Workspace');

        $this->putJson('/api/admin/settings', [
            'platform_name' => 'Postflow Cloud',
            'support_email' => 'support@example.com',
            'registration_enabled' => false,
            'default_trial_days' => 21,
            'maintenance_notice' => 'Scheduled maintenance',
        ])->assertOk()->assertJsonPath('data.registration_enabled', false);

        $this->deleteJson("/api/admin/workspaces/{$workspaceSlug}")->assertOk();
        $this->assertSoftDeleted('workspaces', ['slug' => $workspaceSlug]);
    }
}
