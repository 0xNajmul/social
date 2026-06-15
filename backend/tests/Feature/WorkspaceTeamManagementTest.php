<?php

namespace Tests\Feature;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Plan;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class WorkspaceTeamManagementTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_owner_can_manage_members_and_invitations(): void
    {
        Notification::fake();
        $owner = $this->actingAsUser();
        $workspace = $owner->workspaces()->firstOrFail();
        $workspace->subscription()->update(['plan_id' => Plan::where('max_team_members', '>', 2)->firstOrFail()->id]);
        $member = User::factory()->create();
        $workspace->addMember($member, WorkspaceRole::Editor);
        $headers = $this->workspaceHeaders($owner);

        $this->putJson("/api/team/{$member->id}/role", ['role' => 'manager'], $headers)
            ->assertOk();

        $this->postJson('/api/team/invite', [
            'email' => 'invitee@example.com',
            'role' => 'editor',
        ], $headers)->assertCreated();

        $invitation = WorkspaceInvitation::firstOrFail();
        Notification::assertSentTo($invitation, WorkspaceInvitationNotification::class);

        $this->postJson("/api/team/invitations/{$invitation->id}/resend", [], $headers)
            ->assertOk();

        $this->deleteJson("/api/team/invitations/{$invitation->id}", [], $headers)
            ->assertOk();

        $this->deleteJson("/api/team/{$member->id}", [], $headers)
            ->assertOk();

        $this->assertDatabaseMissing('workspace_users', [
            'workspace_id' => $workspace->id,
            'user_id' => $member->id,
        ]);
    }

    public function test_invited_user_can_accept_and_switch_workspace(): void
    {
        Notification::fake();
        $owner = $this->actingAsUser();
        $workspace = $owner->workspaces()->firstOrFail();
        $invitee = User::factory()->create(['email' => 'join@example.com']);
        $invitation = $workspace->invitations()->create([
            'invited_by' => $owner->id,
            'email' => $invitee->email,
            'role' => WorkspaceRole::Editor->value,
        ]);

        Sanctum::actingAs($invitee);

        $this->postJson("/api/invitations/{$invitation->token}/accept")
            ->assertOk()
            ->assertJsonPath('workspace_slug', $workspace->slug);

        $this->assertTrue($invitee->fresh()->belongsToWorkspace($workspace));
        $this->assertSame($workspace->id, $invitee->fresh()->current_workspace_id);
    }
}
