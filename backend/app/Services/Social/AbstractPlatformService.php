<?php

namespace App\Services\Social;

use App\Contracts\SocialPublisher;
use App\Models\SocialAccount;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Base class providing shared behaviour for all platform integrations:
 *
 *  - capability + limit checks driven by config/social.php
 *  - a "demo mode" publish used when no API credentials are configured, so the
 *    whole scheduling/queue pipeline is fully testable out of the box
 *  - sensible no-op defaults for delete / metrics / token refresh
 *
 * Concrete services override publishToPlatform() (and optionally the others)
 * with the real API calls for their network.
 */
abstract class AbstractPlatformService implements SocialPublisher
{
    /**
     * The platform key, matching the config/social.php entry.
     */
    abstract public function key(): string;

    public function label(): string
    {
        return $this->config('label', Str::headline($this->key()));
    }

    /**
     * Read this platform's config block (or a single key).
     */
    protected function config(?string $key = null, mixed $default = null): mixed
    {
        $base = config('social.platforms.'.$this->key(), []);

        return $key ? data_get($base, $key, $default) : $base;
    }

    /**
     * Credentials for this platform group from config/services.php.
     */
    protected function credentials(): array
    {
        return config('services.'.$this->config('group', $this->key()), []);
    }

    /**
     * Whether the platform has real API credentials configured. When false the
     * service operates in demo mode (simulated publishing).
     */
    protected function isConfigured(): bool
    {
        $creds = $this->credentials();

        return ! empty($creds['client_id'])
            || ! empty($creds['bot_token'])
            || ! empty($creds['api_key']);
    }

    public function supports(string $capability): bool
    {
        return in_array($capability, $this->config('capabilities', []), true);
    }

    public function publish(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        if ($errors = $this->validatePayload($payload)) {
            return PublishResult::failure(implode(' ', $errors), retryable: false);
        }

        if ($this->shouldRefreshToken($account)) {
            $profile = $this->refreshToken($account);

            if ($profile?->accessToken) {
                $account->update([
                    'access_token' => $profile->accessToken,
                    'refresh_token' => $profile->refreshToken ?? $account->refresh_token,
                    'token_meta' => array_merge($account->token_meta ?? [], $profile->tokenMeta),
                    'token_expires_at' => $profile->expiresAt ?? $account->token_expires_at,
                    'status' => 'active',
                    'status_message' => null,
                ]);
                $account->refresh();
            }
        }

        if ($account->isExpired()) {
            return PublishResult::failure(
                "The {$this->label()} access token has expired. Please reconnect the account.",
                retryable: false,
            );
        }

        try {
            return $this->isConfigured()
                ? $this->publishToPlatform($account, $payload)
                : $this->simulatePublish($account, $payload);
        } catch (\Throwable $e) {
            Log::error("[{$this->key()}] publish failed", [
                'account_id' => $account->id,
                'error' => $e->getMessage(),
            ]);

            return PublishResult::failure($e->getMessage(), ['exception' => class_basename($e)]);
        }
    }

    /**
     * Real publishing logic. Implemented by concrete services that have a live
     * integration; others inherit demo mode.
     */
    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        return $this->simulatePublish($account, $payload);
    }

    /**
     * Simulated publish used in demo mode. Generates a believable provider id
     * and permalink so the rest of the pipeline behaves identically to live.
     */
    protected function simulatePublish(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $id = $this->key().'_'.Str::lower(Str::random(18));

        Log::info("[{$this->key()}] simulated publish (demo mode)", [
            'account' => $account->name,
            'chars' => mb_strlen($payload->content),
            'media' => count($payload->media),
        ]);

        return PublishResult::success(
            providerPostId: $id,
            permalink: rtrim((string) $account->profile_url, '/').'/posts/'.$id,
            raw: ['demo' => true, 'received_at' => now()->toIso8601String()],
        );
    }

    public function delete(SocialAccount $account, string $providerPostId): bool
    {
        return $this->supports('delete');
    }

    /**
     * @return array<string, int>
     */
    public function fetchMetrics(SocialAccount $account, string $providerPostId): array
    {
        if (! $this->supports('analytics')) {
            return [];
        }

        // Demo mode returns randomised but stable-ish metrics.
        return [
            'likes' => random_int(5, 500),
            'comments' => random_int(0, 80),
            'shares' => random_int(0, 60),
            'views' => random_int(100, 9000),
            'clicks' => random_int(0, 300),
            'impressions' => random_int(200, 12000),
        ];
    }

    public function refreshToken(SocialAccount $account): ?AccountProfile
    {
        return null;
    }

    protected function shouldRefreshToken(SocialAccount $account): bool
    {
        return $account->isExpired() || $account->isExpiringSoon();
    }

    /**
     * @return array<int, string>
     */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = [];
        $limits = $this->config('limits', []);

        if (isset($limits['text']) && mb_strlen($payload->content) > $limits['text']) {
            $errors[] = sprintf(
                '%s allows at most %d characters (got %d).',
                $this->label(), $limits['text'], mb_strlen($payload->content)
            );
        }

        $imageCount = collect($payload->media)->where('type', '!=', 'video')->count();
        if (isset($limits['images']) && $imageCount > $limits['images']) {
            $errors[] = sprintf('%s allows at most %d images.', $this->label(), $limits['images']);
        }

        $needsMedia = ! $this->supports('text');
        if ($needsMedia && empty($payload->media)) {
            $errors[] = "{$this->label()} requires at least one image or video.";
        }

        if (isset($limits['hashtags'])) {
            $count = substr_count($payload->content, '#');
            if ($count > $limits['hashtags']) {
                $errors[] = sprintf('%s allows at most %d hashtags.', $this->label(), $limits['hashtags']);
            }
        }

        return $errors;
    }
}
