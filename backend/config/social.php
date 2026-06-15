<?php

/*
|--------------------------------------------------------------------------
| Social platform registry
|--------------------------------------------------------------------------
|
| Every platform the app can publish to is described here. The `service`
| key maps to a class implementing App\Contracts\SocialPublisher and is
| resolved at runtime by App\Services\Social\SocialManager. Adding a new
| platform is as simple as adding an entry here plus its service class.
|
| `limits` describe platform constraints used for client + server side
| validation in the composer.
|
*/

use App\Services\Social\Platforms;

return [

    'default_timezone' => env('APP_TIMEZONE', 'UTC'),

    // Number of times a failed publish job is retried before giving up.
    'publish_retries' => env('SOCIAL_PUBLISH_RETRIES', 3),

    // Back-off (seconds) between publish retries.
    'publish_backoff' => [60, 300, 900],

    // Warn the user this many days before an access token expires.
    'token_expiry_warning_days' => 5,

    'platforms' => [

        'facebook_page' => [
            'label' => 'Facebook Page',
            'group' => 'facebook',
            'icon' => 'facebook',
            'color' => '#1877F2',
            'service' => Platforms\FacebookPageService::class,
            'capabilities' => ['text', 'image', 'video', 'link', 'carousel', 'schedule', 'analytics', 'delete'],
            'limits' => ['text' => 63206, 'images' => 10, 'video_seconds' => 240],
        ],

        'facebook_group' => [
            'label' => 'Facebook Group',
            'group' => 'facebook',
            'icon' => 'facebook',
            'color' => '#1877F2',
            'service' => Platforms\FacebookGroupService::class,
            'capabilities' => ['text', 'image', 'video', 'link'],
            'limits' => ['text' => 63206, 'images' => 10],
        ],

        'instagram' => [
            'label' => 'Instagram Business & Creator',
            'group' => 'instagram',
            'icon' => 'instagram',
            'color' => '#E4405F',
            'service' => Platforms\InstagramService::class,
            'capabilities' => ['image', 'video', 'carousel', 'reels', 'schedule', 'analytics'],
            'limits' => ['text' => 2200, 'images' => 10, 'hashtags' => 30],
        ],

        'tiktok' => [
            'label' => 'TikTok',
            'group' => 'tiktok',
            'icon' => 'tiktok',
            'color' => '#000000',
            'service' => Platforms\TikTokService::class,
            'capabilities' => ['video', 'schedule', 'analytics'],
            'limits' => ['text' => 2200, 'video_seconds' => 600],
        ],

        'youtube' => [
            'label' => 'YouTube',
            'group' => 'youtube',
            'icon' => 'youtube',
            'color' => '#FF0000',
            'service' => Platforms\YouTubeService::class,
            'capabilities' => ['video', 'schedule', 'analytics'],
            'limits' => ['text' => 5000, 'video_seconds' => 43200],
        ],

        'youtube_shorts' => [
            'label' => 'YouTube Shorts',
            'group' => 'youtube',
            'icon' => 'youtube',
            'color' => '#FF0000',
            'service' => Platforms\YouTubeShortsService::class,
            'capabilities' => ['video', 'schedule'],
            'limits' => ['text' => 5000, 'video_seconds' => 60],
        ],

        'twitter' => [
            'label' => 'X (Twitter)',
            'group' => 'twitter',
            'icon' => 'twitter',
            'color' => '#000000',
            'service' => Platforms\TwitterService::class,
            'capabilities' => ['text', 'image', 'video', 'thread', 'schedule', 'analytics'],
            'limits' => ['text' => 280, 'images' => 4],
        ],

        'linkedin_profile' => [
            'label' => 'LinkedIn Profile',
            'group' => 'linkedin',
            'icon' => 'linkedin',
            'color' => '#0A66C2',
            'service' => Platforms\LinkedInProfileService::class,
            'capabilities' => ['text', 'image', 'video', 'link', 'schedule', 'analytics'],
            'limits' => ['text' => 3000, 'images' => 1],
        ],

        'linkedin_page' => [
            'label' => 'LinkedIn Page',
            'group' => 'linkedin',
            'icon' => 'linkedin',
            'color' => '#0A66C2',
            'service' => Platforms\LinkedInPageService::class,
            'capabilities' => ['text', 'image', 'video', 'link', 'schedule', 'analytics'],
            'limits' => ['text' => 3000, 'images' => 1],
        ],

        'pinterest' => [
            'label' => 'Pinterest',
            'group' => 'pinterest',
            'icon' => 'pinterest',
            'color' => '#BD081C',
            'service' => Platforms\PinterestService::class,
            'capabilities' => ['image', 'video', 'link', 'schedule'],
            'limits' => ['text' => 500, 'images' => 1],
        ],

        'reddit' => [
            'label' => 'Reddit',
            'group' => 'reddit',
            'icon' => 'reddit',
            'color' => '#FF4500',
            'service' => Platforms\RedditService::class,
            'capabilities' => ['text', 'image', 'link'],
            'limits' => ['text' => 40000],
        ],

        'threads' => [
            'label' => 'Threads',
            'group' => 'threads',
            'icon' => 'threads',
            'color' => '#000000',
            'service' => Platforms\ThreadsService::class,
            'capabilities' => ['text', 'image', 'video', 'carousel'],
            'limits' => ['text' => 500, 'images' => 10],
        ],

        'bluesky' => [
            'label' => 'Bluesky',
            'group' => 'bluesky',
            'icon' => 'bluesky',
            'color' => '#0085FF',
            'service' => Platforms\BlueskyService::class,
            'capabilities' => ['text', 'image', 'link'],
            'limits' => ['text' => 300, 'images' => 4],
        ],

        'mastodon' => [
            'label' => 'Mastodon',
            'group' => 'mastodon',
            'icon' => 'mastodon',
            'color' => '#6364FF',
            'service' => Platforms\MastodonService::class,
            'capabilities' => ['text', 'image', 'video', 'schedule'],
            'limits' => ['text' => 500, 'images' => 4],
        ],

        'google_business' => [
            'label' => 'Google Business Profile',
            'group' => 'google',
            'icon' => 'google',
            'color' => '#4285F4',
            'service' => Platforms\GoogleBusinessService::class,
            'capabilities' => ['text', 'image', 'link'],
            'limits' => ['text' => 1500, 'images' => 1],
        ],

        'telegram' => [
            'label' => 'Telegram Channel',
            'group' => 'telegram',
            'icon' => 'telegram',
            'color' => '#26A5E4',
            'service' => Platforms\TelegramService::class,
            'capabilities' => ['text', 'image', 'video', 'link'],
            'limits' => ['text' => 4096, 'images' => 10],
        ],

        'discord' => [
            'label' => 'Discord Channel',
            'group' => 'discord',
            'icon' => 'discord',
            'color' => '#5865F2',
            'service' => Platforms\DiscordService::class,
            'capabilities' => ['text', 'image', 'video', 'link'],
            'limits' => ['text' => 2000, 'images' => 10],
        ],

        'whatsapp' => [
            'label' => 'WhatsApp Business',
            'group' => 'whatsapp',
            'icon' => 'whatsapp',
            'color' => '#25D366',
            'service' => Platforms\WhatsAppService::class,
            'capabilities' => ['text', 'image', 'video'],
            'limits' => ['text' => 4096],
        ],

        'snapchat' => [
            'label' => 'Snapchat',
            'group' => 'snapchat',
            'icon' => 'snapchat',
            'color' => '#FFFC00',
            'service' => Platforms\SnapchatService::class,
            'capabilities' => ['image', 'video'],
            'limits' => ['text' => 250],
        ],

    ],
];
