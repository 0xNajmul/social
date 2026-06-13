<?php

namespace App\Notifications;

use App\Models\WorkspaceInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WorkspaceInvitationNotification extends Notification
{
    use Queueable;

    public function __construct(public WorkspaceInvitation $invitation) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url', config('app.url')), '/').'/invitations/'.$this->invitation->token;

        return (new MailMessage)
            ->subject("You've been invited to join {$this->invitation->workspace->name}")
            ->greeting('Hello!')
            ->line("{$this->invitation->inviter?->name} invited you to collaborate on \"{$this->invitation->workspace->name}\" as a {$this->invitation->role}.")
            ->action('Accept invitation', $url)
            ->line('This invitation expires on '.$this->invitation->expires_at->toFormattedDayDateString().'.');
    }
}
