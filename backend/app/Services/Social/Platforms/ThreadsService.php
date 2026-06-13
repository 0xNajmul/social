<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * Threads Graph API (two-step container/publish flow, similar to Instagram).
 */
class ThreadsService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'threads';
    }
}
