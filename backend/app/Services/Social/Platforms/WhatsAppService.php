<?php

namespace App\Services\Social\Platforms;

use App\Services\Social\AbstractPlatformService;

/**
 * WhatsApp Business Cloud API (messages / status broadcasts).
 */
class WhatsAppService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'whatsapp';
    }
}
