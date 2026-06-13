<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * YouTube Shorts use the same upload pipeline as YouTube with a #Shorts hint
 * and a <= 60s vertical video.
 */
class YouTubeShortsService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'youtube_shorts';
    }
}
