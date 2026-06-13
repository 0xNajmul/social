<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

class FacebookGroupService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'facebook_group';
    }
}
