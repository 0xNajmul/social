<?php

namespace App\Events;

use App\Models\SocialAccount;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SocialAccountTokenExpiring
{
    use Dispatchable, SerializesModels;

    public function __construct(public SocialAccount $account) {}
}
