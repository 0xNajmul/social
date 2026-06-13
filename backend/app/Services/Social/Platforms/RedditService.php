<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * Reddit submit API (self / link posts to a subreddit).
 */
class RedditService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'reddit';
    }
}
