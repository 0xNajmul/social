<?php

namespace App\Events;

use App\Models\PostVariant;
use App\Models\PublishedPost;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PostPublished
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public PostVariant $variant,
        public PublishedPost $published,
    ) {}
}
