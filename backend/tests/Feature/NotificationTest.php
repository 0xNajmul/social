<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_user_can_list_only_their_notifications_with_unread_count(): void
    {
        $user = $this->actingAsUser();
        $other = User::factory()->create();
        $ownId = $this->createNotification($user, 'Own notification');
        $this->createNotification($other, 'Other notification');

        $response = $this->getJson('/api/notifications');

        $response->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $ownId)
            ->assertJsonPath('data.0.data.title', 'Own notification');
    }

    public function test_user_can_mark_one_or_all_notifications_as_read(): void
    {
        $user = $this->actingAsUser();
        $firstId = $this->createNotification($user, 'First notification');
        $secondId = $this->createNotification($user, 'Second notification');

        $this->postJson("/api/notifications/{$firstId}/read")->assertOk();
        $this->assertDatabaseMissing('notifications', ['id' => $firstId, 'read_at' => null]);
        $this->assertDatabaseHas('notifications', ['id' => $secondId, 'read_at' => null]);

        $this->postJson('/api/notifications/read-all')->assertOk();
        $this->assertDatabaseMissing('notifications', [
            'notifiable_id' => $user->id,
            'notifiable_type' => User::class,
            'read_at' => null,
        ]);
    }

    private function createNotification(User $user, string $title): string
    {
        $id = (string) Str::uuid();

        $user->notifications()->create([
            'id' => $id,
            'type' => 'test.notification',
            'data' => [
                'type' => 'test.notification',
                'title' => $title,
                'message' => 'Notification message',
            ],
        ]);

        return $id;
    }
}
