<?php

namespace App\Notifications;

use App\Models\Automation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AutomationWorkflowNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Automation $automation,
        public string $title,
        public string $message,
        public string $event = 'run_completed',
        public ?int $postId = null,
        public string $priority = 'normal',
        public string $channel = 'in_app',
        public ?string $actionLabel = null,
        public ?string $actionUrl = null,
        public array $context = [],
    ) {}

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
            'type' => 'automation.workflow',
            'event' => $this->event,
            'title' => $this->title,
            'message' => $this->message,
            'priority' => $this->priority,
            'channel' => $this->channel,
            'action_label' => $this->actionLabel,
            'action_url' => $this->actionUrl,
            'context' => $this->context,
            'workspace_id' => $this->automation->workspace_id,
            'automation_id' => $this->automation->id,
            'automation_name' => $this->automation->name,
            'post_id' => $this->postId,
        ];
    }
}
