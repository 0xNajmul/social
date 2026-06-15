<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialAccountResource;
use App\Jobs\RefreshSocialTokenJob;
use App\Models\SocialAccount;
use App\Services\ActivityLogger;
use App\Services\Billing\UsageGuard;
use App\Services\Social\Platforms\TikTokService;
use App\Services\Social\SocialManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SocialAccountController extends Controller
{
    public function __construct(
        protected SocialManager $manager,
        protected UsageGuard $usage,
        protected ActivityLogger $activity,
    ) {}

    public function index(): JsonResponse
    {
        $accounts = workspace()->socialAccounts()->latest()->get();

        return response()->json(['data' => SocialAccountResource::collection($accounts)]);
    }

    /**
     * List all platforms the system can connect to (config-driven).
     */
    public function platforms(): JsonResponse
    {
        $platforms = collect(config('social.platforms'))->map(fn ($cfg, $key) => [
            'key' => $key,
            'label' => $cfg['label'],
            'group' => $cfg['group'],
            'icon' => $cfg['icon'],
            'color' => $cfg['color'],
            'capabilities' => $cfg['capabilities'],
            'limits' => $cfg['limits'] ?? [],
        ])->values();

        return response()->json(['data' => $platforms]);
    }

    /**
     * Begin connecting an account.
     *
     * With OAuth credentials configured this returns the provider's
     * authorization URL. Without them (demo mode) it immediately creates a
     * simulated connected account so the rest of the product is usable.
     */
    public function connect(Request $request): JsonResponse
    {
        $workspace = $request->attributes->get('workspace');
        $data = $request->validate([
            'platform' => ['required', 'string', 'in:'.implode(',', $this->manager->platforms())],
        ]);

        $this->usage->ensure($workspace, 'social_accounts');

        $platform = $data['platform'];
        if ($platform === 'youtube_shorts') {
            $platform = 'youtube';
        }
        $group = config("social.platforms.{$platform}.group");
        $credentials = config("services.{$group}");

        // Credential-based platforms connect directly instead of redirecting to OAuth.
        if ($this->isDirectConnectPlatform($platform)) {
            return $this->connectDirectPlatform($request, $platform, $workspace->id, $request->user()->id);
        }

        if ($platform === 'instagram' && (empty($credentials['client_id']) || empty($credentials['client_secret']))) {
            return response()->json([
                'message' => 'Instagram Login is not configured. Add the Instagram App ID and App Secret from Meta App Dashboard → Instagram → API setup with Instagram business login.',
                'hint' => 'Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET in backend/.env. Do not use the Facebook App ID unless Meta shows that exact ID in the Instagram API setup screen.',
            ], 422);
        }

        if ($platform === 'tiktok') {
            if (empty($credentials['client_id']) || empty($credentials['client_secret']) || empty($credentials['redirect'])) {
                return response()->json([
                    'message' => 'TikTok Login Kit is not configured.',
                    'hint' => 'Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and an HTTPS TIKTOK_REDIRECT_URI in backend/.env.',
                ], 422);
            }

            if (! str_starts_with($credentials['redirect'], 'https://')) {
                return response()->json([
                    'message' => 'TikTok requires an HTTPS redirect URI.',
                    'hint' => 'Expose the backend through an HTTPS tunnel, register its /api/oauth/tiktok/callback URL in TikTok Login Kit, and set TIKTOK_REDIRECT_URI to that exact URL.',
                ], 422);
            }
        }

        if ($platform === 'mastodon') {
            if (empty($credentials['instance']) || empty($credentials['client_id']) || empty($credentials['client_secret']) || empty($credentials['redirect'])) {
                return response()->json([
                    'message' => 'Mastodon OAuth is not configured.',
                    'hint' => 'Set MASTODON_INSTANCE_URL, MASTODON_CLIENT_ID, MASTODON_CLIENT_SECRET, and MASTODON_REDIRECT_URI in backend/.env.',
                ], 422);
            }

            if (! filter_var($credentials['instance'], FILTER_VALIDATE_URL) || ! str_starts_with($credentials['instance'], 'https://')) {
                return response()->json([
                    'message' => 'Mastodon requires a valid HTTPS instance URL.',
                ], 422);
            }
        }

        if (str_starts_with($platform, 'linkedin_')
            && (empty($credentials['client_id']) || empty($credentials['client_secret']) || empty($credentials['redirect']))) {
            return response()->json([
                'message' => 'LinkedIn OAuth is not configured.',
                'hint' => 'Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI in backend/.env.',
            ], 422);
        }

        if (! empty($credentials['client_id']) && ! empty($credentials['redirect'])) {
            $state = encrypt([
                'workspace_id' => $workspace->id,
                'platform' => $platform,
                'user_id' => $request->user()->id,
                'nonce' => Str::random(16),
            ]);

            return response()->json([
                'mode' => 'oauth',
                'redirect_url' => $this->authorizeUrl($platform, $credentials, $state),
            ]);
        }

        // Demo mode connection.
        $account = $this->createDemoAccount($workspace->id, $platform, $request->user()->id);
        $this->activity->log($workspace->id, 'account.connected', $account, "Connected {$account->name}");

        return response()->json([
            'mode' => 'demo',
            'data' => new SocialAccountResource($account),
        ], 201);
    }

    public function refresh(SocialAccount $socialAccount): JsonResponse
    {
        $this->authorize('view', $socialAccount);
        RefreshSocialTokenJob::dispatch($socialAccount->id);

        return response()->json(['message' => 'Token refresh queued.']);
    }

    public function destroy(SocialAccount $socialAccount): JsonResponse
    {
        $this->authorize('delete', $socialAccount);
        $socialAccount->delete();

        return response()->json(['message' => 'Account disconnected.']);
    }

    public function creatorInfo(SocialAccount $socialAccount): JsonResponse
    {
        $this->authorize('view', $socialAccount);

        if ($socialAccount->platform !== 'tiktok') {
            return response()->json(['message' => 'Creator settings are only available for TikTok accounts.'], 422);
        }

        try {
            $info = app(TikTokService::class)->creatorInfo($socialAccount);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        $socialAccount->update([
            'settings' => array_merge($socialAccount->settings ?? [], ['creator_info' => $info]),
            'last_synced_at' => now(),
        ]);

        return response()->json(['data' => $info]);
    }

    protected function authorizeUrl(string $platform, array $credentials, string $state): string
    {
        $group = config("social.platforms.{$platform}.group", $platform);
        $oauthGroup = match ($group) {
            'youtube' => 'google',
            default => $group,
        };

        $facebookVersion = $credentials['graph_version'] ?? 'v21.0';
        $endpoints = [
            'facebook' => "https://www.facebook.com/{$facebookVersion}/dialog/oauth",
            'instagram' => 'https://www.instagram.com/oauth/authorize',
            'linkedin' => 'https://www.linkedin.com/oauth/v2/authorization',
            'twitter' => 'https://twitter.com/i/oauth2/authorize',
            'google' => 'https://accounts.google.com/o/oauth2/v2/auth',
            'pinterest' => 'https://www.pinterest.com/oauth/',
            'reddit' => 'https://www.reddit.com/api/v1/authorize',
        ];

        $base = $endpoints[$oauthGroup] ?? 'https://accounts.google.com/o/oauth2/v2/auth';

        if ($oauthGroup === 'tiktok') {
            return 'https://www.tiktok.com/v2/auth/authorize/?'.http_build_query([
                'client_key' => $credentials['client_id'],
                'redirect_uri' => $credentials['redirect'],
                'response_type' => 'code',
                'scope' => implode(',', $credentials['scopes'] ?? []),
                'state' => $state,
            ]);
        }

        if ($oauthGroup === 'mastodon') {
            $instance = rtrim($credentials['instance'], '/');

            return "{$instance}/oauth/authorize?".http_build_query([
                'client_id' => $credentials['client_id'],
                'redirect_uri' => $credentials['redirect'],
                'response_type' => 'code',
                'scope' => implode(' ', $credentials['scopes'] ?? []),
                'state' => $state,
                'force_login' => 'true',
            ]);
        }

        $params = [
            'client_id' => $credentials['client_id'],
            'redirect_uri' => $credentials['redirect'],
            'response_type' => 'code',
            'state' => $state,
        ];

        if ($oauthGroup === 'google') {
            $params['scope'] = implode(' ', [
                'https://www.googleapis.com/auth/youtube.upload',
                'https://www.googleapis.com/auth/youtube.readonly',
                'https://www.googleapis.com/auth/userinfo.profile',
            ]);
            $params['access_type'] = 'offline';
            $params['prompt'] = 'consent';
        }

        if ($oauthGroup === 'facebook') {
            $params['scope'] = implode(',', $credentials['scopes'] ?? []);
            $params['auth_type'] = 'rerequest';

            if (! empty($credentials['config_id'])) {
                $params['config_id'] = $credentials['config_id'];
            }
        }

        if ($oauthGroup === 'instagram') {
            $params['scope'] = implode(',', $credentials['scopes'] ?? []);
            $params['enable_fb_login'] = 0;
            $params['force_authentication'] = 1;
        }

        if ($oauthGroup === 'linkedin') {
            $scopeKey = $platform === 'linkedin_page' ? 'page_scopes' : 'profile_scopes';
            $params['scope'] = implode(' ', $credentials[$scopeKey] ?? []);
        }

        return $base.'?'.http_build_query($params);
    }

    protected function createDemoAccount(int $workspaceId, string $platform, int $userId): SocialAccount
    {
        $label = config("social.platforms.{$platform}.label");
        $handle = Str::slug($label).'_'.Str::lower(Str::random(4));

        return SocialAccount::create([
            'workspace_id' => $workspaceId,
            'connected_by' => $userId,
            'platform' => $platform,
            'provider_account_id' => (string) random_int(10_000_000, 99_999_999),
            'name' => $label.' Demo Account',
            'username' => '@'.$handle,
            'avatar_url' => "https://api.dicebear.com/7.x/initials/svg?seed={$handle}",
            'profile_url' => "https://example.com/{$handle}",
            'access_token' => 'demo-token-'.Str::random(20),
            'token_expires_at' => now()->addDays(60),
            'status' => 'active',
        ]);
    }

    protected function isDirectConnectPlatform(string $platform): bool
    {
        return in_array($platform, ['telegram', 'discord', 'bluesky'], true);
    }

    /**
     * Connect platforms that use server-side credentials plus a user-supplied
     * account or channel identifier.
     */
    protected function connectDirectPlatform(Request $request, string $platform, int $workspaceId, int $userId): JsonResponse
    {
        return match ($platform) {
            'telegram' => $this->connectTelegram($request, $workspaceId, $userId),
            'discord' => $this->connectDiscord($request, $workspaceId, $userId),
            'bluesky' => $this->connectBluesky($request, $workspaceId, $userId),
            default => response()->json(['message' => 'Unsupported direct connection platform.'], 422),
        };
    }

    protected function connectBluesky(Request $request, int $workspaceId, int $userId): JsonResponse
    {
        $credentials = config('services.bluesky', []);
        $pds = rtrim((string) ($credentials['pds_url'] ?? 'https://bsky.social'), '/');
        $appPassword = (string) ($credentials['app_password'] ?? '');

        if ($appPassword === '') {
            return response()->json([
                'message' => 'Bluesky app-password authentication is not configured.',
                'hint' => 'Create an app password in Bluesky settings and set BLUESKY_APP_PASSWORD in backend/.env.',
            ], 422);
        }

        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
        ]);
        $identifier = trim($data['identifier']);

        $sessionResponse = Http::timeout(20)->post("{$pds}/xrpc/com.atproto.server.createSession", [
            'identifier' => $identifier,
            'password' => $appPassword,
        ]);
        if (! $sessionResponse->successful()) {
            return response()->json([
                'message' => $sessionResponse->json('message') ?? 'Bluesky could not authenticate this account.',
                'hint' => 'Enter the Bluesky handle or account email that owns the configured app password.',
            ], 422);
        }

        $session = $sessionResponse->json();
        $did = (string) ($session['did'] ?? '');
        $handle = (string) ($session['handle'] ?? $identifier);
        $accessJwt = $session['accessJwt'] ?? null;
        $refreshJwt = $session['refreshJwt'] ?? null;
        if ($did === '' || ! $accessJwt || ! $refreshJwt) {
            return response()->json(['message' => 'Bluesky returned an incomplete login session.'], 422);
        }

        $profileResponse = Http::timeout(15)->get('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile', [
            'actor' => $did,
        ]);
        $profile = $profileResponse->successful() ? $profileResponse->json() : [];

        $account = SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspaceId,
                'platform' => 'bluesky',
                'provider_account_id' => $did,
            ],
            [
                'connected_by' => $userId,
                'name' => $profile['displayName'] ?? $handle,
                'username' => '@'.ltrim($handle, '@'),
                'avatar_url' => $profile['avatar'] ?? null,
                'profile_url' => 'https://bsky.app/profile/'.ltrim($handle, '@'),
                'access_token' => $accessJwt,
                'refresh_token' => $refreshJwt,
                'token_meta' => [
                    'handle' => $handle,
                    'email' => $session['email'] ?? null,
                ],
                'token_expires_at' => $this->jwtExpiresAt($accessJwt),
                'status' => 'active',
                'status_message' => null,
                'settings' => ['pds_url' => $pds],
                'last_synced_at' => now(),
            ],
        );

        $this->activity->log($workspaceId, 'account.connected', $account, "Connected Bluesky: @{$handle}");

        return response()->json([
            'mode' => 'credentials',
            'data' => new SocialAccountResource($account),
        ], 201);
    }

    protected function jwtExpiresAt(string $jwt): ?\DateTimeInterface
    {
        $payload = explode('.', $jwt)[1] ?? null;
        if (! $payload) {
            return null;
        }

        $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);
        $expiresAt = $decoded ? data_get(json_decode($decoded, true), 'exp') : null;

        return is_numeric($expiresAt) ? now()->setTimestamp((int) $expiresAt) : null;
    }

    protected function connectTelegram(Request $request, int $workspaceId, int $userId): JsonResponse
    {
        $token = config('services.telegram.bot_token');

        if (empty($token)) {
            return response()->json([
                'message' => 'TELEGRAM_BOT_TOKEN is not set in backend/.env. Add your bot token from @BotFather, then run: php artisan config:clear',
            ], 422);
        }

        $data = $request->validate([
            'chat_id' => ['required', 'string', 'max:255'],
        ]);

        $chatId = trim($data['chat_id']);
        $response = Http::timeout(15)->get("https://api.telegram.org/bot{$token}/getChat", [
            'chat_id' => $chatId,
        ]);
        $payload = $response->json();

        if (! $response->successful() || ! ($payload['ok'] ?? false)) {
            return response()->json([
                'message' => $payload['description'] ?? 'Telegram could not access this chat.',
                'hint' => 'Add your bot as an administrator of the channel, then use @YourChannelName or the numeric chat id (e.g. -1001234567890).',
            ], 422);
        }

        $chat = $payload['result'];
        $numericId = (string) $chat['id'];
        $username = isset($chat['username']) ? '@'.$chat['username'] : $numericId;
        $title = $chat['title'] ?? $chat['first_name'] ?? 'Telegram Channel';

        $account = SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspaceId,
                'platform' => 'telegram',
                'provider_account_id' => $numericId,
            ],
            [
                'connected_by' => $userId,
                'name' => $title,
                'username' => $username,
                'avatar_url' => 'https://api.dicebear.com/7.x/initials/svg?seed='.urlencode($title),
                'profile_url' => isset($chat['username']) ? "https://t.me/{$chat['username']}" : null,
                'access_token' => $token,
                'token_expires_at' => null,
                'status' => 'active',
                'status_message' => null,
                'settings' => ['chat_id' => $numericId, 'input' => $chatId],
            ],
        );

        $this->activity->log($workspaceId, 'account.connected', $account, "Connected Telegram: {$title}");

        return response()->json([
            'mode' => 'bot',
            'data' => new SocialAccountResource($account),
        ], 201);
    }

    protected function connectDiscord(Request $request, int $workspaceId, int $userId): JsonResponse
    {
        $data = $request->validate([
            'webhook_url' => ['required', 'url', 'starts_with:https://discord.com/api/webhooks/,https://discordapp.com/api/webhooks/'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);

        $webhookUrl = $data['webhook_url'];
        $response = Http::timeout(15)->get($webhookUrl);
        $payload = $response->json();

        if (! $response->successful()) {
            return response()->json(['message' => 'Invalid Discord webhook URL.'], 422);
        }

        $name = $data['name'] ?? ($payload['name'] ?? 'Discord Channel');
        $channelId = (string) ($payload['channel_id'] ?? md5($webhookUrl));

        $account = SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspaceId,
                'platform' => 'discord',
                'provider_account_id' => $channelId,
            ],
            [
                'connected_by' => $userId,
                'name' => $name,
                'username' => '#'.($payload['channel_id'] ?? 'channel'),
                'access_token' => 'webhook',
                'status' => 'active',
                'status_message' => null,
                'settings' => ['webhook_url' => $webhookUrl],
            ],
        );

        $this->activity->log($workspaceId, 'account.connected', $account, "Connected Discord: {$name}");

        return response()->json([
            'mode' => 'bot',
            'data' => new SocialAccountResource($account),
        ], 201);
    }
}
