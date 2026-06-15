<?php

namespace App\Jobs;

use App\Events\SocialAccountTokenExpiring;
use App\Models\SocialAccount;
use App\Services\Social\SocialManager;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RefreshSocialTokenJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $accountId) {}

    public function handle(SocialManager $manager): void
    {
        $account = SocialAccount::find($this->accountId);
        if (! $account) {
            return;
        }

        $profile = $manager->driver($account->platform)->refreshToken($account);

        if ($profile) {
            $account->update([
                'access_token' => $profile->accessToken ?? $account->access_token,
                'refresh_token' => $profile->refreshToken ?? $account->refresh_token,
                'token_meta' => array_merge($account->token_meta ?? [], $profile->tokenMeta),
                'token_expires_at' => $profile->expiresAt ?? $account->token_expires_at,
                'status' => 'active',
                'status_message' => null,
            ]);

            return;
        }

        // No refresh available — warn the user if the token is expiring.
        if ($account->isExpiringSoon() || $account->isExpired()) {
            $account->update([
                'status' => $account->isExpired() ? 'expired' : 'active',
                'status_message' => $account->isExpired() ? 'Token expired. Reconnect required.' : 'Token expiring soon.',
            ]);

            event(new SocialAccountTokenExpiring($account));
        }
    }
}
