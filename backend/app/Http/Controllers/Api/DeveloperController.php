<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use App\Models\Webhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Developer platform: API keys + outbound webhooks for Zapier / n8n / custom
 * integrations.
 */
class DeveloperController extends Controller
{
    public function apiKeys(): JsonResponse
    {
        return response()->json([
            'data' => workspace()->apiKeys()->whereNull('revoked_at')->latest()->get(),
        ]);
    }

    public function createApiKey(Request $request): JsonResponse
    {
        $this->authorize('update', workspace());
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);

        ['model' => $key, 'secret' => $secret] = ApiKey::generate(workspace(), $data['name'], $request->user()->id);

        return response()->json([
            'data' => $key,
            'secret' => $secret, // shown only once
        ], 201);
    }

    public function revokeApiKey(ApiKey $apiKey): JsonResponse
    {
        abort_unless($apiKey->workspace_id === workspace()->id, 403);
        $apiKey->update(['revoked_at' => now()]);

        return response()->json(['message' => 'API key revoked.']);
    }

    public function webhooks(): JsonResponse
    {
        return response()->json(['data' => workspace()->webhooks()->latest()->get()]);
    }

    public function createWebhook(Request $request): JsonResponse
    {
        $this->authorize('update', workspace());
        $data = $request->validate([
            'url' => ['required', 'url'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', 'in:post.published,post.failed,post.scheduled,account.connected,account.token_expired'],
        ]);

        $webhook = workspace()->webhooks()->create([
            'url' => $data['url'],
            'events' => $data['events'],
            'secret' => \Illuminate\Support\Str::random(40),
        ]);

        return response()->json(['data' => $webhook], 201);
    }

    public function deleteWebhook(Webhook $webhook): JsonResponse
    {
        abort_unless($webhook->workspace_id === workspace()->id, 403);
        $webhook->delete();

        return response()->json(['message' => 'Webhook deleted.']);
    }
}
