<?php

namespace App\Services\AI;

use App\Models\AiGeneration;
use App\Models\PlatformSetting;
use App\Models\Workspace;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Generates marketing copy. When an OpenAI key is configured it calls the
 * chat completions endpoint; otherwise it falls back to a local heuristic
 * generator so every AI feature is usable in development.
 *
 * Every call is persisted to ai_generations for usage metering.
 */
class AiContentService
{
    public function caption(Workspace $workspace, string $topic, array $params = []): string
    {
        $tone = $params['tone'] ?? 'friendly';
        $platform = $params['platform'] ?? 'social media';

        return $this->generate($workspace, 'caption',
            "Write a {$tone} {$platform} caption about: {$topic}. Include a call to action.",
            fn () => $this->fallbackCaption($topic, $tone),
            $params,
        );
    }

    public function content(Workspace $workspace, string $topic, array $params = []): string
    {
        $tone = $params['tone'] ?? 'professional';
        $length = $params['length'] ?? 'medium';
        $type = str_replace('_', ' ', (string) ($params['content_type'] ?? 'social_post'));
        $instruction = trim((string) ($params['prompt'] ?? 'Create a useful social post that is ready to publish.'));
        $cta = ($params['include_cta'] ?? true) ? ' Include a natural call to action.' : '';

        return $this->generate($workspace, 'content',
            "{$instruction}\n\nWrite a {$length}, {$tone} {$type} about:\n{$topic}\n{$cta}",
            fn () => $this->fallbackCaption($topic, $tone),
            $params,
        );
    }

    public function captionFromTitle(Workspace $workspace, string $title, string $summary = ''): string
    {
        return $this->caption($workspace, trim($title.'. '.Str::limit($summary, 200)));
    }

    public function hook(Workspace $workspace, string $topic, array $params = []): string
    {
        return $this->generate($workspace, 'hook',
            "Write 3 scroll-stopping opening hooks for a post about: {$topic}.",
            fn () => "Stop scrolling 🛑 here's what nobody tells you about {$topic}...",
            $params,
        );
    }

    /**
     * @return array<int, string>
     */
    public function hashtags(Workspace $workspace, string $topic, array $params = []): array
    {
        $count = (int) ($params['count'] ?? 10);
        $raw = $this->generate($workspace, 'hashtags',
            "Generate {$count} relevant, high-reach hashtags for: {$topic}. Return space separated.",
            fn () => $this->fallbackHashtags($topic, $count),
            $params,
        );

        return collect(preg_split('/[\s,]+/', $raw))
            ->filter()
            ->map(fn ($t) => '#'.ltrim($t, '#'))
            ->take($count)
            ->values()
            ->all();
    }

    public function ideas(Workspace $workspace, string $topic, array $params = []): string
    {
        return $this->generate($workspace, 'ideas',
            "Give me 7 content ideas about: {$topic}. Format as a numbered list.",
            fn () => collect(range(1, 7))->map(fn ($i) => "{$i}. A fresh angle on {$topic} (#{$i})")->implode("\n"),
            $params,
        );
    }

    public function rewriteForPlatform(Workspace $workspace, string $content, string $platform, array $params = []): string
    {
        return $this->generate($workspace, 'rewrite',
            "Rewrite this post for {$platform}, matching its style and limits:\n\n{$content}",
            fn () => Str::limit($content, $platform === 'twitter' ? 270 : 2000),
            $params + ['platform' => $platform],
        );
    }

    public function changeTone(Workspace $workspace, string $content, string $tone, array $params = []): string
    {
        return $this->generate($workspace, 'tone',
            "Rewrite the following in a {$tone} tone:\n\n{$content}",
            fn () => "[{$tone}] ".$content,
            $params + ['tone' => $tone],
        );
    }

    public function calendar(Workspace $workspace, string $niche, int $days = 7, array $params = []): string
    {
        return $this->generate($workspace, 'calendar',
            "Create a {$days}-day social content calendar for a {$niche} brand. One idea per day.",
            fn () => collect(range(1, $days))->map(fn ($d) => "Day {$d}: {$niche} tip #{$d}")->implode("\n"),
            $params,
        );
    }

