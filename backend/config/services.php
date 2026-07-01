<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | AI providers
    |--------------------------------------------------------------------------
    */
    'ai' => [
        'default_provider' => env('AI_PROVIDER', 'openai'),
        'default_model' => env('AI_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')),
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    ],

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-3-5-sonnet-latest'),
        'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com/v1'),
        'version' => env('ANTHROPIC_VERSION', '2023-06-01'),
    ],

    'google_ai' => [
        'key' => env('GOOGLE_AI_API_KEY'),
        'model' => env('GOOGLE_AI_MODEL', 'gemini-2.5-flash'),
        'base_url' => env('GOOGLE_AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
    ],

    'xai' => [
        'key' => env('XAI_API_KEY'),
        'model' => env('XAI_MODEL', 'grok-4.3'),
        'base_url' => env('XAI_BASE_URL', 'https://api.x.ai/v1'),
    ],

    'mistral' => [
        'key' => env('MISTRAL_API_KEY'),
        'model' => env('MISTRAL_MODEL', 'mistral-large-latest'),
        'base_url' => env('MISTRAL_BASE_URL', 'https://api.mistral.ai/v1'),
    ],

    'groq' => [
        'key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
    ],

    'openrouter' => [
        'key' => env('OPENROUTER_API_KEY'),
        'model' => env('OPENROUTER_MODEL', '~openai/gpt-latest'),
        'base_url' => env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
    ],

    'deepseek' => [
        'key' => env('DEEPSEEK_API_KEY'),
        'model' => env('DEEPSEEK_MODEL', 'deepseek-chat'),
        'base_url' => env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
    ],

    'perplexity' => [
        'key' => env('PERPLEXITY_API_KEY'),
        'model' => env('PERPLEXITY_MODEL', 'sonar'),
        'base_url' => env('PERPLEXITY_BASE_URL', 'https://api.perplexity.ai'),
    ],

    'cohere' => [
        'key' => env('COHERE_API_KEY'),
        'model' => env('COHERE_MODEL', 'command-a-03-2025'),
        'base_url' => env('COHERE_BASE_URL', 'https://api.cohere.com'),
    ],

    'custom_ai' => [
        'key' => env('CUSTOM_AI_API_KEY'),
        'model' => env('CUSTOM_AI_MODEL'),
        'base_url' => env('CUSTOM_AI_BASE_URL'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Billing providers
    |--------------------------------------------------------------------------
    */
    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],

    'paddle' => [
        'vendor_id' => env('PADDLE_VENDOR_ID'),
        'api_key' => env('PADDLE_API_KEY'),
        'webhook_secret' => env('PADDLE_WEBHOOK_SECRET'),
    ],

    'dodo' => [
        'api_key' => env('DODO_API_KEY'),
        'base_url' => rtrim(env('DODO_API_BASE', 'https://live.dodopayments.com'), '/'),
        'webhook_secret' => env('DODO_WEBHOOK_SECRET'),
    ],

    'creem' => [
        'api_key' => env('CREEM_API_KEY'),
        'base_url' => rtrim(env('CREEM_API_BASE', 'https://api.creem.io'), '/'),
        'webhook_secret' => env('CREEM_WEBHOOK_SECRET'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Social platform OAuth credentials
    |--------------------------------------------------------------------------
    | Each platform reads its credentials from here. Leaving them empty puts
    | the platform in "demo" mode where publishing is simulated.
    */
    'facebook' => [
        'client_id' => env('FACEBOOK_CLIENT_ID'),
        'client_secret' => env('FACEBOOK_CLIENT_SECRET'),
        'redirect' => env('FACEBOOK_REDIRECT_URI'),
        'config_id' => env('FACEBOOK_CONFIG_ID'),
        'graph_version' => env('FACEBOOK_GRAPH_VERSION', 'v21.0'),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('FACEBOOK_SCOPES', 'pages_show_list,pages_read_engagement,pages_manage_posts')),
        ))),
    ],
    'instagram' => [
        'client_id' => env('INSTAGRAM_CLIENT_ID'),
        'client_secret' => env('INSTAGRAM_CLIENT_SECRET'),
        'redirect' => env('INSTAGRAM_REDIRECT_URI', rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/instagram/callback'),
        'graph_version' => env('INSTAGRAM_GRAPH_VERSION', 'v21.0'),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('INSTAGRAM_SCOPES', 'instagram_business_basic,instagram_business_content_publish')),
        ))),
    ],
    'tiktok' => [
        'client_id' => env('TIKTOK_CLIENT_KEY'),
        'client_secret' => env('TIKTOK_CLIENT_SECRET'),
        'redirect' => env('TIKTOK_REDIRECT_URI'),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('TIKTOK_SCOPES', 'user.info.basic,video.publish')),
        ))),
    ],
    'youtube' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('YOUTUBE_REDIRECT_URI'),
    ],
    'google_login' => [
        'client_id' => env('GOOGLE_LOGIN_CLIENT_ID', env('GOOGLE_CLIENT_ID')),
        'client_secret' => env('GOOGLE_LOGIN_CLIENT_SECRET', env('GOOGLE_CLIENT_SECRET')),
        'redirect' => env('GOOGLE_LOGIN_REDIRECT_URI', rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/auth/google/callback'),
        'frontend_redirect' => env('FRONTEND_URL', 'http://localhost:5173').'/auth/google/callback',
        'admin_redirect' => env('ADMIN_URL', 'http://localhost:5174').'/login',
    ],
    'twitter' => [
        'client_id' => env('TWITTER_CLIENT_ID'),
        'client_secret' => env('TWITTER_CLIENT_SECRET'),
        'redirect' => env(
            'TWITTER_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/twitter/callback',
        ),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('TWITTER_SCOPES', 'tweet.read,tweet.write,users.read,offline.access')),
        ))),
    ],
    'linkedin' => [
        'client_id' => env('LINKEDIN_CLIENT_ID'),
        'client_secret' => env('LINKEDIN_CLIENT_SECRET'),
        'redirect' => env(
            'LINKEDIN_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/linkedin/callback',
        ),
        'version' => env('LINKEDIN_VERSION', '202606'),
        'profile_scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('LINKEDIN_PROFILE_SCOPES', 'openid,profile,email,w_member_social')),
        ))),
        'page_scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('LINKEDIN_PAGE_SCOPES', 'openid,profile,email,rw_organization_admin,w_organization_social')),
        ))),
    ],
    'pinterest' => [
        'client_id' => env('PINTEREST_CLIENT_ID'),
        'client_secret' => env('PINTEREST_CLIENT_SECRET'),
        'redirect' => env(
            'PINTEREST_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/pinterest/callback',
        ),
        'access_token' => env('PINTEREST_ACCESS_TOKEN'),
        'api_base' => rtrim(env('PINTEREST_API_BASE', 'https://api.pinterest.com/v5'), '/'),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('PINTEREST_SCOPES', 'boards:read,pins:read,pins:write,user_accounts:read')),
        ))),
    ],
    'reddit' => [
        'client_id' => env('REDDIT_CLIENT_ID'),
        'client_secret' => env('REDDIT_CLIENT_SECRET'),
        'redirect' => env(
            'REDDIT_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/reddit/callback',
        ),
        'api_base' => rtrim(env('REDDIT_API_BASE', 'https://oauth.reddit.com'), '/'),
        'user_agent' => env('REDDIT_USER_AGENT', 'web:postflow.social-automation:v1.0.0'),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('REDDIT_SCOPES', 'identity,mysubreddits,read,submit,edit')),
        ))),
    ],
    'bluesky' => [
        'pds_url' => rtrim(env('BLUESKY_PDS_URL', 'https://bsky.social'), '/'),
        'app_password' => env('BLUESKY_APP_PASSWORD'),
    ],
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env(
            'GOOGLE_BUSINESS_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/google/callback',
        ),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('GOOGLE_BUSINESS_SCOPES', 'https://www.googleapis.com/auth/business.manage,https://www.googleapis.com/auth/userinfo.profile')),
        ))),
    ],
    'mastodon' => [
        'instance' => rtrim(env('MASTODON_INSTANCE_URL', 'https://mastodon.social'), '/'),
        'client_id' => env('MASTODON_CLIENT_ID'),
        'client_secret' => env('MASTODON_CLIENT_SECRET'),
        'redirect' => env(
            'MASTODON_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/mastodon/callback',
        ),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('MASTODON_SCOPES', 'read:accounts,write:statuses,write:media')),
        ))),
    ],
    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
    ],
    'discord' => [
        'bot_token' => env('DISCORD_BOT_TOKEN'),
    ],
    'threads' => [
        'client_id' => env('THREADS_CLIENT_ID'),
        'client_secret' => env('THREADS_CLIENT_SECRET'),
        'redirect' => env(
            'THREADS_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/threads/callback',
        ),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('THREADS_SCOPES', 'threads_basic,threads_content_publish')),
        ))),
    ],
    'whatsapp' => [
        'access_token' => env('WHATSAPP_ACCESS_TOKEN'),
        'graph_version' => env('WHATSAPP_GRAPH_VERSION', 'v21.0'),
    ],
    'snapchat' => [
        'client_id' => env('SNAPCHAT_CLIENT_ID'),
        'client_secret' => env('SNAPCHAT_CLIENT_SECRET'),
        'redirect' => env(
            'SNAPCHAT_REDIRECT_URI',
            rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/oauth/snapchat/callback',
        ),
        'scopes' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('SNAPCHAT_SCOPES', 'snapchat-marketing-api')),
        ))),
    ],

];
