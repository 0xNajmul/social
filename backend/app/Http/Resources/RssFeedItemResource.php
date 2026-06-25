<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RssFeedItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $feed = $this->whenLoaded('feed');

        return [
            'id' => $this->id,
            'rss_feed_id' => $this->rss_feed_id,
            'feed' => $feed,
            'source' => $this->feed?->title,
            'country' => $this->feed?->country ?: 'Global',
            'category' => $this->feed?->category ?: 'General',
            'guid' => $this->guid,
            'title' => $this->title,
            'summary' => $this->summary,
            'link' => $this->link,
            'image_url' => $this->image_url,
            'published_at' => $this->published_at,
            'is_processed' => $this->is_processed,
            'created_at' => $this->created_at,
        ];
    }
}
