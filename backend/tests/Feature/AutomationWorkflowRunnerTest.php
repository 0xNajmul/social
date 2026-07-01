<?php

namespace Tests\Feature;

use App\Enums\AutomationType;
use App\Enums\MediaType;
use App\Models\Automation;
use App\Models\MediaAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class AutomationWorkflowRunnerTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_visual_workflow_run_creates_post_and_database_notifications(): void
    {
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $asset = MediaAsset::create([
            'workspace_id' => $workspace->id,
            'uploaded_by' => $user->id,
            'type' => MediaType::Image,
            'disk' => 'public',
            'path' => 'workspaces/'.$workspace->id.'/media/launch.jpg',
            'thumbnail_path' => 'workspaces/'.$workspace->id.'/media/launch.jpg',
            'original_name' => 'launch.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 1024,
            'width' => 1200,
            'height' => 630,
        ]);

        $automation = Automation::create([
            'workspace_id' => $workspace->id,
            'created_by' => $user->id,
            'name' => 'Launch workflow',
            'type' => AutomationType::RssFeed,
            'is_active' => true,
            'social_account_ids' => [],
            'config' => [
                'workflow' => [
                    'nodes' => [
                        $this->node('manual-1', 'manual_trigger'),
                        $this->node('post-1', 'create_post', [
                            'caption' => 'Launch copy from workflow',
                            'image_url' => 'https://example.com/launch.jpg',
                            'media_ids' => [$asset->id],
                            'media' => [[
                                'id' => $asset->id,
                                'type' => 'image',
                                'url' => $asset->url,
                                'thumbnail_url' => $asset->thumbnail_url,
                                'original_name' => $asset->original_name,
                            ]],
                            'link' => 'https://example.com/launch',
                        ]),
                        $this->node('notify-1', 'send_notification', [
                            'event' => 'run_completed',
                            'channel' => 'both',
                            'priority' => 'high',
                            'title' => 'Launch finished: {{automation.name}}',
                            'message' => 'Post {{post.id}} is ready with status {{workflow.status}}.',
                        ]),
                    ],
                    'edges' => [
                        ['source' => 'manual-1', 'target' => 'post-1'],
                        ['source' => 'post-1', 'target' => 'notify-1'],
                    ],
                ],
            ],
            'requires_approval' => false,
            'use_ai' => false,
            'next_run_at' => now(),
        ]);

        $this->postJson("/api/automations/{$automation->id}/run", [], $this->workspaceHeaders($user))
            ->assertOk()
            ->assertJsonPath('message', 'Automation run started.')
            ->assertJsonPath('items_created', 1);

        $this->assertDatabaseHas('posts', [
            'workspace_id' => $workspace->id,
            'automation_id' => $automation->id,
            'content' => 'Launch copy from workflow',
            'link_url' => 'https://example.com/launch',
            'type' => 'image',
        ]);

        $post = $workspace->posts()->where('automation_id', $automation->id)->firstOrFail();

        $this->assertSame(['https://example.com/launch.jpg'], $post->options['media_urls']);
        $this->assertSame([$asset->id], $post->options['media_ids']);
        $this->assertSame([$asset->id], $post->media()->pluck('media_assets.id')->all());

        $events = $user->notifications()->get()->pluck('data.event')->all();

        $this->assertContains('run_completed', $events);
        $notification = $user->notifications()->get()->first(fn ($item) => data_get($item->data, 'title') === 'Launch finished: Launch workflow');

        $this->assertNotNull($notification);
        $this->assertSame('Post '.$notification->data['post_id'].' is ready with status Completed.', data_get($notification->data, 'message'));
        $this->assertSame('high', data_get($notification->data, 'priority'));
        $this->assertSame('both', data_get($notification->data, 'channel'));
    }

    public function test_delay_node_resumes_workflow_and_sends_notifications_with_sync_queue(): void
    {
        config()->set('queue.default', 'sync');

        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        $automation = Automation::create([
            'workspace_id' => $workspace->id,
            'created_by' => $user->id,
            'name' => 'Delayed notification workflow',
            'type' => AutomationType::RssFeed,
            'is_active' => true,
            'social_account_ids' => [],
            'config' => [
                'workflow' => [
                    'nodes' => [
                        $this->node('manual-1', 'manual_trigger'),
                        $this->node('delay-1', 'delay_wait_until', [
                            'mode' => 'delay',
                            'delay_value' => 1,
                            'delay_unit' => 'seconds',
                        ]),
                        $this->node('notify-1', 'send_notification', [
                            'event' => 'run_completed',
                        ]),
                    ],
                    'edges' => [
                        ['source' => 'manual-1', 'target' => 'delay-1'],
                        ['source' => 'delay-1', 'target' => 'notify-1'],
                    ],
                ],
            ],
            'requires_approval' => false,
            'use_ai' => false,
            'next_run_at' => now(),
        ]);

        $this->postJson("/api/automations/{$automation->id}/run", [], $this->workspaceHeaders($user))
            ->assertOk()
            ->assertJsonPath('message', 'Automation run started.');

        $events = $user->notifications()->get()->pluck('data.event')->all();

        $this->assertContains('delay_waiting', $events);
        $this->assertContains('run_completed', $events);
        $waiting = $user->notifications()->get()->first(fn ($item) => data_get($item->data, 'event') === 'delay_waiting');

        $this->assertNotNull($waiting);
        $this->assertStringContainsString('Workflow paused: Delayed notification workflow', data_get($waiting->data, 'title'));
        $this->assertStringContainsString('is waiting for 1 second', data_get($waiting->data, 'message'));
    }

    public function test_visual_workflow_create_post_attaches_local_storage_image_url(): void
    {
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $asset = MediaAsset::create([
            'workspace_id' => $workspace->id,
            'uploaded_by' => $user->id,
            'type' => MediaType::Image,
            'disk' => 'public',
            'path' => 'workspaces/'.$workspace->id.'/media/local-image.jpg',
            'thumbnail_path' => 'workspaces/'.$workspace->id.'/media/local-image.jpg',
            'original_name' => 'local-image.jpg',
            'mime_type' => 'image/jpeg',
            'size' => 2048,
            'width' => 1080,
            'height' => 1080,
        ]);

        $automation = Automation::create([
            'workspace_id' => $workspace->id,
            'created_by' => $user->id,
            'name' => 'Local image workflow',
            'type' => AutomationType::RssFeed,
            'is_active' => true,
            'social_account_ids' => [],
            'config' => [
                'workflow' => [
                    'nodes' => [
                        $this->node('manual-1', 'manual_trigger'),
                        $this->node('post-1', 'create_post', [
                            'caption' => 'Image from library',
                            'image_url' => $asset->url,
                        ]),
                    ],
                    'edges' => [
                        ['source' => 'manual-1', 'target' => 'post-1'],
                    ],
                ],
            ],
            'requires_approval' => false,
            'use_ai' => false,
            'next_run_at' => now(),
        ]);

        $this->postJson("/api/automations/{$automation->id}/run", [], $this->workspaceHeaders($user))
            ->assertOk()
            ->assertJsonPath('items_created', 1);

        $post = $workspace->posts()->where('automation_id', $automation->id)->firstOrFail();

        $this->assertSame('image', $post->type);
        $this->assertSame([$asset->id], $post->options['media_ids']);
        $this->assertSame([$asset->id], $post->media()->pluck('media_assets.id')->all());
    }

    public function test_ai_content_generator_feeds_create_post(): void
    {
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();

        $automation = Automation::create([
            'workspace_id' => $workspace->id,
            'created_by' => $user->id,
            'name' => 'AI content workflow',
            'type' => AutomationType::RssFeed,
            'is_active' => true,
            'social_account_ids' => [],
            'config' => [
                'workflow' => [
                    'nodes' => [
                        $this->node('manual-1', 'manual_trigger'),
                        $this->node('ai-1', 'ai_content_generator', [
                            'source' => 'topic',
                            'topic' => 'weekly Telegram growth ideas',
                            'tone' => 'professional',
                            'length' => 'short',
                        ]),
                        $this->node('post-1', 'create_post'),
                    ],
                    'edges' => [
                        ['source' => 'manual-1', 'target' => 'ai-1'],
                        ['source' => 'ai-1', 'target' => 'post-1'],
                    ],
                ],
            ],
            'requires_approval' => false,
            'use_ai' => true,
            'next_run_at' => now(),
        ]);

        $this->postJson("/api/automations/{$automation->id}/run", [], $this->workspaceHeaders($user))
            ->assertOk()
            ->assertJsonPath('items_created', 1);

        $post = $workspace->posts()->where('automation_id', $automation->id)->firstOrFail();

        $this->assertStringContainsString('weekly Telegram growth ideas', $post->content);
        $this->assertDatabaseHas('ai_generations', [
            'workspace_id' => $workspace->id,
            'type' => 'content',
        ]);
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function node(string $id, string $key, array $config = []): array
    {
        return [
            'id' => $id,
            'type' => 'workflowNode',
            'data' => [
                'key' => $key,
                'category' => 'Test',
                'label' => $key,
                'config' => $config,
            ],
        ];
    }
}
