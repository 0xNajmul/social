<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'content' => $this->content,
            'type' => $this->type,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_color' => $this->status->color(),
            'link_url' => $this->link_url,
            'hashtags' => $this->hashtags ?? [],
            'mentions' => $this->mentions ?? [],
            'options' => $this->options ?? [],
            'requires_approval' => $this->requires_approval,
            'scheduled_at' => $this->scheduled_at,
            'published_at' => $this->published_at,
            'author' => new UserResource($this->whenLoaded('author')),
            'variants' => PostVariantResource::collection($this->whenLoaded('variants')),
            'media' => MediaResource::collection($this->whenLoaded('media')),
            'comments_count' => $this->whenCounted('comments'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
