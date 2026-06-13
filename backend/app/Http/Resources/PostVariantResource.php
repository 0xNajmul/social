<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostVariantResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'platform' => $this->platform,
            'social_account_id' => $this->social_account_id,
            'social_account' => new SocialAccountResource($this->whenLoaded('socialAccount')),
            'content' => $this->content,
            'hashtags' => $this->hashtags ?? [],
            'options' => $this->options ?? [],
            'status' => $this->status->value,
            'scheduled_at' => $this->scheduled_at,
            'published_at' => $this->published_at,
            'permalink' => $this->permalink,
            'provider_post_id' => $this->provider_post_id,
            'error_message' => $this->error_message,
            'attempts' => $this->attempts,
        ];
    }
}
