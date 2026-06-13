<?php

namespace App\Console\Commands;

use App\Jobs\PublishPostJob;
use App\Models\FailedPost;
use Illuminate\Console\Command;

/**
 * Automatically re-queues failed posts whose next_retry_at window has elapsed,
 * up to the configured retry ceiling.
 */
class RetryFailedPostsCommand extends Command
{
    protected $signature = 'posts:retry-failed';

    protected $description = 'Retry failed posts that are eligible for another attempt';

    public function handle(): int
    {
        $failed = FailedPost::where('is_resolved', false)
            ->whereNotNull('next_retry_at')
            ->where('next_retry_at', '<=', now())
            ->where('attempts', '<', config('social.publish_retries', 3))
            ->get();

        foreach ($failed as $failure) {
            $failure->update(['next_retry_at' => null]);
            PublishPostJob::dispatch($failure->post_variant_id);
        }

        $this->info("Re-queued {$failed->count()} failed post(s).");

        return self::SUCCESS;
    }
}
