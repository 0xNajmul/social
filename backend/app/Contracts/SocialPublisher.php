<?php

namespace App\Contracts;

use App\Models\SocialAccount;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;

/**
 * Common contract implemented by every social platform integration.
 *
 * The system never talks to a platform directly; it always resolves a
 * SocialPublisher via App\Services\Social\SocialManager and programs against
 * this interface. Adding a new network means implementing this contract and
 * registering it in config/social.php.
 */
interface SocialPublisher
{
    /**
     * The platform key, matching config/social.php (e.g. "facebook_page").
     */
    public function key(): string;

    /**
     * Human readable label.
     */
    public function label(): string;

    /**
     * Publish (or schedule, if the platform supports it) a post for the given
     * connected account.
     */
    public function publish(SocialAccount $account, PublishPayload $payload): PublishResult;

    /**
     * Delete a previously published post, where the platform allows it.
     */
    public function delete(SocialAccount $account, string $providerPostId): bool;

    /**
     * Fetch engagement metrics for a published post.
     *
     * @return array<string, int>
     */
    public function fetchMetrics(SocialAccount $account, string $providerPostId): array;

    /**
     * Refresh an expiring access token. Returns an updated AccountProfile or
     * null when the platform uses non-expiring tokens.
     */
    public function refreshToken(SocialAccount $account): ?AccountProfile;

    /**
     * Validate that a payload satisfies this platform's constraints.
     *
     * @return array<int, string> List of human readable validation errors.
     */
    public function validatePayload(PublishPayload $payload): array;
}
