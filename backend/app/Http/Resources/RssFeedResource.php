<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RssFeedResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workspace_id' => $this->workspace_id,
            'workspace' => $this->whenLoaded('workspace'),
            'automation_id' => $this->automation_id,
            'title' => $this->title,
            'url' => $this->url,
            'country' => $this->country ?: 'Global',
            'category' => $this->category ?: 'General',
            'status' => $this->status ?: 'active',
            'description' => $this->description,
            'items_count' => $this->whenCounted('items'),
            'latest_item_published_at' => $this->items_max_published_at ?? null,
            'last_fetched_at' => $this->last_fetched_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
