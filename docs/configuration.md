Social media setup in this project uses **three layers**. Here’s where each piece goes and how to get credentials for every platform.

---

## How configuration works

```
backend/.env                    ← YOU ADD SECRETS HERE (API keys, OAuth)
        ↓
backend/config/services.php     ← Maps env vars → credential groups
        ↓
backend/config/social.php       ← Platform list (labels, limits, capabilities)
        ↓
app/Services/Social/Platforms/  ← Actual API publish logic per network
```

| File | What goes here | Example |
|------|----------------|---------|
| **`backend/.env`** | Secrets only | `FACEBOOK_CLIENT_ID=abc123` |
| **`backend/config/services.php`** | Reads `.env` into groups | `'facebook' => ['client_id' => env('FACEBOOK_CLIENT_ID')]` |
| **`backend/config/social.php`** | Platform metadata (no secrets) | Character limits, icons, service class |
| **Database** (`social_platforms`) | Enable/disable platforms | Seeded from `social.php` |

**Important:** Put credentials in **`backend/.env`**, not in `social.php`. After editing `.env`, run:

```bash
cd backend
php artisan config:clear
```

---

## Demo mode vs real OAuth

When you connect an account in the app:

- If **`client_id` + `redirect`** are empty → **demo mode** (fake account, simulated publishing)
- If both are set → **OAuth mode** (redirect to the provider)

That check is in `SocialAccountController`:

```69:77:backend/app/Http/Controllers/Api/SocialAccountController.php
        if (! empty($credentials['client_id']) && ! empty($credentials['redirect'])) {
            // Real OAuth: hand the SPA an authorize URL with signed state.
            ...
        }

        // Demo mode connection.
```

---

## Full platform configuration list

### OAuth platforms (add to `.env`)

These use `client_id`, `client_secret`, and `redirect` in `config/services.php`.

