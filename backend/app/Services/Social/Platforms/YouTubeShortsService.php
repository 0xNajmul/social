<?php

namespace App\Services\Social\Platforms;

/**
 * YouTube Shorts share the same upload pipeline with a #Shorts tag applied.
 */
class YouTubeShortsService extends YouTubeService
{
    public function key(): string
    {
        return 'youtube_shorts';
    }
}
