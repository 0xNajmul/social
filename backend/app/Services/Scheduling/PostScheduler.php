<?php

namespace App\Services\Scheduling;

use App\Enums\PostStatus;
use App\Jobs\PublishPostJob;
use App\Models\Post;
use App\Models\PostVariant;
use App\Models\ScheduledPost;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Central place for moving a post through its scheduling lifecycle. Keeps the
 * scheduled_posts queue in sync with each variant's state.
 */
class PostScheduler
{
    /**
     * Schedule every variant of a post for its (or the post's) target time.
     */
    public function schedule(Post $post, ?Carbon $when = null): void
    {
        DB::transaction(function () use ($post, $when) {
            $post->update([
                'status' => PostStatus::Scheduled,
                'scheduled_at' => $when ?? $post->scheduled_at,
            ]);

            foreach ($post->variants as $variant) {
                $time = $when ?? $variant->scheduled_at ?? $post->scheduled_at ?? now();

                $variant->update([
                    'status' => PostStatus::Scheduled,
                    'scheduled_at' => $time,
                ]);

                ScheduledPost::updateOrCreate(
                    ['post_variant_id' => $variant->id],
                    [
                        'workspace_id' => $post->workspace_id,
                        'scheduled_at' => $time,
                        'status' => 'pending',
                        'dispatched_at' => null,
                    ],
                );
            }
        });
    }

    /**
     * Publish immediately by dispatching jobs now (bypasses the due scanner).
     */
    public function publishNow(Post $post): void
    {
        $now = now();

        $post->update([
            'status' => PostStatus::Publishing,
            'scheduled_at' => $now,
        ]);

        foreach ($post->variants as $variant) {
            $variant->update(['status' => PostStatus::Publishing, 'scheduled_at' => $now]);

            ScheduledPost::updateOrCreate(
                ['post_variant_id' => $variant->id],
                [
                    'workspace_id' => $post->workspace_id,
                    'scheduled_at' => $now,
                    'status' => 'queued',
                    'dispatched_at' => $now,
                ],
            );

            PublishPostJob::dispatchSync($variant->id);
        }
    }

    /**
     * Reschedule a single variant (drag-and-drop in the calendar).
     */
    public function reschedule(PostVariant $variant, Carbon $when): void
    {
        $variant->update(['scheduled_at' => $when, 'status' => PostStatus::Scheduled]);

        ScheduledPost::updateOrCreate(
            ['post_variant_id' => $variant->id],
            [
                'workspace_id' => $variant->post->workspace_id,
                'scheduled_at' => $when,
                'status' => 'pending',
                'dispatched_at' => null,
            ],
        );
    }

    /**
     * Cancel scheduling for a post.
     */
    public function cancel(Post $post): void
    {
        $post->update(['status' => PostStatus::Cancelled]);
        $post->variants()->update(['status' => PostStatus::Cancelled]);
        ScheduledPost::whereIn('post_variant_id', $post->variants->pluck('id'))
            ->where('status', 'pending')
            ->delete();
    }
}
