<?php

namespace App\Notifications;

use App\Models\PostVariant;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PostPublishedNotification extends Notification
{
    use Queueable;

    public function __construct(public PostVariant $variant) {}

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
            'type' => 'post.published',
            'title' => 'Post published',
            'message' => "Your post was published to {$this->variant->platform}.",
            'workspace_id' => $this->variant->post?->workspace_id,
            'post_id' => $this->variant->post_id,
            'platform' => $this->variant->platform,
            'permalink' => $this->variant->permalink,
        ];
    }
}
