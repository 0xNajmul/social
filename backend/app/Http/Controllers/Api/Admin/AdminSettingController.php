<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'crawler_ai' => ['nullable', 'array'],
        ]);

        PlatformSetting::storeValues($data);

        return response()->json([
            'message' => 'Platform settings updated.',
            'data' => $this->values(),
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
            ]),
            'privacy' => $this->settingArray('privacy', [
                'gdpr_popup_enabled' => true,
                'cookie_message' => 'We use cookies to improve your experience.',
                'privacy_policy_url' => '/privacy',
                'consent_categories' => 'Required, Analytics, Marketing',
            ]),
            'main_menu' => $this->settingArray('main_menu', [
                'items' => [
                    ['id' => 'product', 'label' => 'Product', 'url' => '#product', 'type' => 'mega', 'parent' => ''],
                    ['id' => 'workflow', 'label' => 'How it works', 'url' => '#workflow', 'type' => 'link', 'parent' => 'product'],
                    ['id' => 'platforms', 'label' => 'Platforms', 'url' => '#platforms', 'type' => 'link', 'parent' => 'product'],
                    ['id' => 'pricing', 'label' => 'Pricing', 'url' => '#pricing', 'type' => 'link', 'parent' => ''],
                ],
            ]),
            'footer' => $this->settingArray('footer', [
                'top_text' => 'Plan, publish, automate and measure every social channel from one workspace.',
                'bottom_text' => 'Copyright Postflow. All rights reserved.',
                'columns' => [
                    ['title' => 'Product', 'links' => "Composer|#product\nCalendar|#product\nAutomations|#workflow"],
                    ['title' => 'Company', 'links' => "Pricing|#pricing\nSecurity|#product\nDevelopers|#product"],
                ],
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
                'commission_percent' => '20',
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
                'creem_api_key' => '',
                'webhook_secret' => '',
                'currency' => 'USD',
            ]),
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
}
