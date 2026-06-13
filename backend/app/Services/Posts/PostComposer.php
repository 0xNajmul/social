<?php

namespace App\Services\Posts;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\SocialAccount;
use App\Models\Workspace;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\SocialManager;
use Illuminate\Support\Facades\DB;

/**
 * Builds and updates posts together with their per-platform variants and media
 * attachments. Centralises the "one post, many platforms" composer logic.
 */
class PostComposer
{
    public function __construct(protected SocialManager $manager) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(Workspace $workspace, int $userId, array $data): Post
    {
        return DB::transaction(function () use ($workspace, $userId, $data) {
            $post = $workspace->posts()->create([
                'created_by' => $userId,
                'title' => $data['title'] ?? null,
                'content' => $data['content'] ?? null,
                'type' => $data['type'] ?? 'text',
                'status' => PostStatus::Draft,
                'link_url' => $data['link_url'] ?? null,
                'hashtags' => $data['hashtags'] ?? null,
                'mentions' => $data['mentions'] ?? null,
                'options' => $data['options'] ?? null,
                'scheduled_at' => $data['scheduled_at'] ?? null,
                'requires_approval' => $data['requires_approval'] ?? false,
            ]);

            $this->syncMedia($post, $data['media_ids'] ?? []);
            $this->syncVariants($workspace, $post, $data['targets'] ?? []);

            return $post->load(['variants.socialAccount', 'media']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Post $post, array $data): Post
    {
        return DB::transaction(function () use ($post, $data) {
            $post->update(array_filter([
                'title' => $data['title'] ?? null,
                'content' => $data['content'] ?? null,
                'type' => $data['type'] ?? null,
                'link_url' => $data['link_url'] ?? null,
                'hashtags' => $data['hashtags'] ?? null,
                'mentions' => $data['mentions'] ?? null,
                'options' => $data['options'] ?? null,
                'scheduled_at' => $data['scheduled_at'] ?? null,
            ], fn ($v) => ! is_null($v)));

            if (array_key_exists('media_ids', $data)) {
                $this->syncMedia($post, $data['media_ids'] ?? []);
            }

            if (array_key_exists('targets', $data)) {
                $post->variants()->delete();
                $this->syncVariants($post->workspace, $post, $data['targets']);
            }

            return $post->fresh(['variants.socialAccount', 'media']);
        });
    }

    /**
     * Validate the composed content against every target platform's limits.
     *
     * @return array<string, array<int, string>> keyed by platform
     */
    public function validate(Post $post): array
    {
        $errors = [];

        foreach ($post->variants as $variant) {
            $payload = PublishPayload::fromVariant($variant);
            $issues = $this->manager->driver($variant->platform)->validatePayload($payload);
            if ($issues) {
                $errors[$variant->platform] = $issues;
            }
        }

        return $errors;
    }

    /**
     * @param  array<int, int>  $mediaIds
     */
    protected function syncMedia(Post $post, array $mediaIds): void
    {
        $sync = [];
        foreach (array_values($mediaIds) as $position => $id) {
            $sync[$id] = ['position' => $position];
        }

        $post->media()->sync($sync);
    }

    /**
     * @param  array<int, array<string, mixed>>  $targets
     */
    protected function syncVariants(Workspace $workspace, Post $post, array $targets): void
    {
        foreach ($targets as $target) {
            $account = SocialAccount::where('workspace_id', $workspace->id)
                ->find($target['social_account_id']);

            if (! $account) {
                continue;
            }

            $post->variants()->create([
                'social_account_id' => $account->id,
                'platform' => $account->platform,
                'content' => $target['content'] ?? null,
                'hashtags' => $target['hashtags'] ?? null,
                'options' => $target['options'] ?? null,
                'status' => PostStatus::Draft,
            ]);
        }
    }
}
