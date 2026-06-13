<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;

/**
 * LinkedIn organization (Page) posts — identical to profile posting but with
 * an organization author URN.
 */
class LinkedInPageService extends LinkedInProfileService
{
    public function key(): string
    {
        return 'linkedin_page';
    }

    protected function authorUrn(SocialAccount $account): string
    {
        return 'urn:li:organization:'.$account->provider_account_id;
    }
}
