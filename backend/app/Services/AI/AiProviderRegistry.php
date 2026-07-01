<?php

namespace App\Services\AI;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class AiProviderRegistry
{
    /** @return array<string, array<string, mixed>> */
    public static function providers(): array
    {
        return [
            'openai' => [
                'label' => 'OpenAI',
                'driver' => 'openai_compatible',
                'env_key' => 'OPENAI_API_KEY',
                'config_key' => 'services.openai.key',
                'model_config_key' => 'services.openai.model',
                'base_url_config_key' => 'services.openai.base_url',
                'base_url' => 'https://api.openai.com/v1',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => 'gpt-4o-mini',
                'default_models' => ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
            ],
            'anthropic' => [
                'label' => 'Anthropic',
                'driver' => 'anthropic',
                'env_key' => 'ANTHROPIC_API_KEY',
                'config_key' => 'services.anthropic.key',
                'model_config_key' => 'services.anthropic.model',
                'base_url_config_key' => 'services.anthropic.base_url',
                'base_url' => 'https://api.anthropic.com/v1',
                'models_path' => '/models',
                'default_model' => 'claude-3-5-sonnet-latest',
                'default_models' => ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
            ],
            'google' => [
                'label' => 'Google Gemini',
                'driver' => 'google',
                'env_key' => 'GOOGLE_AI_API_KEY',
                'config_key' => 'services.google_ai.key',
                'model_config_key' => 'services.google_ai.model',
                'base_url_config_key' => 'services.google_ai.base_url',
                'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
                'models_path' => '/models',
                'default_model' => 'gemini-2.5-flash',
                'default_models' => ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
            ],
            'xai' => [
                'label' => 'xAI',
                'driver' => 'openai_compatible',
                'env_key' => 'XAI_API_KEY',
                'config_key' => 'services.xai.key',
                'model_config_key' => 'services.xai.model',
                'base_url_config_key' => 'services.xai.base_url',
                'base_url' => 'https://api.x.ai/v1',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => 'grok-4.3',
                'default_models' => ['grok-4.3', 'grok-4', 'grok-3'],
            ],
            'mistral' => [
                'label' => 'Mistral AI',
                'driver' => 'openai_compatible',
                'env_key' => 'MISTRAL_API_KEY',
                'config_key' => 'services.mistral.key',
                'model_config_key' => 'services.mistral.model',
                'base_url_config_key' => 'services.mistral.base_url',
                'base_url' => 'https://api.mistral.ai/v1',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => 'mistral-large-latest',
                'default_models' => ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
            ],
            'groq' => [
                'label' => 'Groq',
                'driver' => 'openai_compatible',
                'env_key' => 'GROQ_API_KEY',
                'config_key' => 'services.groq.key',
                'model_config_key' => 'services.groq.model',
                'base_url_config_key' => 'services.groq.base_url',
                'base_url' => 'https://api.groq.com/openai/v1',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => 'llama-3.3-70b-versatile',
                'default_models' => ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'],
            ],
            'openrouter' => [
                'label' => 'OpenRouter',
                'driver' => 'openai_compatible',
                'env_key' => 'OPENROUTER_API_KEY',
                'config_key' => 'services.openrouter.key',
                'model_config_key' => 'services.openrouter.model',
                'base_url_config_key' => 'services.openrouter.base_url',
                'base_url' => 'https://openrouter.ai/api/v1',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => '~openai/gpt-latest',
                'default_models' => ['~openai/gpt-latest', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'],
            ],
            'deepseek' => [
                'label' => 'DeepSeek',
                'driver' => 'openai_compatible',
                'env_key' => 'DEEPSEEK_API_KEY',
                'config_key' => 'services.deepseek.key',
                'model_config_key' => 'services.deepseek.model',
                'base_url_config_key' => 'services.deepseek.base_url',
                'base_url' => 'https://api.deepseek.com/v1',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => 'deepseek-chat',
                'default_models' => ['deepseek-chat', 'deepseek-reasoner'],
            ],
            'perplexity' => [
                'label' => 'Perplexity',
                'driver' => 'openai_compatible',
                'env_key' => 'PERPLEXITY_API_KEY',
                'config_key' => 'services.perplexity.key',
                'model_config_key' => 'services.perplexity.model',
                'base_url_config_key' => 'services.perplexity.base_url',
                'base_url' => 'https://api.perplexity.ai',
                'models_path' => '/v1/models',
                'chat_path' => '/chat/completions',
                'default_model' => 'sonar',
                'default_models' => ['sonar', 'sonar-pro', 'sonar-reasoning'],
            ],
            'cohere' => [
                'label' => 'Cohere',
                'driver' => 'cohere',
                'env_key' => 'COHERE_API_KEY',
                'config_key' => 'services.cohere.key',
                'model_config_key' => 'services.cohere.model',
                'base_url_config_key' => 'services.cohere.base_url',
                'base_url' => 'https://api.cohere.com',
                'models_path' => '/v1/models',
                'default_model' => 'command-a-03-2025',
                'default_models' => ['command-a-03-2025', 'command-r-plus', 'command-r'],
            ],
            'custom' => [
                'label' => 'Custom OpenAI-compatible',
                'driver' => 'openai_compatible',
                'env_key' => 'CUSTOM_AI_API_KEY',
                'config_key' => 'services.custom_ai.key',
                'model_config_key' => 'services.custom_ai.model',
                'base_url_config_key' => 'services.custom_ai.base_url',
                'base_url' => '',
                'models_path' => '/models',
                'chat_path' => '/chat/completions',
                'default_model' => '',
                'default_models' => [],
            ],
            'fallback' => [
                'label' => 'Local fallback',
                'driver' => 'fallback',
                'env_key' => '',
                'config_key' => '',
                'model_config_key' => '',
                'base_url_config_key' => '',
                'base_url' => '',
                'models_path' => '',
                'chat_path' => '',
                'default_model' => 'fallback',
                'default_models' => ['fallback'],
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function defaultSettings(): array
    {
        $providers = self::providers();
        $apiKeys = [];
        $baseUrls = [];
        $models = [];

        foreach ($providers as $key => $provider) {
            $apiKeys[$key] = '';
            $baseUrls[$key] = self::configuredBaseUrl($key, $provider);
            $models[$key] = $provider['default_models'] ?? [];
        }

        return [
            'provider' => config('services.ai.default_provider', 'openai'),
            'model' => config('services.ai.default_model', config('services.openai.model', 'gpt-4o-mini')),
            'fallback_model' => 'fallback',
            'temperature' => '0.8',
            'max_tokens' => '1200',
            'system_prompt' => 'You are an expert social media copywriter.',
            'api_keys' => $apiKeys,
            'base_urls' => $baseUrls,
            'models' => $models,
            'synced_at' => [],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    public static function providerOptions(array $settings = []): array
    {
        return collect(self::providers())->map(function (array $provider, string $key) use ($settings) {
            return [
                'key' => $key,
                'label' => $provider['label'],
                'driver' => $provider['driver'],
                'env_key' => $provider['env_key'],
                'base_url' => self::baseUrl($key, $settings),
                'supports_sync' => filled($provider['models_path'] ?? null) && $key !== 'fallback',
                'key_configured' => filled(self::apiKey($key, $settings)),
                'default_model' => self::defaultModel($key),
                'default_models' => $provider['default_models'] ?? [],
            ];
        })->values()->all();
    }

    public static function defaultModel(string $provider): string
    {
        $definition = self::providers()[$provider] ?? self::providers()['openai'];
        $configKey = $definition['model_config_key'] ?? null;

        return ($configKey ? config($configKey, $definition['default_model'] ?? 'fallback') : null)
            ?: ($definition['default_model'] ?? 'fallback');
    }

    public static function driver(string $provider): string
    {
        return self::providers()[$provider]['driver'] ?? 'openai_compatible';
    }

    public static function apiKey(string $provider, array $settings = []): ?string
    {
        $definition = self::providers()[$provider] ?? null;
        if (! $definition) {
            return null;
        }

        $configKey = $definition['config_key'] ?? null;

        return trim((string) Arr::get($settings, "api_keys.{$provider}", ''))
            ?: ($configKey ? config($configKey) : null);
    }

    public static function baseUrl(string $provider, array $settings = []): string
    {
        $definition = self::providers()[$provider] ?? self::providers()['openai'];
        $configured = trim((string) Arr::get($settings, "base_urls.{$provider}", ''));

        return rtrim($configured ?: self::configuredBaseUrl($provider, $definition), '/');
    }

    /** @return array<int, string> */
    public static function modelOptions(string $provider, array $settings = []): array
    {
        $definition = self::providers()[$provider] ?? self::providers()['openai'];
        $models = Arr::get($settings, "models.{$provider}", []);
        $models = is_array($models) ? $models : [];

        return collect($definition['default_models'] ?? [])
            ->merge($models)
            ->push(Arr::get($settings, 'model'))
            ->filter()
            ->map(fn ($model) => (string) $model)
            ->unique()
            ->values()
            ->all();
    }

    /** @return array<int, string> */
    public static function syncModels(string $provider, array $settings = []): array
    {
        $definition = self::providers()[$provider] ?? null;
        if (! $definition || $provider === 'fallback') {
            return [];
        }

        $baseUrl = self::baseUrl($provider, $settings);
        $apiKey = self::apiKey($provider, $settings);

        if (! $baseUrl) {
            throw new RuntimeException('Add a base URL before syncing this provider.');
        }

        if (! $apiKey && $provider !== 'custom') {
            throw new RuntimeException("Add an API key for {$definition['label']} before syncing models.");
        }

        $models = match ($definition['driver']) {
            'anthropic' => self::syncAnthropicModels($definition, $baseUrl, $apiKey),
            'google' => self::syncGoogleModels($definition, $baseUrl, $apiKey),
            'cohere' => self::syncCohereModels($definition, $baseUrl, $apiKey),
            default => self::syncOpenAiCompatibleModels($definition, $baseUrl, $apiKey, $provider),
        };

        return collect($models)
            ->map(fn ($model) => trim((string) $model))
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    protected static function configuredBaseUrl(string $provider, array $definition): string
    {
        $configKey = $definition['base_url_config_key'] ?? null;

        return rtrim((string) ($configKey ? config($configKey, $definition['base_url'] ?? '') : ($definition['base_url'] ?? '')), '/');
    }

    /** @return array<int, string> */
    protected static function syncOpenAiCompatibleModels(array $definition, string $baseUrl, ?string $apiKey, string $provider): array
    {
        $request = Http::timeout(20)->acceptJson();
        if ($apiKey) {
            $request = $request->withToken($apiKey);
        }
        if ($provider === 'openrouter') {
            $request = $request->withHeaders([
                'HTTP-Referer' => config('app.url'),
                'X-Title' => config('app.name', 'Postflow'),
            ]);
        }

        $response = $request->get($baseUrl.($definition['models_path'] ?? '/models'));
        if (! $response->successful()) {
            throw new RuntimeException('Could not sync models from this provider.');
        }

        return self::extractModelIds($response->json());
    }

    /** @return array<int, string> */
    protected static function syncAnthropicModels(array $definition, string $baseUrl, ?string $apiKey): array
    {
        $response = Http::timeout(20)
            ->acceptJson()
            ->withHeaders([
                'x-api-key' => (string) $apiKey,
                'anthropic-version' => config('services.anthropic.version', '2023-06-01'),
            ])
            ->get($baseUrl.($definition['models_path'] ?? '/models'));

        if (! $response->successful()) {
            throw new RuntimeException('Could not sync Anthropic models.');
        }

        return self::extractModelIds($response->json());
    }

    /** @return array<int, string> */
    protected static function syncGoogleModels(array $definition, string $baseUrl, ?string $apiKey): array
    {
        if (! $apiKey) {
            throw new RuntimeException('Add a Google AI API key before syncing Gemini models.');
        }

        $response = Http::timeout(20)
            ->acceptJson()
            ->get($baseUrl.($definition['models_path'] ?? '/models'), ['key' => $apiKey]);

        if (! $response->successful()) {
            throw new RuntimeException('Could not sync Google Gemini models.');
        }

        $models = collect($response->json('models', []))
            ->filter(fn ($model) => in_array('generateContent', $model['supportedGenerationMethods'] ?? [], true))
            ->map(fn ($model) => Str::after((string) ($model['name'] ?? ''), 'models/'))
            ->filter()
            ->values()
            ->all();

        return $models ?: self::extractModelIds($response->json());
    }

    /** @return array<int, string> */
    protected static function syncCohereModels(array $definition, string $baseUrl, ?string $apiKey): array
    {
        $response = Http::timeout(20)
            ->acceptJson()
            ->withToken((string) $apiKey)
            ->get($baseUrl.($definition['models_path'] ?? '/v1/models'), ['endpoint' => 'chat']);

        if (! $response->successful()) {
            throw new RuntimeException('Could not sync Cohere models.');
        }

        return self::extractModelIds($response->json());
    }

    /** @return array<int, string> */
    protected static function extractModelIds(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $rows = $payload['data'] ?? $payload['models'] ?? $payload;
        if (! is_array($rows)) {
            return [];
        }

        return collect($rows)
            ->map(function ($row) {
                if (is_string($row)) {
                    return $row;
                }
                if (! is_array($row)) {
                    return null;
                }

                return $row['id'] ?? $row['name'] ?? $row['model'] ?? null;
            })
            ->map(fn ($model) => is_string($model) ? Str::after($model, 'models/') : null)
            ->filter()
            ->values()
            ->all();
    }
}
