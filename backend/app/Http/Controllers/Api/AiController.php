<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AI\AiContentService;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AI assistant endpoints powering the composer's "magic" tools.
 */
class AiController extends Controller
{
    public function __construct(
        protected AiContentService $ai,
        protected UsageGuard $usage,
    ) {}

    public function generate(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->usage->ensure($workspace, 'ai_credits');

        $data = $request->validate([
            'type' => ['required', 'in:caption,hook,hashtags,ideas,rewrite,tone,calendar'],
            'topic' => ['nullable', 'string', 'max:2000'],
            'content' => ['nullable', 'string', 'max:8000'],
            'platform' => ['nullable', 'string'],
            'tone' => ['nullable', 'string'],
            'count' => ['nullable', 'integer', 'min:1', 'max:30'],
            'days' => ['nullable', 'integer', 'min:1', 'max:30'],
            'niche' => ['nullable', 'string', 'max:255'],
        ]);

        $params = array_filter($data);

        $result = match ($data['type']) {
            'caption' => $this->ai->caption($workspace, $data['topic'] ?? '', $params),
            'hook' => $this->ai->hook($workspace, $data['topic'] ?? '', $params),
            'hashtags' => $this->ai->hashtags($workspace, $data['topic'] ?? '', $params),
            'ideas' => $this->ai->ideas($workspace, $data['topic'] ?? '', $params),
            'rewrite' => $this->ai->rewriteForPlatform($workspace, $data['content'] ?? '', $data['platform'] ?? 'twitter', $params),
            'tone' => $this->ai->changeTone($workspace, $data['content'] ?? '', $data['tone'] ?? 'friendly', $params),
            'calendar' => $this->ai->calendar($workspace, $data['niche'] ?? $data['topic'] ?? 'brand', $data['days'] ?? 7, $params),
        };

        return response()->json([
            'type' => $data['type'],
            'result' => $result,
            'credits_remaining' => $this->usage->remaining($workspace, 'ai_credits'),
        ]);
    }
}