    /**
     * Core generation routine with metering + persistence.
     *
     * @param  callable():string  $fallback
     */
    protected function generate(Workspace $workspace, string $type, string $prompt, callable $fallback, array $params = []): string
    {
        [$result, $tokens, $model] = $this->callProvider($prompt, $fallback);

        AiGeneration::create([
            'workspace_id' => $workspace->id,
            'user_id' => auth()->id(),
            'type' => $type,
            'prompt' => $prompt,
            'result' => $result,
            'params' => $params,
            'model' => $model,
            'tokens_used' => $tokens,
            'credits_used' => 1,
        ]);

        return $result;
    }

    /**
     * @param  callable():string  $fallback
     * @return array{0:string,1:int,2:string}
     */
    protected function callProvider(string $prompt, callable $fallback): array
    {
        $settings = PlatformSetting::valueFor('ai', []);
        $settings = array_replace_recursive(
            AiProviderRegistry::defaultSettings(),
            is_array($settings) ? $settings : [],
        );
        $provider = $settings['provider'] ?? 'openai';
        $model = $settings['model'] ?: AiProviderRegistry::defaultModel($provider);

        if ($provider === 'fallback') {
            return [$fallback(), 0, 'fallback'];
        }

        $key = AiProviderRegistry::apiKey($provider, $settings);
        $baseUrl = AiProviderRegistry::baseUrl($provider, $settings);

        if (! $key && $provider !== 'custom') {
            return [$fallback(), 0, 'fallback'];
        }

        $systemPrompt = trim((string) ($settings['system_prompt'] ?? 'You are an expert social media copywriter.'));
        $temperature = is_numeric($settings['temperature'] ?? null)
            ? max(0, min((float) $settings['temperature'], 2))
            : 0.8;
        $maxTokens = is_numeric($settings['max_tokens'] ?? null)
            ? max(128, min((int) $settings['max_tokens'], 4096))
            : 1200;

        try {
            return match (AiProviderRegistry::driver($provider)) {
                'anthropic' => $this->callAnthropic($baseUrl, (string) $key, $model, $systemPrompt, $prompt, $temperature, $maxTokens, $fallback),
                'google' => $this->callGoogle($baseUrl, (string) $key, $model, $systemPrompt, $prompt, $temperature, $maxTokens, $fallback),
                'cohere' => $this->callCohere($baseUrl, (string) $key, $model, $systemPrompt, $prompt, $temperature, $maxTokens, $fallback),
                default => $this->callOpenAiCompatible($provider, $baseUrl, $key, $model, $systemPrompt, $prompt, $temperature, $maxTokens, $fallback),
            };
        } catch (Throwable) {
            return [$fallback(), 0, 'fallback'];
        }
    }

    /**
     * @param  callable():string  $fallback
     * @return array{0:string,1:int,2:string}
     */
    protected function callOpenAiCompatible(string $provider, string $baseUrl, ?string $key, string $model, string $systemPrompt, string $prompt, float $temperature, int $maxTokens, callable $fallback): array
    {
        if (! $baseUrl) {
            return [$fallback(), 0, 'fallback'];
        }

        $request = Http::timeout(30)->acceptJson();

        if ($key) {
            $request = $request->withToken($key);
        }

        if ($provider === 'openrouter') {
            $request = $request->withHeaders([
                'HTTP-Referer' => config('app.url'),
                'X-Title' => config('app.name', 'Postflow'),
            ]);
        }

        $response = $request
            ->baseUrl($baseUrl)
            ->post('/chat/completions', [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt ?: 'You are an expert social media copywriter.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => $temperature,
                'max_tokens' => $maxTokens,
            ]);

        if (! $response->successful()) {
            return [$fallback(), 0, 'fallback'];
        }

        return [
            trim((string) $response->json('choices.0.message.content', $fallback())),
            (int) $response->json('usage.total_tokens', 0),
            $model,
        ];
    }

