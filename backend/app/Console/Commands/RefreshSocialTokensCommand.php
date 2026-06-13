<?php

namespace App\Console\Commands;

use App\Jobs\RefreshSocialTokenJob;
use App\Models\SocialAccount;
use Illuminate\Console\Command;

class RefreshSocialTokensCommand extends Command
{
    protected $signature = 'social:refresh-tokens';

    protected $description = 'Refresh expiring social account access tokens and warn on expiry';

    public function handle(): int
    {
        $accounts = SocialAccount::query()
            ->whereNotNull('token_expires_at')
            ->where('token_expires_at', '<=', now()->addDays(config('social.token_expiry_warning_days', 5)))
            ->get();

        foreach ($accounts as $account) {
            RefreshSocialTokenJob::dispatch($account->id);
        }

        $this->info("Queued token refresh for {$accounts->count()} account(s).");

        return self::SUCCESS;
    }
}
