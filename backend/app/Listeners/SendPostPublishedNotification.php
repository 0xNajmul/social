<?php

namespace App\Listeners;

use App\Events\PostPublished;
use App\Notifications\PostPublishedNotification;
use App\Services\Webhooks\WebhookDispatcher;
use Illuminate\Contracts\Queue\ShouldQueue;

class SendPostPublishedNotification implements ShouldQueue
{
    public function __construct(protected WebhookDispatcher $webhooks) {}

    public function handle(PostPublished $event): void
    {
        $author = $event->variant->post->author;
        $author?->notify(new PostPublishedNotification($event->variant));

        $this->webhooks->dispatch($event->variant->post->workspace, 'post.published', [
            'post_id' => $event->variant->post_id,
            'platform' => $event->variant->platform,
            'permalink' => $event->variant->permalink,
        ]);
    }
}
