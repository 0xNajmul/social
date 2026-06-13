<?php

namespace App\Events;

use App\Models\PostVariant;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PostFailed
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public PostVariant $variant,
        public string $reason,
    ) {}
}
