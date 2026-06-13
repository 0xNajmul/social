<?php

namespace App\Console\Commands;

use App\Jobs\PublishPostJob;
use App\Models\ScheduledPost;
use Illuminate\Console\Command;

/**
 * Scans the scheduled_posts queue for rows that are due and dispatches a
 * PublishPostJob for each. Runs every minute via the scheduler.
 */
class PublishDuePostsCommand extends Command
{
    protected $signature = 'posts:publish-due';

    protected $description = 'Dispatch publish jobs for all scheduled posts that are now due';

    public function handle(): int
    {
        $due = ScheduledPost::where('status', 'pending')
            ->where('scheduled_at', '<=', now())
            ->limit(500)
            ->get();

        if ($due->isEmpty()) {
            $this->info('No posts due.');

            return self::SUCCESS;
        }

        foreach ($due as $scheduled) {
            $scheduled->update(['status' => 'queued', 'dispatched_at' => now()]);
            PublishPostJob::dispatch($scheduled->post_variant_id);
        }

        $this->info("Dispatched {$due->count()} publish job(s).");

        return self::SUCCESS;
    }
}
