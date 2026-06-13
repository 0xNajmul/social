<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * Pinterest Pins API (requires a board id stored on the account settings).
 */
class PinterestService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'pinterest';
    }
}
