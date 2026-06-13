<?php

namespace App\Console\Commands;

use App\Jobs\SyncAnalyticsJob;
use App\Models\SocialAccount;
use Illuminate\Console\Command;

class CaptureAnalyticsCommand extends Command
{
    protected $signature = 'analytics:capture';

    protected $description = 'Capture a daily analytics snapshot for every active social account';

    public function handle(): int
    {
        SocialAccount::active()->eachById(function (SocialAccount $account) {
            SyncAnalyticsJob::dispatch($account->id);
        });

        $this->info('Analytics capture queued.');

        return self::SUCCESS;
    }
}
