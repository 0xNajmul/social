<?php

namespace Tests\Feature;

use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class CalendarInteractionTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_user_can_reschedule_a_post_and_all_variants(): void
    {
        $user = $this->actingAsUser();
        $post = $this->createScheduledPost($user);
        $newTime = now()->addDays(5)->setTime(15, 30)->toISOString();

        $response = $this->postJson(
            "/api/calendar/{$post->id}/reschedule",
            ['scheduled_at' => $newTime],
            $this->workspaceHeaders($user),
        );

        $response->assertOk()
            ->assertJsonPath('data.status', 'scheduled');

        $post->refresh();
        $this->assertEquals($newTime, $post->scheduled_at->toISOString());
        $this->assertEquals(
            $newTime,
            $post->variants()->firstOrFail()->scheduled_at->toISOString(),
        );
        $this->assertDatabaseHas('scheduled_posts', [
            'post_variant_id' => $post->variants()->firstOrFail()->id,
            'status' => 'pending',
        ]);
    }

    public function test_deleting_a_calendar_post_removes_its_pending_schedule(): void
    {
        $user = $this->actingAsUser();
        $post = $this->createScheduledPost($user);
        $variantId = $post->variants()->firstOrFail()->id;

        $this->deleteJson("/api/posts/{$post->id}", [], $this->workspaceHeaders($user))
            ->assertOk();

        $this->assertSoftDeleted('posts', ['id' => $post->id]);
        $this->assertDatabaseMissing('post_variants', ['id' => $variantId]);
        $this->assertDatabaseMissing('scheduled_posts', ['post_variant_id' => $variantId]);
    }

    private function createScheduledPost($user): Post
    {
        $account = $this->connectDemoAccount($user);
        $create = $this->postJson('/api/posts', [
            'content' => 'Calendar test post',
            'targets' => [['social_account_id' => $account->id]],
        ], $this->workspaceHeaders($user))->assertCreated();

        $post = Post::findOrFail($create->json('data.id'));
        $this->postJson("/api/posts/{$post->id}/schedule", [
            'scheduled_at' => now()->addDays(2)->toISOString(),
        ], $this->workspaceHeaders($user))->assertOk();

        return $post->fresh('variants');
    }
}
