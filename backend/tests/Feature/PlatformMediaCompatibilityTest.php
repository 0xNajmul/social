<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Models\SocialAccount;
use App\Services\Posts\PlatformMediaCompatibility;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class PlatformMediaCompatibilityTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_video_post_skips_text_only_platforms(): void
    {
        $user = $this->actingAsUser();
        $bluesky = $this->connectDemoAccount($user, 'bluesky');
        $youtube = $this->connectDemoAccount($user, 'youtube');

        $video = MediaAsset::create([
            'workspace_id' => $user->workspaces()->first()->id,
            'uploaded_by' => $user->id,
            'type' => \App\Enums\MediaType::Video,
            'disk' => 'public',
            'path' => 'test/video.mp4',
            'original_name' => 'clip.mp4',
            'mime_type' => 'video/mp4',
            'size' => 1024,
        ]);

        $response = $this->postJson('/api/posts', [
            'content' => 'My video',
            'media_ids' => [$video->id],
            'targets' => [
                ['social_account_id' => $bluesky->id],
                ['social_account_id' => $youtube->id],
            ],
        ], $this->workspaceHeaders($user));

        $response->assertCreated()
            ->assertJsonCount(1, 'skipped_targets')
            ->assertJsonPath('data.type', 'video');

        $this->assertDatabaseHas('post_variants', [
            'social_account_id' => $youtube->id,
            'platform' => 'youtube',
        ]);

        $this->assertDatabaseMissing('post_variants', [
            'social_account_id' => $bluesky->id,
        ]);
    }

    public function test_compatibility_service_detects_image_limits(): void
    {
        $service = app(PlatformMediaCompatibility::class);

        $this->assertSame(
            'Image uploads are not supported on this platform.',
            $service->unsupportedReason('youtube', ['image']),
        );

        $this->assertNull($service->unsupportedReason('instagram', ['image']));
    }
}
