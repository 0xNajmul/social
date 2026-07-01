<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Language;
use App\Models\PlatformSetting;
use App\Models\Translation;
use App\Services\AI\AiProviderRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Throwable;

class AdminSettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->values()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'platform_name' => ['required', 'string', 'max:80'],
            'support_email' => ['nullable', 'email', 'max:255'],
            'registration_enabled' => ['required', 'boolean'],
            'default_trial_days' => ['required', 'integer', 'min:0', 'max:365'],
            'maintenance_notice' => ['nullable', 'string', 'max:500'],
            'general' => ['nullable', 'array'],
            'seo' => ['nullable', 'array'],
            'sitemap' => ['nullable', 'array'],
            'language' => ['nullable', 'array'],
            'privacy' => ['nullable', 'array'],
            'main_menu' => ['nullable', 'array'],
            'footer' => ['nullable', 'array'],
            'email' => ['nullable', 'array'],
            'cron' => ['nullable', 'array'],
            'analytics' => ['nullable', 'array'],
            'affiliate' => ['nullable', 'array'],
            'social_login' => ['nullable', 'array'],
            'security' => ['nullable', 'array'],
            'payments' => ['nullable', 'array'],
            'ai' => ['nullable', 'array'],
            'crawler_ai' => ['nullable', 'array'],
        ]);

        PlatformSetting::storeValues($data);

        return response()->json([
            'message' => 'Platform settings updated.',
            'data' => $this->values(),
        ]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,svg', 'max:4096'],
        ]);

        $path = $data['logo']->store('settings', 'public');

        return response()->json([
            'url' => Storage::url($path),
        ], 201);
    }

    public function aiProviders(): JsonResponse
    {
        $settings = $this->settingArray('ai', AiProviderRegistry::defaultSettings());

        return response()->json([
            'providers' => AiProviderRegistry::providerOptions($settings),
            'settings' => $settings,
        ]);
    }

    public function syncAiModels(Request $request): JsonResponse
    {
        $providerKeys = array_keys(AiProviderRegistry::providers());
        $data = $request->validate([
            'provider' => ['required', 'string', Rule::in($providerKeys)],
            'api_key' => ['nullable', 'string', 'max:10000'],
            'base_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $provider = $data['provider'];
        $settings = $this->settingArray('ai', AiProviderRegistry::defaultSettings());

        if (array_key_exists('api_key', $data)) {
            $settings['api_keys'][$provider] = $data['api_key'] ?? '';
        }

        if (! empty($data['base_url'])) {
            $settings['base_urls'][$provider] = $data['base_url'];
        }

        try {
            $models = AiProviderRegistry::syncModels($provider, $settings);
        } catch (Throwable $error) {
            return response()->json([
                'message' => $error->getMessage() ?: 'Could not sync AI models.',
            ], 422);
        }

        $settings['models'][$provider] = $models;
        $settings['synced_at'][$provider] = now()->toIso8601String();

        if (($settings['provider'] ?? '') === $provider && ! in_array($settings['model'] ?? '', $models, true) && count($models)) {
            $settings['model'] = $models[0];
        }

        PlatformSetting::storeValues(['ai' => $settings]);

        return response()->json([
            'message' => count($models)
                ? 'AI models synced.'
                : 'Sync completed, but no models were returned by this provider.',
            'provider' => $provider,
            'models' => $models,
            'synced_at' => $settings['synced_at'][$provider],
            'settings' => $settings,
            'providers' => AiProviderRegistry::providerOptions($settings),
        ]);
    }

    public function languages(): JsonResponse
    {
        $this->ensureLanguageSeed();

        return response()->json(['data' => $this->languagePayload()]);
    }

    public function updateLanguages(Request $request): JsonResponse
    {
        $data = $request->validate([
            'languages' => ['required', 'array', 'min:1'],
            'languages.*.code' => ['required', 'string', 'max:10', 'regex:/^[A-Za-z]{2,3}([_-][A-Za-z]{2,4})?$/'],
            'languages.*.name' => ['required', 'string', 'max:120'],
            'languages.*.native_name' => ['nullable', 'string', 'max:120'],
            'languages.*.is_active' => ['boolean'],
            'languages.*.is_default' => ['boolean'],
            'languages.*.is_rtl' => ['boolean'],
            'languages.*.sort_order' => ['integer', 'min:0', 'max:9999'],
            'default_language' => ['nullable', 'string', 'max:10'],
            'auto_detect' => ['nullable', 'boolean'],
        ]);

        $rows = collect($data['languages'])
            ->map(function (array $language, int $index): array {
                return [
                    'code' => $this->normalizeLanguageCode($language['code']),
                    'name' => trim($language['name']),
                    'native_name' => isset($language['native_name']) ? trim((string) $language['native_name']) : null,
                    'is_active' => (bool) ($language['is_active'] ?? true),
                    'is_rtl' => (bool) ($language['is_rtl'] ?? false),
                    'sort_order' => (int) ($language['sort_order'] ?? $index),
                ];
            })
            ->filter(fn (array $language): bool => $language['code'] !== '' && $language['name'] !== '')
            ->values();

        abort_if($rows->isEmpty(), 422, 'Add at least one language.');
        abort_if($rows->pluck('code')->duplicates()->isNotEmpty(), 422, 'Language codes must be unique.');

        $defaultCode = $this->normalizeLanguageCode($data['default_language'] ?? '');
        if ($defaultCode === '' || ! $rows->contains('code', $defaultCode)) {
            $defaultCode = (string) $rows->first()['code'];
        }

        Language::query()->update(['is_default' => false]);

        foreach ($rows as $row) {
            Language::updateOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'native_name' => $row['native_name'] ?: null,
                    'is_active' => $row['code'] === $defaultCode ? true : $row['is_active'],
                    'is_default' => $row['code'] === $defaultCode,
                    'is_rtl' => $row['is_rtl'],
                    'sort_order' => $row['sort_order'],
                ],
            );
        }

        Language::whereNotIn('code', $rows->pluck('code')->all())->delete();

        $this->syncLanguageSetting($data['auto_detect'] ?? null);
        $this->syncTranslationsToFiles();

        return response()->json([
            'message' => 'Languages updated.',
            'data' => $this->languagePayload(),
        ]);
    }

    public function updateTranslations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'translations' => ['required', 'array'],
        ]);

        $locales = Language::query()->orderBy('sort_order')->pluck('code')->all() ?: ['en'];
        $saved = 0;

        foreach ($data['translations'] as $rowKey => $row) {
            if (! is_array($row)) {
                continue;
            }

            $key = trim((string) ($row['key'] ?? (is_string($rowKey) ? $rowKey : '')));
            if ($key === '') {
                continue;
            }

            $originalKey = trim((string) ($row['original_key'] ?? $key));
            if ($originalKey !== '' && $originalKey !== $key) {
                Translation::where('key', $originalKey)->delete();
            }

            $values = is_array($row['values'] ?? null) ? $row['values'] : $row;
            foreach ($locales as $locale) {
                if (! array_key_exists($locale, $values)) {
                    continue;
                }

                Translation::updateOrCreate(
                    ['key' => $key, 'locale' => $locale],
                    ['value' => $values[$locale] === null ? null : (string) $values[$locale]],
                );
                $saved++;
            }
        }

        $this->syncTranslationsToFiles();

        return response()->json([
            'message' => "{$saved} translation values saved.",
            'data' => $this->languagePayload(),
        ]);
    }

    public function deleteTranslation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:255'],
        ]);

        Translation::where('key', $data['key'])->delete();
        $this->syncTranslationsToFiles();

        return response()->json([
            'message' => 'Translation deleted.',
            'data' => $this->languagePayload(),
        ]);
    }

    public function syncTranslationsFromFiles(): JsonResponse
    {
        $files = glob(lang_path('*.json')) ?: [];
        $imported = 0;

        foreach ($files as $file) {
            $locale = $this->normalizeLanguageCode(pathinfo($file, PATHINFO_FILENAME));
            if ($locale === '') {
                continue;
            }

            Language::firstOrCreate(
                ['code' => $locale],
                [
                    'name' => strtoupper($locale),
                    'native_name' => strtoupper($locale),
                    'is_active' => true,
                    'is_default' => ! Language::where('is_default', true)->exists(),
                    'sort_order' => Language::count(),
                ],
            );

            $decoded = json_decode((string) file_get_contents($file), true);
            if (! is_array($decoded)) {
                continue;
            }

            foreach ($this->flattenTranslationArray($decoded) as $key => $value) {
                Translation::updateOrCreate(
                    ['key' => $key, 'locale' => $locale],
                    ['value' => is_scalar($value) || $value === null ? (string) $value : json_encode($value)],
                );
                $imported++;
            }
        }

        $this->syncLanguageSetting();
        $this->syncTranslationsToFiles();

        return response()->json([
            'message' => $files ? "{$imported} translation values imported." : 'No language JSON files were found.',
            'data' => $this->languagePayload(),
        ]);
    }

    /** @return array<string, mixed> */
    protected function values(): array
    {
        return [
            'platform_name' => PlatformSetting::valueFor('platform_name', config('app.name', 'Postflow')),
            'support_email' => PlatformSetting::valueFor('support_email', ''),
            'registration_enabled' => PlatformSetting::valueFor('registration_enabled', true),
            'default_trial_days' => (int) PlatformSetting::valueFor('default_trial_days', 14),
            'maintenance_notice' => PlatformSetting::valueFor('maintenance_notice', ''),
            'general' => $this->settingArray('general', [
                'site_name' => config('app.name', 'Postflow'),
                'tagline' => 'Social publishing, in one flow.',
                'description' => '',
                'email' => '',
                'phone' => '',
                'logo_url' => '',
                'facebook_url' => '',
                'x_url' => '',
                'tiktok_url' => '',
                'instagram_url' => '',
                'linkedin_url' => '',
                'discord_url' => '',
                'mastodon_url' => '',
                'youtube_url' => '',
                'other_social_url' => '',
            ]),
            'seo' => $this->settingArray('seo', [
                'meta_title' => '',
                'keywords' => '',
                'meta_description' => '',
                'og_title' => '',
                'og_description' => '',
                'og_image_url' => '',
                'twitter_card' => 'summary_large_image',
                'twitter_title' => '',
                'twitter_description' => '',
                'twitter_image_url' => '',
                'schema_json' => '',
            ]),
            'sitemap' => $this->settingArray('sitemap', [
                'enabled' => true,
                'include_landing' => true,
                'include_public_pages' => true,
                'change_frequency' => 'weekly',
                'last_generated_at' => '',
            ]),
            'language' => $this->settingArray('language', [
                'default_language' => 'en',
                'available_languages' => 'en',
                'auto_detect' => true,
                'rtl_languages' => '',
                'languages' => [
                    ['code' => 'en', 'name' => 'English', 'native_name' => 'English', 'is_rtl' => false],
                ],
            ]),
            'privacy' => $this->settingArray('privacy', [
                'gdpr_popup_enabled' => true,
                'cookie_message' => 'We use cookies to improve your experience.',
                'privacy_policy_url' => '/privacy',
                'consent_categories' => 'Required, Analytics, Marketing',
            ]),
            'main_menu' => $this->settingArray('main_menu', [
                'items' => [],
            ]),
            'footer' => $this->settingArray('footer', [
                'top_text' => '',
                'bottom_text' => '',
                'columns' => [],
            ]),
            'email' => $this->settingArray('email', [
                'provider' => 'smtp',
                'from_name' => 'Postflow',
                'from_email' => '',
                'smtp_host' => '',
                'smtp_port' => '587',
                'smtp_username' => '',
                'smtp_password' => '',
                'brevo_api_key' => '',
            ]),
            'cron' => $this->settingArray('cron', [
                'enabled' => true,
                'schedule_command' => '* * * * * php artisan schedule:run',
                'queue_command' => 'php artisan queue:work',
                'healthcheck_url' => '',
            ]),
            'analytics' => $this->settingArray('analytics', [
                'google_analytics_id' => '',
                'posthog_key' => '',
                'posthog_host' => 'https://app.posthog.com',
                'facebook_pixel_id' => '',
                'enabled' => false,
            ]),
            'affiliate' => $this->settingArray('affiliate', [
                'enabled' => false,
                'commission_type' => 'percentage',
                'commission_percent' => '20',
                'commission_flat_amount' => '10',
                'cookie_days' => '30',
                'payout_threshold' => '50',
            ]),
            'social_login' => $this->settingArray('social_login', [
                'google_enabled' => false,
                'facebook_enabled' => false,
                'linkedin_enabled' => false,
                'github_enabled' => false,
            ]),
            'security' => $this->settingArray('security', [
                'two_factor_required' => false,
                'turnstile_site_key' => '',
                'turnstile_secret_key' => '',
                'blocked_email_domains' => 'mailinator.com, temp-mail.org, 10minutemail.com',
            ]),
            'payments' => $this->settingArray('payments', [
                'default_provider' => 'manual',
                'dodo_api_key' => '',
                'dodo_api_base' => 'https://live.dodopayments.com',
                'dodo_webhook_secret' => '',
                'creem_api_key' => '',
                'creem_api_base' => 'https://api.creem.io',
                'creem_webhook_secret' => '',
                'webhook_secret' => '',
                'currency' => 'USD',
            ]),
            'ai' => $this->settingArray('ai', AiProviderRegistry::defaultSettings()),
            'crawler_ai' => $this->settingArray('crawler_ai', [
                'robots_txt' => "User-agent: *\nAllow: /",
                'llms_txt' => "# Postflow\n\nPublic information for AI agents.",
                'ai_agent_policy' => 'Allow public marketing pages and block authenticated application routes.',
            ]),
        ];
    }

    /**
     * @param  array<string, mixed>  $default
     * @return array<string, mixed>
     */
    protected function settingArray(string $key, array $default): array
    {
        $value = PlatformSetting::valueFor($key, []);

        return is_array($value) ? array_replace_recursive($default, $value) : $default;
    }

    protected function ensureLanguageSeed(): void
    {
        if (Language::exists()) {
            return;
        }

        Language::create([
            'code' => 'en',
            'name' => 'English',
            'native_name' => 'English',
            'is_active' => true,
            'is_default' => true,
            'is_rtl' => false,
            'sort_order' => 0,
        ]);

        $this->syncLanguageSetting();
    }

    /**
     * @return array<string, mixed>
     */
    protected function languagePayload(): array
    {
        $this->ensureLanguageSeed();

        $languages = Language::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (Language $language): array => [
                'id' => $language->id,
                'code' => $language->code,
                'name' => $language->name,
                'native_name' => $language->native_name,
                'is_active' => $language->is_active,
                'is_default' => $language->is_default,
                'is_rtl' => $language->is_rtl,
                'sort_order' => $language->sort_order,
            ])
            ->values()
            ->all();

        $translations = Translation::query()
            ->orderBy('key')
            ->orderBy('locale')
            ->get()
            ->groupBy('key')
            ->map(fn ($items, string $key): array => [
                'key' => $key,
                'original_key' => $key,
                'values' => $items->mapWithKeys(fn (Translation $translation): array => [
                    $translation->locale => $translation->value,
                ])->all(),
            ])
            ->values()
            ->all();

        return [
            'languages' => $languages,
            'translations' => $translations,
            'settings' => $this->settingArray('language', [
                'default_language' => 'en',
                'available_languages' => 'en',
                'auto_detect' => true,
                'rtl_languages' => '',
            ]),
        ];
    }

    protected function syncLanguageSetting(?bool $autoDetect = null): void
    {
        $languages = Language::query()->orderBy('sort_order')->orderBy('name')->get();
        $active = $languages->where('is_active', true)->values();
        $default = $languages->firstWhere('is_default', true) ?: $active->first() ?: $languages->first();
        $current = PlatformSetting::valueFor('language', []);

        PlatformSetting::storeValues([
            'language' => [
                'default_language' => $default?->code ?? 'en',
                'available_languages' => $active->pluck('code')->implode(', '),
                'auto_detect' => $autoDetect ?? (is_array($current) ? (bool) ($current['auto_detect'] ?? true) : true),
                'rtl_languages' => $active->where('is_rtl', true)->pluck('code')->implode(', '),
                'languages' => $active->map(fn (Language $language): array => [
                    'code' => $language->code,
                    'name' => $language->name,
                    'native_name' => $language->native_name ?: $language->name,
                    'is_rtl' => $language->is_rtl,
                ])->values()->all(),
            ],
        ]);
    }

    protected function normalizeLanguageCode(?string $code): string
    {
        return strtolower(str_replace('_', '-', trim((string) $code)));
    }

    /**
     * @return array<string, mixed>
     */
    protected function flattenTranslationArray(array $values, string $prefix = ''): array
    {
        $flat = [];

        foreach ($values as $key => $value) {
            $nextKey = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
            if (is_array($value)) {
                $flat += $this->flattenTranslationArray($value, $nextKey);
            } else {
                $flat[$nextKey] = $value;
            }
        }

        return $flat;
    }

    protected function syncTranslationsToFiles(): void
    {
        $path = lang_path();
        if (! is_dir($path)) {
            mkdir($path, 0755, true);
        }

        Language::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->each(function (Language $language) use ($path): void {
                $translations = Translation::query()
                    ->where('locale', $language->code)
                    ->orderBy('key')
                    ->pluck('value', 'key')
                    ->all();

                file_put_contents(
                    $path.DIRECTORY_SEPARATOR.$language->code.'.json',
                    json_encode((object) $translations, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES).PHP_EOL,
                );
            });
    }
}
