<?php

namespace App\Services\Publishing;

use App\Enums\PostStatus;
use App\Events\PostFailed;
use App\Events\PostPublished;
use App\Models\FailedPost;
use App\Models\PostVariant;
use App\Models\PublishedPost;
use App\Models\ScheduledPost;
use App\Services\ActivityLogger;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use App\Services\Social\SocialManager;
use Illuminate\Support\Facades\DB;

/**
 * Orchestrates publishing a single PostVariant: resolves the platform driver,
 * performs the publish, persists the outcome (published / failed records,
 * status transitions, provider response) and fires domain events.
 *
 * Designed to be called from PublishPostJob so all heavy lifting happens on
 * the queue with retry semantics.
 */
class PostPublisher
{
    public function __construct(
        protected SocialManager $manager,
        protected ActivityLogger $activity,
    ) {}

    /**
     * @throws \RuntimeException when the failure is retryable (lets the queue retry).
     */
    public function publish(PostVariant $variant): PublishResult
    {
        $variant->loadMissing(['post.media', 'socialAccount']);
        $account = $variant->socialAccount;

        $variant->update([
            'status' => PostStatus::Publishing,
            'attempts' => $variant->attempts + 1,
        ]);

        $driver = $this->manager->driver($variant->platform);
        $payload = PublishPayload::fromVariant($variant);

        $result = $driver->publish($account, $payload);

        return $result->success
            ? $this->recordSuccess($variant, $result)
            : $this->recordFailure($variant, $result);
    }

    protected function recordSuccess(PostVariant $variant, PublishResult $result): PublishResult
    {
        DB::transaction(function () use ($variant, $result) {
            $variant->update([
                'status' => PostStatus::Published,
                'published_at' => now(),
                'provider_post_id' => $result->providerPostId,
                'permalink' => $result->permalink,
                'provider_response' => $result->raw,
                'error_message' => null,
            ]);

            $published = PublishedPost::updateOrCreate(
                ['post_variant_id' => $variant->id],
                [
                    'social_account_id' => $variant->social_account_id,
                    'workspace_id' => $variant->post->workspace_id,
                    'platform' => $variant->platform,
                    'provider_post_id' => $result->providerPostId,
                    'permalink' => $result->permalink,
                    'published_at' => now(),
                ],
            );

            ScheduledPost::where('post_variant_id', $variant->id)
                ->update(['status' => 'done']);

            FailedPost::where('post_variant_id', $variant->id)
                ->update(['is_resolved' => true]);

            $this->syncParentStatus($variant);

            event(new PostPublished($variant, $published));
        });

        $this->activity->log(
            $variant->post->workspace_id,
            'post.published',
            $variant->post,
            "Published to {$variant->platform}",
        );

        return $result;
    }

    protected function recordFailure(PostVariant $variant, PublishResult $result): PublishResult
    {
        $variant->update([
            'status' => PostStatus::Failed,
            'provider_response' => $result->raw,
            'error_message' => $result->errorMessage,
        ]);

        FailedPost::updateOrCreate(
            ['post_variant_id' => $variant->id, 'is_resolved' => false],
            [
                'workspace_id' => $variant->post->workspace_id,
                'platform' => $variant->platform,
                'error_message' => $result->errorMessage ?? 'Unknown error',
                'error_context' => $result->raw,
                'attempts' => $variant->attempts,
            ],
        );

        ScheduledPost::where('post_variant_id', $variant->id)->update(['status' => 'failed']);

        event(new PostFailed($variant, $result->errorMessage ?? 'Unknown error'));

        $this->activity->log(
            $variant->post->workspace_id,
            'post.failed',
            $variant->post,
            "Failed on {$variant->platform}: {$result->errorMessage}",
        );

        // Retryable failures bubble up so the queue can retry with backoff.
        if ($result->retryable && $variant->attempts < config('social.publish_retries', 3)) {
            throw new \RuntimeException($result->errorMessage ?? 'Publish failed');
        }

        return $result;
    }

    /**
     * Roll the parent post status up from its variants.
     */
    protected function syncParentStatus(PostVariant $variant): void
    {
        $post = $variant->post;
        $statuses = $post->variants()->pluck('status');

        if ($statuses->every(fn ($s) => $s === PostStatus::Published->value || $s === PostStatus::Published)) {
            $post->update(['status' => PostStatus::Published, 'published_at' => now()]);
        } elseif ($statuses->contains(fn ($s) => in_array($s, [PostStatus::Failed->value, PostStatus::Failed], true))) {
            $post->update(['status' => PostStatus::Failed]);
        }
    }
}
