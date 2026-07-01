<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Task schedule
|--------------------------------------------------------------------------
| Driven by a single cron entry:
|   * * * * * cd /path && php artisan schedule:run >> /dev/null 2>&1
*/

// Publish due posts every minute — the core scheduling heartbeat.
Schedule::command('posts:publish-due')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// Retry transiently failed posts every five minutes.
Schedule::command('posts:retry-failed')->everyFiveMinutes()->withoutOverlapping();

// Run due automations (RSS, visual workflows, recycle, ...).
Schedule::command('automations:run')->everyMinute()->withoutOverlapping();

// Refresh expiring OAuth tokens.
Schedule::command('social:refresh-tokens')->hourly()->withoutOverlapping();

// Capture daily analytics snapshots overnight.
Schedule::command('analytics:capture')->dailyAt('02:00');

// Prune stale queue/notification data weekly.
Schedule::command('queue:prune-failed', ['--hours' => 168])->weekly();
