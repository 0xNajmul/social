<?php

namespace App\Listeners;

use App\Events\SocialAccountTokenExpiring;
use App\Notifications\TokenExpiringNotification;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendTokenExpiringNotification implements ShouldQueue
{
    public function handle(SocialAccountTokenExpiring $event): void
    {
        $event->account->workspace->members()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->get()
            ->each
            ->notify(new TokenExpiringNotification($event->account));
    }
}
