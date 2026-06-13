<?php

namespace Tests\Concerns;

use App\Models\SocialAccount;
use App\Models\User;
use App\Services\WorkspaceProvisioner;
use Database\Seeders\PlanSeeder;
use Laravel\Sanctum\Sanctum;

/**
 * Helpers for authenticated API feature tests.
 */
trait InteractsWithApi
{
    protected function seedBasics(): void
    {
        $this->seed(PlanSeeder::class);
    }

    protected function actingAsUser(?User $user = null): User
    {
        $this->seedBasics();

        $user ??= User::factory()->create();

        if (! $user->current_workspace_id) {
            app(WorkspaceProvisioner::class)->create($user, 'Test Workspace');
            $user->refresh();
        }

        Sanctum::actingAs($user);

        return $user;
    }

    /**
     * @return array<string, string>
     */
    protected function workspaceHeaders(User $user): array
    {
        $workspace = $user->workspaces()->firstOrFail();

        return ['X-Workspace' => $workspace->slug];
    }

    protected function connectDemoAccount(User $user, string $platform = 'twitter'): SocialAccount
    {
        $workspace = $user->workspaces()->firstOrFail();

        return SocialAccount::create([
            'workspace_id' => $workspace->id,
            'connected_by' => $user->id,
            'platform' => $platform,
            'provider_account_id' => 'demo-'.uniqid(),
            'name' => 'Demo Account',
            'username' => 'demo_user',
            'access_token' => 'demo-token',
            'status' => 'active',
        ]);
    }
}
