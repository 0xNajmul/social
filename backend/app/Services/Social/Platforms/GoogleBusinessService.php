<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * Google Business Profile "localPosts" API.
 */
class GoogleBusinessService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'google_business';
    }
}
