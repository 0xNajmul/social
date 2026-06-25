<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AutomationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => data_get($this->config ?? [], 'description'),
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'is_active' => $this->is_active,
            'social_account_ids' => $this->social_account_ids ?? [],
            'config' => $this->config ?? [],
            'requires_approval' => $this->requires_approval,
            'use_ai' => $this->use_ai,
            'last_run_at' => $this->last_run_at,
            'next_run_at' => $this->next_run_at,
            'items_created' => $this->items_created,
            'feeds' => RssFeedResource::collection($this->whenLoaded('feeds')),
            'created_at' => $this->created_at,
        ];
    }
}
