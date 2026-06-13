<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * Snapchat Marketing/Public Profile API.
 */
class SnapchatService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'snapchat';
    }
}
