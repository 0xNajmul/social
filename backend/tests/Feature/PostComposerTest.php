<?php

namespace Tests\Feature;

use App\Enums\PostStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class PostComposerTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_user_can_create_draft_post(): void
    {
        $user = $this->actingAsUser();
        $account = $this->connectDemoAccount($user);

        $response = $this->postJson('/api/posts', [
            'content' => 'Hello from the test suite!',
            'type' => 'text',
            'targets' => [
                ['social_account_id' => $account->id, 'content' => 'Hello from the test suite!'],
            ],
        ], $this->workspaceHeaders($user));

        $response->assertCreated()
            ->assertJsonPath('data.status', PostStatus::Draft->value)
            ->assertJsonPath('data.content', 'Hello from the test suite!');

        $this->assertDatabaseHas('posts', [
            'content' => 'Hello from the test suite!',
            'status' => PostStatus::Draft->value,
        ]);
    }

    public function test_user_can_list_posts(): void
    {
        $user = $this->actingAsUser();
        $account = $this->connectDemoAccount($user);

        $this->postJson('/api/posts', [
            'content' => 'Listed post',
            'targets' => [['social_account_id' => $account->id]],
        ], $this->workspaceHeaders($user))->assertCreated();

        $response = $this->getJson('/api/posts', $this->workspaceHeaders($user));

        $response->assertOk()
            ->assertJsonStructure(['data' => [['id', 'content', 'status']]]);
    }

    public function test_post_requires_at_least_one_target(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/posts', [
            'content' => 'No targets',
            'targets' => [],
        ], $this->workspaceHeaders($user));

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['targets']);
    }
}