| Platform(s) in app | Config group | `.env` variables | Where to get credentials |
|--------------------|--------------|------------------|--------------------------|
| **Facebook Page** | `facebook` | `FACEBOOK_CLIENT_ID`<br>`FACEBOOK_CLIENT_SECRET`<br>`FACEBOOK_REDIRECT_URI` | [Meta for Developers](https://developers.facebook.com/) → Create App → Facebook Login + Pages API |
| **Facebook Group** | `facebook` | *(same as above)* | Same Meta app |
| **Instagram Business & Creator** | `instagram` | `INSTAGRAM_CLIENT_ID`<br>`INSTAGRAM_CLIENT_SECRET`<br>`INSTAGRAM_REDIRECT_URI` | [Meta for Developers](https://developers.facebook.com/) → Facebook Login + Instagram Graph API |
| **TikTok** | `tiktok` | `TIKTOK_CLIENT_KEY`<br>`TIKTOK_CLIENT_SECRET`<br>`TIKTOK_REDIRECT_URI`<br>`TIKTOK_SCOPES` | [TikTok for Developers](https://developers.tiktok.com/) → Login Kit + Content Posting API |
| **YouTube** | `youtube` | `GOOGLE_CLIENT_ID`<br>`GOOGLE_CLIENT_SECRET`<br>`YOUTUBE_REDIRECT_URI` | [Google Cloud Console](https://console.cloud.google.com/) → OAuth 2.0 + YouTube Data API v3 |
| **YouTube Shorts** | `youtube` | *(same Google vars)* | Same Google project |
| **X (Twitter)** | `twitter` | `TWITTER_CLIENT_ID`<br>`TWITTER_CLIENT_SECRET`<br>`TWITTER_REDIRECT_URI` | [X Developer Portal](https://developer.x.com/) → OAuth 2.0 app |
| **LinkedIn Profile** | `linkedin` | `LINKEDIN_CLIENT_ID`<br>`LINKEDIN_CLIENT_SECRET`<br>`LINKEDIN_REDIRECT_URI` | [LinkedIn Developers](https://www.linkedin.com/developers/) → Sign In + Share on LinkedIn |
| **LinkedIn Page** | `linkedin` | *(same as above)* | Same LinkedIn app |
| **Pinterest** | `pinterest` | `PINTEREST_CLIENT_ID`<br>`PINTEREST_CLIENT_SECRET`<br>`PINTEREST_REDIRECT_URI` | [Pinterest Developers](https://developers.pinterest.com/) |
| **Reddit** | `reddit` | `REDDIT_CLIENT_ID`<br>`REDDIT_CLIENT_SECRET`<br>`REDDIT_REDIRECT_URI` | [Reddit Apps](https://www.reddit.com/prefs/apps) → create “web app” |

**Example `.env` block:**

```env
APP_URL=http://127.0.0.1:8000

FACEBOOK_CLIENT_ID=your-app-id
FACEBOOK_CLIENT_SECRET=your-app-secret
FACEBOOK_REDIRECT_URI="${APP_URL}/api/oauth/facebook/callback"
FACEBOOK_CONFIG_ID=your-facebook-login-for-business-configuration-id
FACEBOOK_GRAPH_VERSION=v21.0
FACEBOOK_SCOPES=pages_show_list,pages_read_engagement,pages_manage_posts

INSTAGRAM_CLIENT_ID=your-app-id
INSTAGRAM_CLIENT_SECRET=your-app-secret
INSTAGRAM_REDIRECT_URI="${APP_URL}/api/oauth/instagram/callback"
INSTAGRAM_GRAPH_VERSION=v21.0
INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_content_publish

TWITTER_CLIENT_ID=your-client-id
TWITTER_CLIENT_SECRET=your-client-secret
TWITTER_REDIRECT_URI="${APP_URL}/api/oauth/twitter/callback"

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
YOUTUBE_REDIRECT_URI="${APP_URL}/api/oauth/youtube/callback"

LINKEDIN_CLIENT_ID=your-linkedin-id
LINKEDIN_CLIENT_SECRET=your-linkedin-secret
LINKEDIN_REDIRECT_URI="${APP_URL}/api/oauth/linkedin/callback"

TIKTOK_CLIENT_KEY=your-tiktok-key
TIKTOK_CLIENT_SECRET=your-tiktok-secret
TIKTOK_REDIRECT_URI=https://your-public-backend.example/api/oauth/tiktok/callback
TIKTOK_SCOPES=user.info.basic,video.publish

PINTEREST_CLIENT_ID=your-pinterest-id
PINTEREST_CLIENT_SECRET=your-pinterest-secret
PINTEREST_REDIRECT_URI="${APP_URL}/api/oauth/pinterest/callback"

REDDIT_CLIENT_ID=your-reddit-id
REDDIT_CLIENT_SECRET=your-reddit-secret
REDDIT_REDIRECT_URI="${APP_URL}/api/oauth/reddit/callback"
```

`FACEBOOK_CONFIG_ID` is optional. If it is set, Meta takes the permissions from
that Facebook Login for Business configuration, so it must include every
permission in `FACEBOOK_SCOPES`. Leave it blank to use the explicit OAuth scope list.

The Instagram connection uses Instagram Login for Business. Use the App ID and
App Secret shown under Meta App Dashboard → Instagram → API setup with Instagram
business login. Do not substitute the Facebook Login App ID.

TikTok requires Login Kit and the Content Posting API with `user.info.basic` and
`video.publish` approved for the app. Its redirect URI must be a public HTTPS URL
and must exactly match the URI registered in TikTok for Developers, including the
path and trailing slash choice. Localhost HTTP callback URLs are rejected by TikTok.

For local Instagram OAuth, configure the Meta app as follows:

- Instagram → API setup with Instagram business login → OAuth redirect URI:
  `http://localhost:8000/api/oauth/instagram/callback`
- App permissions: `instagram_business_basic` and
  `instagram_business_content_publish`
- In Development mode, add the Instagram professional account as an Instagram tester.

**Redirect URIs:** Each provider’s developer console must allow the exact callback URL (e.g. `http://127.0.0.1:8000/api/oauth/facebook/callback` locally, your production API domain in prod).

---

### Bot / token platforms (add to `.env`)

| Platform | `.env` variable | Where to get it |
|----------|-----------------|-----------------|
| **Telegram Channel** | `TELEGRAM_BOT_TOKEN` | Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` |
| **Discord Channel** | `DISCORD_BOT_TOKEN` | [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Token |

Defined in `config/services.php`:

```113:118:backend/config/services.php
    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
    ],
    'discord' => [
        'bot_token' => env('DISCORD_BOT_TOKEN'),
    ],
```

**Note:** Discord publishing in this app uses a **per-channel webhook URL** stored on the account (`settings.webhook_url`), not only the bot token.

---

### Per-account credentials (no global `.env` yet)

These platforms use **account-level** settings when connecting (not fully wired in `.env` yet):

| Platform | How it works | What you need |
|----------|--------------|---------------|
| **Bluesky** | App password per account | Handle + app password from Bluesky settings |
| **Mastodon** | Per-instance OAuth | Instance URL (e.g. `https://mastodon.social`) + access token |
| **Discord** | Webhook per channel | Webhook URL from Discord channel settings |
| **Google Business Profile** | Google OAuth | Needs `google` group in `services.php` (not added yet — uses demo mode) |
| **Threads** | Meta OAuth | Needs `threads` group in `services.php` (not added yet) |
| **WhatsApp Business** | Meta Cloud API | Business API token + phone number ID |
| **Snapchat** | Snapchat Marketing API | OAuth app from Snap Developer Portal |

For these, you’d extend `config/services.php` and `.env.example` when you wire full OAuth.

---

## Shared credentials (one app, multiple platforms)

Several app platforms share one OAuth app:

| One `.env` setup | Covers these platforms |
|------------------|------------------------|
| `FACEBOOK_*` | Facebook Page + Facebook Group |
| `INSTAGRAM_*` (or same Meta app) | Instagram Business |
| `GOOGLE_*` + `YOUTUBE_REDIRECT_URI` | YouTube + YouTube Shorts |
| `LINKEDIN_*` | LinkedIn Profile + LinkedIn Page |

The link is the **`group`** field in `config/social.php`:

```35:38:backend/config/social.php
        'facebook_page' => [
            'label' => 'Facebook Page',
            'group' => 'facebook',
```

---

## Global publishing settings (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOCIAL_PUBLISH_RETRIES` | `3` | Retries after failed publish |
| `APP_TIMEZONE` | `UTC` | Default scheduling timezone |

From `config/social.php`:

```22:31:backend/config/social.php
    'default_timezone' => env('APP_TIMEZONE', 'UTC'),
    'publish_retries' => env('SOCIAL_PUBLISH_RETRIES', 3),
    'token_expiry_warning_days' => 5,
```

---

## Where to edit platform behavior (not secrets)

| What you want to change | File |
|-------------------------|------|
| Character limits, image counts | `backend/config/social.php` → `limits` |
| Enable text/video/carousel | `backend/config/social.php` → `capabilities` |
| Platform label / color in UI | `backend/config/social.php` |
| Publish API logic | `backend/app/Services/Social/Platforms/*.php` |
| Enable/disable in DB | `social_platforms` table (seeded by `SocialPlatformSeeder`) |

---

## Quick start checklist

1. Copy `backend/.env.example` → `backend/.env`
2. Add credentials for the platforms you need (start with one, e.g. Twitter)
3. Set redirect URIs in the provider’s developer console
4. Run `php artisan config:clear`
5. Restart backend + queue worker
6. In the app: **Accounts** → Connect → should redirect to OAuth instead of demo

---

## Currently configured in `services.php`

These groups exist today:

- `facebook`, `instagram`, `tiktok`, `youtube`, `twitter`, `linkedin`, `pinterest`, `reddit`, `telegram`, `discord`

**Not yet in `services.php`** (stay demo unless you add them):

- `google` (Google Business)
- `threads`, `bluesky`, `mastodon`, `whatsapp`, `snapchat`

If you want, I can add the missing entries to `services.php` and `.env.example` for Google Business, Threads, WhatsApp, and Snapchat so they follow the same pattern as Facebook/Twitter.