    /**
     * @param  callable():string  $fallback
     * @return array{0:string,1:int,2:string}
     */
    protected function callAnthropic(string $baseUrl, string $key, string $model, string $systemPrompt, string $prompt, float $temperature, int $maxTokens, callable $fallback): array
    {
        $response = Http::timeout(30)
            ->acceptJson()
            ->withHeaders([
                'x-api-key' => $key,
                'anthropic-version' => config('services.anthropic.version', '2023-06-01'),
            ])
            ->baseUrl($baseUrl)
            ->post('/messages', [
                'model' => $model,
                'max_tokens' => $maxTokens,
                'temperature' => $temperature,
                'system' => $systemPrompt ?: 'You are an expert social media copywriter.',
                'messages' => [
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

        if (! $response->successful()) {
            return [$fallback(), 0, 'fallback'];
        }

        return [
            trim((string) $response->json('content.0.text', $fallback())),
            (int) $response->json('usage.input_tokens', 0) + (int) $response->json('usage.output_tokens', 0),
            $model,
        ];
    }

    /**
     * @param  callable():string  $fallback
     * @return array{0:string,1:int,2:string}
     */
    protected function callGoogle(string $baseUrl, string $key, string $model, string $systemPrompt, string $prompt, float $temperature, int $maxTokens, callable $fallback): array
    {
        $modelName = str_starts_with($model, 'models/') ? $model : "models/{$model}";
        $response = Http::timeout(30)
            ->acceptJson()
            ->post(rtrim($baseUrl, '/')."/{$modelName}:generateContent?key=".urlencode($key), [
                'systemInstruction' => [
                    'parts' => [['text' => $systemPrompt ?: 'You are an expert social media copywriter.']],
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [['text' => $prompt]],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => $temperature,
                    'maxOutputTokens' => $maxTokens,
                ],
            ]);

        if (! $response->successful()) {
            return [$fallback(), 0, 'fallback'];
        }

        return [
            trim((string) $response->json('candidates.0.content.parts.0.text', $fallback())),
            (int) $response->json('usageMetadata.totalTokenCount', 0),
            $model,
        ];
    }

    /**
     * @param  callable():string  $fallback
     * @return array{0:string,1:int,2:string}
     */
    protected function callCohere(string $baseUrl, string $key, string $model, string $systemPrompt, string $prompt, float $temperature, int $maxTokens, callable $fallback): array
    {
        $response = Http::timeout(30)
            ->acceptJson()
            ->withToken($key)
            ->baseUrl($baseUrl)
            ->post('/v2/chat', [
                'model' => $model,
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt ?: 'You are an expert social media copywriter.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => $temperature,
                'max_tokens' => $maxTokens,
            ]);

        if (! $response->successful()) {
            return [$fallback(), 0, 'fallback'];
        }

        return [
            trim((string) ($response->json('message.content.0.text') ?? $response->json('text') ?? $fallback())),
            (int) $response->json('usage.tokens.total_tokens', 0),
            $model,
        ];
    }

    protected function fallbackCaption(string $topic, string $tone): string
    {
        $emoji = ['friendly' => '😊', 'bold' => '🔥', 'professional' => '💼', 'witty' => '😏'][$tone] ?? '✨';

        return "{$emoji} {$topic}\n\n".
            "Here's why it matters and how you can make the most of it today. ".
            "What's your take? Drop a comment below 👇\n\n".
            "👉 Save this for later and share with a friend.";
    }

    protected function fallbackHashtags(string $topic, int $count): string
    {
        $base = collect(preg_split('/\s+/', Str::lower($topic)))
            ->filter(fn ($w) => strlen($w) > 2)
            ->map(fn ($w) => preg_replace('/[^a-z0-9]/', '', $w))
            ->filter();

        $generic = ['marketing', 'socialmedia', 'contentcreator', 'growth', 'trending', 'tips', 'business', 'branding'];

        return $base->merge($generic)->unique()->take($count)->implode(' ');
    }
}
