<?php

namespace App\Services\Social\Data;

/**
 * Result returned by every SocialPublisher::publish() call. The raw provider
 * response is always retained for debugging / audit purposes.
 */
class PublishResult
{
    /**
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public readonly bool $success,
        public readonly ?string $providerPostId = null,
        public readonly ?string $permalink = null,
        public readonly array $raw = [],
        public readonly ?string $errorMessage = null,
        public readonly bool $retryable = true,
    ) {}

    /**
     * @param  array<string, mixed>  $raw
     */
    public static function success(string $providerPostId, ?string $permalink = null, array $raw = []): self
    {
        return new self(true, $providerPostId, $permalink, $raw);
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    public static function failure(string $message, array $raw = [], bool $retryable = true): self
    {
        return new self(false, raw: $raw, errorMessage: $message, retryable: $retryable);
    }
}
