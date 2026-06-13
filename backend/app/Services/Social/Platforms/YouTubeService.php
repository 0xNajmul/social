<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * YouTube Data API v3 (videos.insert resumable upload).
 */
class YouTubeService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'youtube';
    }
}
