<?php

namespace App\Notifications;

use App\Models\SocialAccount;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class TokenExpiringNotification extends Notification
{
    use Queueable;

    public function __construct(public SocialAccount $account) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'account.token_expiring',
            'title' => 'Reconnect needed',
            'message' => "Your {$this->account->name} connection is expiring. Reconnect to keep publishing.",
            'workspace_id' => $this->account->workspace_id,
            'social_account_id' => $this->account->id,
            'platform' => $this->account->platform,
        ];
    }
}
