<?php

namespace App\Services\Social\Data;

/**
 * Normalised representation of an account returned from a platform after OAuth.
 */
class AccountProfile
{
    /**
     * @param  array<string, mixed>  $tokenMeta
     */
    public function __construct(
        public readonly string $providerAccountId,
        public readonly string $name,
        public readonly ?string $username = null,
        public readonly ?string $avatarUrl = null,
        public readonly ?string $profileUrl = null,
        public readonly ?string $accessToken = null,
        public readonly ?string $refreshToken = null,
        public readonly ?\DateTimeInterface $expiresAt = null,
        public readonly array $tokenMeta = [],
    ) {}
}
