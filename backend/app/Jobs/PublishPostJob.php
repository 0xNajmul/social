<?php

namespace App\Jobs;

use App\Models\PostVariant;
use App\Services\Publishing\PostPublisher;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

/**
 * Publishes a single PostVariant to its target platform. Dispatched by the
 * scheduler (PublishDuePostsCommand) or immediately on "publish now".
 *
 * Retries with exponential backoff are configured via config/social.php.
 */
class PublishPostJob implements ShouldQueue
{
    use Queueable;

    public int $tries;

    public int $timeout = 120;

    public function __construct(public int $variantId)
    {
        $this->tries = (int) config('social.publish_retries', 3);
        $this->onQueue('publishing');
    }

    /**
     * Backoff (seconds) between attempts.
     *
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return config('social.publish_backoff', [60, 300, 900]);
    }

    /**
     * Prevent two workers from publishing the same variant concurrently.
     *
     * @return array<int, object>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping((string) $this->variantId))->releaseAfter(60)];
    }

    public function handle(PostPublisher $publisher): void
    {
        $variant = PostVariant::with(['post.media', 'socialAccount'])->find($this->variantId);

        if (! $variant || $variant->socialAccount === null) {
            return; // Variant or account removed before publishing.
        }

        $publisher->publish($variant);
    }

    public function failed(\Throwable $e): void
    {
        // Final failure after all retries — the variant + FailedPost row are
        // already persisted by PostPublisher; nothing else to do here.
    }
}
