<?php

namespace App\Listeners;

use App\Events\PostFailed;
use App\Notifications\PostFailedNotification;
use App\Services\Webhooks\WebhookDispatcher;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendPostFailedNotification implements ShouldQueue
{
    public function __construct(protected WebhookDispatcher $webhooks) {}

    public function handle(PostFailed $event): void
    {
        $author = $event->variant->post->author;
        $author?->notify(new PostFailedNotification($event->variant, $event->reason));

        $this->webhooks->dispatch($event->variant->post->workspace, 'post.failed', [
            'post_id' => $event->variant->post_id,
            'platform' => $event->variant->platform,
            'reason' => $event->reason,
        ]);
    }
}
