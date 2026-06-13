<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * TikTok Content Posting API (video upload + publish). Inherits the demo
 * pipeline until credentials are configured in config/services.php.
 */
class TikTokService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'tiktok';
    }
}
