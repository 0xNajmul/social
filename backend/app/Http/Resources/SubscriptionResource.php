<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'billing_cycle' => $this->billing_cycle,
            'provider' => $this->provider,
            'on_trial' => $this->onTrial(),
            'trial_ends_at' => $this->trial_ends_at,
            'current_period_end' => $this->current_period_end,
            'cancel_at_period_end' => $this->cancel_at_period_end,
            'plan' => new PlanResource($this->whenLoaded('plan')),
        ];
    }
}
