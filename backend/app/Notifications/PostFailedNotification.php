<?php

namespace App\Notifications;

use App\Models\PostVariant;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostFailedNotification extends Notification
{
    use Queueable;

    public function __construct(public PostVariant $variant, public string $reason) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject("Your {$this->variant->platform} post failed to publish")
            ->line("We couldn't publish your post to {$this->variant->platform}.")
            ->line("Reason: {$this->reason}")
            ->action('Review post', rtrim(config('app.frontend_url', config('app.url')), '/')."/composer/{$this->variant->post_id}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'post.failed',
            'title' => 'Post failed',
            'message' => "Publishing to {$this->variant->platform} failed: {$this->reason}",
            'workspace_id' => $this->variant->post?->workspace_id,
            'post_id' => $this->variant->post_id,
            'platform' => $this->variant->platform,
        ];
    }
}
