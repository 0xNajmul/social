<?php

namespace App\Services\Webhooks;

use App\Models\Webhook;
use App\Models\Workspace;
use Illuminate\Support\Facades\Http;

/**
 * Delivers workspace webhooks (Zapier / n8n / custom) with an HMAC signature
 * and records every delivery attempt.
 */
class WebhookDispatcher
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function dispatch(Workspace $workspace, string $event, array $payload): void
    {
        $webhooks = $workspace->webhooks()->where('is_active', true)->get()
            ->filter(fn (Webhook $w) => $w->listensFor($event));

        foreach ($webhooks as $webhook) {
            $this->deliver($webhook, $event, $payload);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function deliver(Webhook $webhook, string $event, array $payload): void
    {
        $body = ['event' => $event, 'data' => $payload, 'timestamp' => now()->toIso8601String()];
        $signature = hash_hmac('sha256', json_encode($body), (string) $webhook->secret);

        try {
            $response = Http::timeout(10)
                ->withHeaders(['X-Signature' => $signature, 'X-Event' => $event])
                ->post($webhook->url, $body);

            $webhook->deliveries()->create([
                'event' => $event,
                'payload' => $body,
                'response_status' => $response->status(),
                'response_body' => mb_substr($response->body(), 0, 2000),
                'success' => $response->successful(),
            ]);

            $webhook->update([
                'last_triggered_at' => now(),
                'failure_count' => $response->successful() ? 0 : $webhook->failure_count + 1,
            ]);
        } catch (\Throwable $e) {
            $webhook->deliveries()->create([
                'event' => $event,
                'payload' => $body,
                'success' => false,
                'response_body' => $e->getMessage(),
            ]);
            $webhook->increment('failure_count');
        }
    }
}
