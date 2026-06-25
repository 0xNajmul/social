<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use App\Models\User;
use App\Models\Workspace;
use App\Services\ActivityLogger;
use App\Services\Social\Platforms\PinterestService;
use App\Services\Social\Platforms\RedditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Handles OAuth callbacks from social providers after the user authorizes access.
 */
class OAuthController extends Controller
{
    public function __construct(protected ActivityLogger $activity) {}

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $frontend = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
        $accountsUrl = "{$frontend}/app/accounts";

        if ($oauthError = $this->oauthError($request)) {
            Log::warning('Social OAuth authorization failed', [
                'provider' => $provider,
                'error' => $oauthError,
                'error_code' => $request->input('error_code'),
                'error_reason' => $request->input('error_reason'),
            ]);

            return redirect("{$accountsUrl}?oauth_error=".urlencode($oauthError));
        }

        $code = $request->string('code');
        $stateRaw = $request->string('state');

        if ($code->isEmpty() || $stateRaw->isEmpty()) {
            Log::warning('Social OAuth callback missing code or state', [
                'provider' => $provider,
                'has_code' => ! $code->isEmpty(),
                'has_state' => ! $stateRaw->isEmpty(),
                'query_keys' => array_keys($request->query()),
            ]);

            $providerName = ucfirst($provider);
            $message = $code->isEmpty()
                ? "{$providerName} returned no authorization code. Check the requested scopes, app review status, and exact redirect URI."
                : "{$providerName} returned no OAuth state. Start the connection again from the Accounts page.";

            return redirect("{$accountsUrl}?oauth_error=".urlencode($message));
        }

        try {
            $state = decrypt($stateRaw->toString());
        } catch (\Throwable) {
            return redirect("{$accountsUrl}?oauth_error=invalid_state");
        }

        $platform = $state['platform'] ?? $provider;
        $workspaceId = (int) ($state['workspace_id'] ?? 0);
        $userId = (int) ($state['user_id'] ?? 0);

        $workspace = Workspace::find($workspaceId);
        $user = User::find($userId);

        if (! $workspace || ! $user) {
            return redirect("{$accountsUrl}?oauth_error=invalid_workspace");
        }

        $group = config("social.platforms.{$platform}.group", $provider);
        $credentials = config("services.{$group}");

        $requiresClientSecret = $this->oauthGroup($platform) !== 'twitter';
        if (empty($credentials['client_id']) || empty($credentials['redirect']) || ($requiresClientSecret && empty($credentials['client_secret']))) {
            return redirect("{$accountsUrl}?oauth_error=missing_credentials");
        }

        try {
            $accounts = match ($this->oauthGroup($platform)) {
                'facebook' => $this->connectFacebook($platform, $workspace, $user, $code->toString(), $credentials),
                'instagram' => $this->connectInstagram($workspace, $user, $code->toString(), $credentials),
                'tiktok' => $this->connectTikTok($workspace, $user, $code->toString(), $credentials),
                'google' => $platform === 'google_business'
                    ? $this->connectGoogleBusiness($workspace, $user, $code->toString(), $credentials)
                    : $this->connectYouTube($platform, $workspace, $user, $code->toString(), $credentials),
                'twitter' => $this->connectTwitter($workspace, $user, $code->toString(), $credentials, $state),
                'linkedin' => $this->connectLinkedIn($platform, $workspace, $user, $code->toString(), $credentials),
                'pinterest' => $this->connectPinterest($workspace, $user, $code->toString(), $credentials),
                'threads' => $this->connectThreads($workspace, $user, $code->toString(), $credentials),
                'mastodon' => $this->connectMastodon($workspace, $user, $code->toString(), $credentials),
                'reddit' => $this->connectReddit($workspace, $user, $code->toString(), $credentials),
                'snapchat' => $this->connectSnapchat($workspace, $user, $code->toString(), $credentials),
                default => throw new \RuntimeException("OAuth callback not implemented for {$platform}."),
            };
        } catch (\Throwable $e) {
            report($e);

            return redirect("{$accountsUrl}?oauth_error=".urlencode($e->getMessage()));
        }

        $accounts = $accounts instanceof SocialAccount ? [$accounts] : $accounts;
        foreach ($accounts as $account) {
            $this->activity->log($workspace->id, 'account.connected', $account, "Connected {$account->name}", userId: $user->id);
        }

        return redirect("{$accountsUrl}?connected=".urlencode($platform).'&connected_count='.count($accounts));
    }

    /** @return array<int, SocialAccount> */
    protected function connectFacebook(string $platform, Workspace $workspace, User $user, string $code, array $credentials): array
    {
        if ($platform !== 'facebook_page') {
            throw new \RuntimeException('Facebook Groups are not supported by this connection flow. Connect a Facebook Page instead.');
        }

        $version = $credentials['graph_version'] ?? 'v21.0';
        $graph = "https://graph.facebook.com/{$version}";
        $tokenResponse = Http::get("{$graph}/oauth/access_token", [
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'redirect_uri' => $credentials['redirect'],
            'code' => $code,
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException($tokenResponse->json('error.message') ?? 'Facebook token exchange failed.');
        }

        $tokens = $tokenResponse->json();
        $userAccessToken = $tokens['access_token'] ?? null;
        if (! $userAccessToken) {
            throw new \RuntimeException('Facebook did not return an access token.');
        }

        // Prefer a long-lived user token so derived Page connections remain usable.
        $longLivedResponse = Http::get("{$graph}/oauth/access_token", [
            'grant_type' => 'fb_exchange_token',
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'fb_exchange_token' => $userAccessToken,
        ]);
        if ($longLivedResponse->successful() && $longLivedResponse->json('access_token')) {
            $tokens = $longLivedResponse->json();
            $userAccessToken = $tokens['access_token'];
        }

        $permissionsResponse = Http::get("{$graph}/me/permissions", [
            'access_token' => $userAccessToken,
        ]);
        if (! $permissionsResponse->successful()) {
            throw new \RuntimeException($permissionsResponse->json('error.message') ?? 'Could not verify Facebook permissions.');
        }

        $grantedScopes = collect($permissionsResponse->json('data', []))
            ->where('status', 'granted')
            ->pluck('permission')
            ->filter()
            ->values()
            ->all();
        $requiredScopes = $credentials['scopes'] ?? [];
        $missingScopes = array_values(array_diff($requiredScopes, $grantedScopes));

        if ($missingScopes) {
            $configId = $credentials['config_id'] ?? null;
            $configuration = $configId ? " configuration {$configId}" : ' configuration';

            throw new \RuntimeException(
                'Facebook did not grant: '.implode(', ', $missingScopes).'. '
                ."Add these permissions to your Facebook Login for Business{$configuration}, then reconnect the Page."
            );
        }

        $pagesResponse = Http::get("{$graph}/me/accounts", [
            'fields' => 'id,name,username,link,picture.type(large),access_token,tasks',
            'limit' => 100,
            'access_token' => $userAccessToken,
        ]);

        if (! $pagesResponse->successful()) {
            throw new \RuntimeException($pagesResponse->json('error.message') ?? 'Could not load your Facebook Pages.');
        }

        $pages = $pagesResponse->json('data', []);
        if (empty($pages)) {
            throw new \RuntimeException('No Facebook Pages were returned. Make sure you manage a Page and granted pages_show_list, pages_read_engagement, and pages_manage_posts.');
        }

        $expiresAt = isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null;
        $scopes = $grantedScopes;

        $accounts = collect($pages)->map(function (array $page) use ($workspace, $user, $userAccessToken, $expiresAt, $scopes) {
            $pageId = (string) ($page['id'] ?? '');
            $pageToken = $page['access_token'] ?? null;
            if ($pageId === '' || ! $pageToken) {
                return null;
            }

            $name = $page['name'] ?? 'Facebook Page';
            $username = $page['username'] ?? null;
            $tasks = $page['tasks'] ?? [];

            return SocialAccount::upsertConnection(
                [
                    'workspace_id' => $workspace->id,
                    'platform' => 'facebook_page',
                    'provider_account_id' => $pageId,
                ],
                [
                    'connected_by' => $user->id,
                    'name' => $name,
                    'username' => $username ? '@'.ltrim($username, '@') : null,
                    'avatar_url' => data_get($page, 'picture.data.url'),
                    'profile_url' => $page['link'] ?? "https://www.facebook.com/{$pageId}",
                    'access_token' => $pageToken,
                    'token_meta' => [
                        'user_access_token' => $userAccessToken,
                        'page_access_token' => $pageToken,
                        'scopes' => $scopes,
                        'tasks' => $tasks,
                        'permissions_verified_at' => now()->toIso8601String(),
                    ],
                    'token_expires_at' => $expiresAt,
                    'status' => 'active',
                    'status_message' => null,
                    'settings' => ['tasks' => $tasks],
                    'last_synced_at' => now(),
                ],
            );
        })->filter()->values()->all();

        if (empty($accounts)) {
            throw new \RuntimeException('Facebook returned Pages without usable Page access tokens. Reconnect and grant all requested Page permissions.');
        }

        return $accounts;
    }

    protected function connectInstagram(Workspace $workspace, User $user, string $code, array $credentials): SocialAccount
    {
        $tokenResponse = Http::asForm()->post('https://api.instagram.com/oauth/access_token', [
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'grant_type' => 'authorization_code',
            'redirect_uri' => $credentials['redirect'],
            'code' => $code,
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_message')
                ?? $tokenResponse->json('error.message')
                ?? 'Instagram token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('Instagram did not return an access token.');
        }

        $longLivedResponse = Http::get('https://graph.instagram.com/access_token', [
            'grant_type' => 'ig_exchange_token',
            'client_secret' => $credentials['client_secret'],
            'access_token' => $accessToken,
        ]);
        if ($longLivedResponse->successful() && $longLivedResponse->json('access_token')) {
            $tokens = array_merge($tokens, $longLivedResponse->json());
            $accessToken = $tokens['access_token'];
        }

        $version = $credentials['graph_version'] ?? 'v21.0';
        $profileResponse = Http::get("https://graph.instagram.com/{$version}/me", [
            'fields' => 'id,user_id,username,name,account_type,profile_picture_url',
            'access_token' => $accessToken,
        ]);
        if (! $profileResponse->successful()) {
            throw new \RuntimeException($profileResponse->json('error.message') ?? 'Could not load your Instagram professional account.');
        }

        $profile = $profileResponse->json('data.0') ?? $profileResponse->json();
        $accountType = strtoupper((string) ($profile['account_type'] ?? ''));
        if ($accountType === 'CREATOR') {
            $accountType = 'MEDIA_CREATOR';
        }
        if (! in_array($accountType, ['BUSINESS', 'MEDIA_CREATOR'], true)) {
            throw new \RuntimeException('Only Instagram Business and Creator accounts are supported. Change the Instagram account to a professional account, then reconnect.');
        }

        $instagramUserId = (string) ($profile['user_id'] ?? $profile['id'] ?? $tokens['user_id'] ?? '');
        if ($instagramUserId === '') {
            throw new \RuntimeException('Instagram did not return a professional account ID.');
        }

        $username = $profile['username'] ?? null;
        $name = $profile['name'] ?? ($username ? '@'.$username : 'Instagram Professional Account');
        $expiresAt = isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null;

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'instagram',
                'provider_account_id' => $instagramUserId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $name,
                'username' => $username ? '@'.ltrim($username, '@') : null,
                'avatar_url' => $profile['profile_picture_url'] ?? null,
                'profile_url' => $username ? 'https://www.instagram.com/'.ltrim($username, '@').'/' : null,
                'access_token' => $accessToken,
                'refresh_token' => null,
                'token_meta' => [
                    'auth_provider' => 'instagram',
                    'scopes' => $credentials['scopes'] ?? [],
                    'permissions_verified_at' => now()->toIso8601String(),
                    'instagram_app_user_id' => $profile['id'] ?? null,
                ],
                'token_expires_at' => $expiresAt,
                'status' => 'active',
                'status_message' => null,
                'settings' => [
                    'account_type' => $accountType,
                    'account_type_label' => $accountType === 'MEDIA_CREATOR' ? 'Creator' : 'Business',
                ],
                'last_synced_at' => now(),
            ],
        );
    }

    protected function connectYouTube(string $platform, Workspace $workspace, User $user, string $code, array $credentials): SocialAccount
    {
        $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'redirect_uri' => $credentials['redirect'],
            'grant_type' => 'authorization_code',
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException($tokenResponse->json('error_description') ?? 'Google token exchange failed.');
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;

        if (! $accessToken) {
            throw new \RuntimeException('Google did not return an access token.');
        }

        $channelResponse = Http::withToken($accessToken)
            ->get('https://www.googleapis.com/youtube/v3/channels', [
                'part' => 'snippet,contentDetails',
                'mine' => 'true',
            ]);

        if (! $channelResponse->successful()) {
            throw new \RuntimeException('Could not load your YouTube channel. Enable YouTube Data API v3 in Google Cloud.');
        }

        $channel = $channelResponse->json('items.0');

        if (! $channel) {
            throw new \RuntimeException('No YouTube channel found on this Google account.');
        }

        $snippet = $channel['snippet'] ?? [];
        $channelId = (string) ($channel['id'] ?? '');
        $title = $snippet['title'] ?? 'YouTube Channel';
        $customUrl = $snippet['customUrl'] ?? null;
        $thumb = $snippet['thumbnails']['default']['url'] ?? null;

        $existing = SocialAccount::where('workspace_id', $workspace->id)
            ->where('platform', $platform)
            ->where('provider_account_id', $channelId)
            ->first();

        $attributes = [
            'connected_by' => $user->id,
            'name' => $title,
            'username' => $customUrl ? '@'.ltrim($customUrl, '@') : $channelId,
            'avatar_url' => $thumb,
            'profile_url' => $customUrl
                ? 'https://www.youtube.com/'.ltrim($customUrl, '@')
                : "https://www.youtube.com/channel/{$channelId}",
            'access_token' => $accessToken,
            'token_expires_at' => isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
            'token_meta' => ['scope' => $tokens['scope'] ?? null],
            'status' => 'active',
            'settings' => [
                'uploads_playlist_id' => data_get($channel, 'contentDetails.relatedPlaylists.uploads'),
            ],
        ];

        // Google only returns refresh_token on first consent — keep the existing one.
        if (! empty($tokens['refresh_token'])) {
            $attributes['refresh_token'] = $tokens['refresh_token'];
        } elseif ($existing?->refresh_token) {
            $attributes['refresh_token'] = $existing->refresh_token;
        }

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => $platform,
                'provider_account_id' => $channelId,
            ],
            $attributes,
        );
    }

    protected function connectTikTok(Workspace $workspace, User $user, string $code, array $credentials): SocialAccount
    {
        $tokenResponse = Http::asForm()->post('https://open.tiktokapis.com/v2/oauth/token/', [
            'client_key' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $credentials['redirect'],
        ]);

        if (! $tokenResponse->successful() || $tokenResponse->json('error')) {
            throw new \RuntimeException($tokenResponse->json('error_description') ?? 'TikTok token exchange failed.');
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        $openId = (string) ($tokens['open_id'] ?? '');
        if (! $accessToken || $openId === '') {
            throw new \RuntimeException('TikTok did not return an access token and user ID.');
        }

        $grantedScopes = array_values(array_filter(explode(',', (string) ($tokens['scope'] ?? ''))));
        $missingScopes = array_values(array_diff($credentials['scopes'] ?? [], $grantedScopes));
        if ($missingScopes) {
            throw new \RuntimeException('TikTok did not grant: '.implode(', ', $missingScopes).'. Enable these products/scopes and reconnect.');
        }

        $userResponse = Http::withToken($accessToken)
            ->get('https://open.tiktokapis.com/v2/user/info/', [
                'fields' => 'open_id,union_id,avatar_url,display_name',
            ]);
        if (! $userResponse->successful() || data_get($userResponse->json(), 'error.code') !== 'ok') {
            throw new \RuntimeException(data_get($userResponse->json(), 'error.message') ?: 'Could not load the TikTok profile.');
        }

        $profile = $userResponse->json('data.user', []);
        $name = $profile['display_name'] ?? 'TikTok Creator';

        $creatorResponse = Http::withToken($accessToken)
            ->asJson()
            ->post('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', []);
        $creatorInfo = $creatorResponse->successful() && data_get($creatorResponse->json(), 'error.code') === 'ok'
            ? $creatorResponse->json('data', [])
            : [];

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'tiktok',
                'provider_account_id' => $openId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $name,
                'username' => data_get($creatorInfo, 'creator_username'),
                'avatar_url' => $profile['avatar_url'] ?? data_get($creatorInfo, 'creator_avatar_url'),
                'profile_url' => data_get($creatorInfo, 'creator_username')
                    ? 'https://www.tiktok.com/@'.ltrim(data_get($creatorInfo, 'creator_username'), '@')
                    : null,
                'access_token' => $accessToken,
                'refresh_token' => $tokens['refresh_token'] ?? null,
                'token_meta' => [
                    'scopes' => $grantedScopes,
                    'refresh_expires_at' => isset($tokens['refresh_expires_in'])
                        ? now()->addSeconds((int) $tokens['refresh_expires_in'])->toIso8601String()
                        : null,
                    'union_id' => $profile['union_id'] ?? null,
                ],
                'token_expires_at' => isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
                'status' => 'active',
                'status_message' => null,
                'settings' => ['creator_info' => $creatorInfo],
                'last_synced_at' => now(),
            ],
        );
    }

    protected function connectTwitter(Workspace $workspace, User $user, string $code, array $credentials, array $state): SocialAccount
    {
        $codeVerifier = (string) ($state['code_verifier'] ?? '');
        if ($codeVerifier === '') {
            throw new \RuntimeException('X OAuth session is missing its PKCE verifier. Start the connection again from Accounts.');
        }

        $request = Http::asForm()->timeout(20);
        if (! empty($credentials['client_secret'])) {
            $request = $request->withBasicAuth($credentials['client_id'], $credentials['client_secret']);
        }

        $tokenResponse = $request->post('https://api.twitter.com/2/oauth2/token', [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $credentials['redirect'],
            'client_id' => $credentials['client_id'],
            'code_verifier' => $codeVerifier,
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_description')
                ?? $tokenResponse->json('error')
                ?? 'X token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('X did not return an access token.');
        }

        $profileResponse = Http::withToken($accessToken)
            ->timeout(20)
            ->get('https://api.twitter.com/2/users/me', [
                'user.fields' => 'id,name,username,profile_image_url,verified',
            ]);

        if (! $profileResponse->successful()) {
            throw new \RuntimeException($profileResponse->json('detail') ?? 'Could not load the X profile.');
        }

        $profile = $profileResponse->json('data', []);
        $accountId = (string) ($profile['id'] ?? '');
        $username = (string) ($profile['username'] ?? '');
        if ($accountId === '') {
            throw new \RuntimeException('X did not return a user ID.');
        }

        $scope = preg_split('/[\s,]+/', trim((string) ($tokens['scope'] ?? ''))) ?: [];

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'twitter',
                'provider_account_id' => $accountId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $profile['name'] ?? ($username ? '@'.$username : 'X Account'),
                'username' => $username ? '@'.ltrim($username, '@') : null,
                'avatar_url' => $profile['profile_image_url'] ?? null,
                'profile_url' => $username ? "https://x.com/{$username}" : null,
                'access_token' => $accessToken,
                'refresh_token' => $tokens['refresh_token'] ?? null,
                'token_meta' => [
                    'scopes' => array_values(array_filter($scope)),
                    'token_type' => $tokens['token_type'] ?? 'bearer',
                    'verified' => $profile['verified'] ?? null,
                ],
                'token_expires_at' => isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
                'status' => 'active',
                'status_message' => null,
                'settings' => ['verified' => $profile['verified'] ?? null],
                'last_synced_at' => now(),
            ],
        );
    }

    /**
     * @return array<int, SocialAccount>
     */
    protected function connectGoogleBusiness(Workspace $workspace, User $user, string $code, array $credentials): array
    {
        $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'redirect_uri' => $credentials['redirect'],
            'grant_type' => 'authorization_code',
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException($tokenResponse->json('error_description') ?? 'Google token exchange failed.');
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('Google did not return an access token.');
        }

        $accountsResponse = Http::withToken($accessToken)
            ->timeout(20)
            ->get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');

        if (! $accountsResponse->successful()) {
            throw new \RuntimeException('Could not load Google Business Profile accounts. Enable the Business Profile APIs for this Google Cloud project.');
        }

        $googleAccounts = $accountsResponse->json('accounts', []);
        if (empty($googleAccounts)) {
            throw new \RuntimeException('No Google Business Profile accounts were returned for this Google user.');
        }

        $created = [];
        foreach ($googleAccounts as $googleAccount) {
            $accountName = (string) ($googleAccount['name'] ?? '');
            if ($accountName === '') {
                continue;
            }

            $locationsResponse = Http::withToken($accessToken)
                ->timeout(20)
                ->get("https://mybusinessbusinessinformation.googleapis.com/v1/{$accountName}/locations", [
                    'readMask' => 'name,title,storefrontAddress,metadata,profile,websiteUri',
                    'pageSize' => 100,
                ]);

            $locations = $locationsResponse->successful() ? $locationsResponse->json('locations', []) : [];
            if (empty($locations)) {
                $created[] = $this->upsertGoogleBusinessAccount($workspace, $user, $accessToken, $tokens, $googleAccount, null);
                continue;
            }

            foreach ($locations as $location) {
                $created[] = $this->upsertGoogleBusinessAccount($workspace, $user, $accessToken, $tokens, $googleAccount, $location);
            }
        }

        if (empty($created)) {
            throw new \RuntimeException('Google Business Profile did not return a usable account or location.');
        }

        return $created;
    }

    protected function upsertGoogleBusinessAccount(
        Workspace $workspace,
        User $user,
        string $accessToken,
        array $tokens,
        array $googleAccount,
        ?array $location,
    ): SocialAccount {
        $providerId = (string) ($location['name'] ?? $googleAccount['name']);
        $title = $location['title'] ?? $googleAccount['accountName'] ?? 'Google Business Profile';
        $address = data_get($location, 'storefrontAddress.addressLines.0');

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'google_business',
                'provider_account_id' => $providerId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $title,
                'username' => $address,
                'avatar_url' => null,
                'profile_url' => data_get($location, 'metadata.mapsUri') ?? data_get($location, 'websiteUri'),
                'access_token' => $accessToken,
                'refresh_token' => $tokens['refresh_token'] ?? null,
                'token_meta' => [
                    'scope' => $tokens['scope'] ?? null,
                    'google_account' => $googleAccount['name'] ?? null,
                    'location_name' => $location['name'] ?? null,
                ],
                'token_expires_at' => isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
                'status' => 'active',
                'status_message' => null,
                'settings' => [
                    'google_account' => $googleAccount,
                    'location' => $location,
                ],
                'last_synced_at' => now(),
            ],
        );
    }

    /** @return array<int, SocialAccount>|SocialAccount */
    protected function connectLinkedIn(
        string $platform,
        Workspace $workspace,
        User $user,
        string $code,
        array $credentials,
    ): array|SocialAccount {
        $tokenResponse = Http::asForm()->post('https://www.linkedin.com/oauth/v2/accessToken', [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'redirect_uri' => $credentials['redirect'],
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_description')
                ?? $tokenResponse->json('message')
                ?? 'LinkedIn token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('LinkedIn did not return an access token.');
        }

        $profileResponse = Http::withToken($accessToken)
            ->get('https://api.linkedin.com/v2/userinfo');
        if (! $profileResponse->successful()) {
            throw new \RuntimeException($profileResponse->json('message') ?? 'Could not load the LinkedIn profile.');
        }

        $profile = $profileResponse->json();
        $memberId = (string) ($profile['sub'] ?? '');
        if ($memberId === '') {
            throw new \RuntimeException('LinkedIn did not return a member ID.');
        }

        $scopeKey = $platform === 'linkedin_page' ? 'page_scopes' : 'profile_scopes';
        $grantedScopes = preg_split('/[\s,]+/', trim((string) ($tokens['scope'] ?? ''))) ?: [];
        if (empty(array_filter($grantedScopes))) {
            $grantedScopes = $credentials[$scopeKey] ?? [];
        }

        $expiresAt = isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null;
        $tokenMeta = [
            'scopes' => array_values(array_filter($grantedScopes)),
            'token_type' => $tokens['token_type'] ?? 'Bearer',
            'member_id' => $memberId,
            'email' => $profile['email'] ?? null,
            'locale' => $profile['locale'] ?? null,
        ];

        if ($platform === 'linkedin_profile') {
            return SocialAccount::upsertConnection(
                [
                    'workspace_id' => $workspace->id,
                    'platform' => 'linkedin_profile',
                    'provider_account_id' => $memberId,
                ],
                [
                    'connected_by' => $user->id,
                    'name' => $profile['name'] ?? (trim(($profile['given_name'] ?? '').' '.($profile['family_name'] ?? '')) ?: 'LinkedIn Profile'),
                    'username' => null,
                    'avatar_url' => $profile['picture'] ?? null,
                    'profile_url' => null,
                    'access_token' => $accessToken,
                    'refresh_token' => $tokens['refresh_token'] ?? null,
                    'token_meta' => $tokenMeta,
                    'token_expires_at' => $expiresAt,
                    'status' => 'active',
                    'status_message' => null,
                    'settings' => ['email' => $profile['email'] ?? null],
                    'last_synced_at' => now(),
                ],
            );
        }

        $headers = $this->linkedinHeaders($credentials);
        $aclResponse = Http::withToken($accessToken)
            ->withHeaders($headers)
            ->get('https://api.linkedin.com/rest/organizationAcls', [
                'q' => 'roleAssignee',
                'state' => 'APPROVED',
                'count' => 100,
            ]);

        if (! $aclResponse->successful()) {
            throw new \RuntimeException(
                $aclResponse->json('message')
                ?? 'Could not load LinkedIn Pages. Enable the Community Management API and organization permissions, then reconnect.'
            );
        }

        $organizationUrns = collect($aclResponse->json('elements', []))
            ->filter(fn (array $acl) => strtoupper((string) ($acl['state'] ?? 'APPROVED')) === 'APPROVED')
            ->filter(fn (array $acl) => in_array(strtoupper((string) ($acl['role'] ?? '')), [
                'ADMINISTRATOR',
                'DIRECT_SPONSORED_CONTENT_POSTER',
                'CONTENT_ADMINISTRATOR',
            ], true))
            ->map(fn (array $acl) => $acl['organization'] ?? $acl['organizationTarget'] ?? null)
            ->filter(fn ($urn) => is_string($urn) && str_starts_with($urn, 'urn:li:organization:'))
            ->unique()
            ->values();

        if ($organizationUrns->isEmpty()) {
            throw new \RuntimeException('No publishable LinkedIn Pages were returned. You need an approved administrator, content administrator, or sponsored content poster role plus the Community Management API permissions.');
        }

        return $organizationUrns->map(function (string $organizationUrn) use (
            $workspace,
            $user,
            $accessToken,
            $tokens,
            $tokenMeta,
            $expiresAt,
            $headers,
        ) {
            $organizationId = str($organizationUrn)->afterLast(':')->toString();
            $organizationResponse = Http::withToken($accessToken)
                ->withHeaders($headers)
                ->get("https://api.linkedin.com/rest/organizations/{$organizationId}");

            if (! $organizationResponse->successful()) {
                throw new \RuntimeException($organizationResponse->json('message') ?? 'Could not load a LinkedIn Page.');
            }

            $organization = $organizationResponse->json();
            $vanityName = $organization['vanityName'] ?? null;

            return SocialAccount::upsertConnection(
                [
                    'workspace_id' => $workspace->id,
                    'platform' => 'linkedin_page',
                    'provider_account_id' => $organizationId,
                ],
                [
                    'connected_by' => $user->id,
                    'name' => $organization['localizedName'] ?? $organization['name'] ?? 'LinkedIn Page',
                    'username' => $vanityName ? '@'.ltrim($vanityName, '@') : null,
                    'avatar_url' => data_get($organization, 'logoV2.original') ?? data_get($organization, 'logo.original'),
                    'profile_url' => $vanityName ? 'https://www.linkedin.com/company/'.ltrim($vanityName, '@').'/' : null,
                    'access_token' => $accessToken,
                    'refresh_token' => $tokens['refresh_token'] ?? null,
                    'token_meta' => array_merge($tokenMeta, ['organization_urn' => $organizationUrn]),
                    'token_expires_at' => $expiresAt,
                    'status' => 'active',
                    'status_message' => null,
                    'settings' => [
                        'organization_urn' => $organizationUrn,
                        'member_id' => $tokenMeta['member_id'],
                    ],
                    'last_synced_at' => now(),
                ],
            );
        })->all();
    }

    /** @return array<string, string> */
    protected function linkedinHeaders(array $credentials): array
    {
        return [
            'X-Restli-Protocol-Version' => '2.0.0',
            'LinkedIn-Version' => (string) ($credentials['version'] ?? '202606'),
        ];
    }

    /** @return array<int, SocialAccount> */
    protected function connectPinterest(
        Workspace $workspace,
        User $user,
        string $code,
        array $credentials,
    ): array {
        $apiBase = rtrim((string) ($credentials['api_base'] ?? 'https://api.pinterest.com/v5'), '/');
        $tokenResponse = Http::withBasicAuth($credentials['client_id'], $credentials['client_secret'])
            ->asForm()
            ->timeout(20)
            ->post("{$apiBase}/oauth/token", [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $credentials['redirect'],
            ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('message')
                ?? $tokenResponse->json('error_description')
                ?? 'Pinterest token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('Pinterest did not return an access token.');
        }

        $scopes = preg_split('/[\s,]+/', trim((string) ($tokens['scope'] ?? ''))) ?: [];
        $expiresAt = isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null;

        return app(PinterestService::class)->connectBoards(
            workspace: $workspace,
            user: $user,
            accessToken: $accessToken,
            refreshToken: $tokens['refresh_token'] ?? null,
            expiresAt: $expiresAt,
            tokenMeta: array_filter([
                'scopes' => array_values(array_filter($scopes)),
                'token_type' => $tokens['token_type'] ?? 'bearer',
                'refresh_token_expires_at' => isset($tokens['refresh_token_expires_at'])
                    ? now()->setTimestamp((int) $tokens['refresh_token_expires_at'])->toIso8601String()
                    : null,
                'refresh_token_expires_in' => $tokens['refresh_token_expires_in'] ?? null,
            ], fn ($value) => $value !== null),
        );
    }

    protected function connectThreads(Workspace $workspace, User $user, string $code, array $credentials): SocialAccount
    {
        $tokenResponse = Http::asForm()->post('https://graph.threads.net/oauth/access_token', [
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'grant_type' => 'authorization_code',
            'redirect_uri' => $credentials['redirect'],
            'code' => $code,
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_message')
                ?? $tokenResponse->json('error.message')
                ?? 'Threads token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('Threads did not return an access token.');
        }

        $longLivedResponse = Http::get('https://graph.threads.net/access_token', [
            'grant_type' => 'th_exchange_token',
            'client_secret' => $credentials['client_secret'],
            'access_token' => $accessToken,
        ]);
        if ($longLivedResponse->successful() && $longLivedResponse->json('access_token')) {
            $tokens = array_merge($tokens, $longLivedResponse->json());
            $accessToken = $tokens['access_token'];
        }

        $profileResponse = Http::withToken($accessToken)
            ->get('https://graph.threads.net/v1.0/me', [
                'fields' => 'id,username,name,threads_profile_picture_url',
            ]);

        if (! $profileResponse->successful()) {
            throw new \RuntimeException($profileResponse->json('error.message') ?? 'Could not load the Threads profile.');
        }

        $profile = $profileResponse->json();
        $accountId = (string) ($profile['id'] ?? '');
        $username = (string) ($profile['username'] ?? '');
        if ($accountId === '') {
            throw new \RuntimeException('Threads did not return a profile ID.');
        }

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'threads',
                'provider_account_id' => $accountId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $profile['name'] ?? ($username ? '@'.$username : 'Threads Profile'),
                'username' => $username ? '@'.ltrim($username, '@') : null,
                'avatar_url' => $profile['threads_profile_picture_url'] ?? null,
                'profile_url' => $username ? "https://www.threads.net/@{$username}" : null,
                'access_token' => $accessToken,
                'refresh_token' => null,
                'token_meta' => [
                    'scopes' => $credentials['scopes'] ?? [],
                    'token_type' => $tokens['token_type'] ?? 'bearer',
                ],
                'token_expires_at' => isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
                'status' => 'active',
                'status_message' => null,
                'settings' => [],
                'last_synced_at' => now(),
            ],
        );
    }

    protected function connectMastodon(Workspace $workspace, User $user, string $code, array $credentials): SocialAccount
    {
        $instance = rtrim((string) ($credentials['instance'] ?? ''), '/');
        if ($instance === '') {
            throw new \RuntimeException('Mastodon instance URL is missing.');
        }

        $tokenResponse = Http::asForm()->post("{$instance}/oauth/token", [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'client_id' => $credentials['client_id'],
            'client_secret' => $credentials['client_secret'],
            'redirect_uri' => $credentials['redirect'],
        ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_description')
                ?? $tokenResponse->json('error')
                ?? 'Mastodon token exchange failed.'
            );
        }

        $token = $tokenResponse->json('access_token');
        if (! $token) {
            throw new \RuntimeException('Mastodon did not return an access token.');
        }

        $profileResponse = Http::withToken($token)
            ->get("{$instance}/api/v1/accounts/verify_credentials");

        if (! $profileResponse->successful()) {
            throw new \RuntimeException($profileResponse->json('error') ?? 'Could not load the Mastodon account.');
        }

        $profile = $profileResponse->json();
        $accountId = (string) ($profile['id'] ?? '');
        if ($accountId === '') {
            throw new \RuntimeException('Mastodon did not return an account ID.');
        }

        $acct = (string) ($profile['acct'] ?? $profile['username'] ?? '');
        $displayName = trim((string) ($profile['display_name'] ?? ''));
        $scopes = preg_split('/\s+/', trim((string) $tokenResponse->json('scope', ''))) ?: [];

        return SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'mastodon',
                'provider_account_id' => $accountId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $displayName ?: ($acct ? '@'.$acct : 'Mastodon Account'),
                'username' => $acct ? '@'.ltrim($acct, '@') : null,
                'avatar_url' => $profile['avatar_static'] ?? $profile['avatar'] ?? null,
                'profile_url' => $profile['url'] ?? null,
                'access_token' => $token,
                'refresh_token' => null,
                'token_meta' => [
                    'scopes' => array_values(array_filter($scopes)),
                    'token_type' => $tokenResponse->json('token_type', 'Bearer'),
                    'instance_url' => $instance,
                ],
                'token_expires_at' => null,
                'status' => 'active',
                'status_message' => null,
                'settings' => [
                    'instance_url' => $instance,
                    'default_visibility' => data_get($profile, 'source.privacy', 'public'),
                    'default_language' => data_get($profile, 'source.language'),
                ],
                'last_synced_at' => now(),
            ],
        );
    }

    protected function connectReddit(Workspace $workspace, User $user, string $code, array $credentials): SocialAccount
    {
        $userAgent = (string) ($credentials['user_agent'] ?? '');
        $tokenResponse = Http::withBasicAuth($credentials['client_id'], $credentials['client_secret'])
            ->withHeaders(['User-Agent' => $userAgent])
            ->asForm()
            ->timeout(20)
            ->post('https://www.reddit.com/api/v1/access_token', [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $credentials['redirect'],
            ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_description')
                ?? $tokenResponse->json('message')
                ?? $tokenResponse->json('error')
                ?? 'Reddit token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        $refreshToken = $tokens['refresh_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('Reddit did not return an access token.');
        }
        if (! $refreshToken) {
            throw new \RuntimeException('Reddit did not return a refresh token. Reconnect and approve permanent access.');
        }

        $apiBase = rtrim((string) ($credentials['api_base'] ?? 'https://oauth.reddit.com'), '/');
        $profileResponse = Http::withToken($accessToken)
            ->withHeaders(['User-Agent' => $userAgent])
            ->timeout(20)
            ->get("{$apiBase}/api/v1/me", ['raw_json' => 1]);

        if (! $profileResponse->successful()) {
            throw new \RuntimeException($profileResponse->json('message') ?? 'Could not load the Reddit profile.');
        }

        $profile = $profileResponse->json();
        $accountId = (string) ($profile['id'] ?? '');
        $username = (string) ($profile['name'] ?? '');
        if ($accountId === '' || $username === '') {
            throw new \RuntimeException('Reddit returned an incomplete account profile.');
        }

        $scope = preg_split('/[\s,]+/', trim((string) ($tokens['scope'] ?? ''))) ?: [];
        $account = SocialAccount::upsertConnection(
            [
                'workspace_id' => $workspace->id,
                'platform' => 'reddit',
                'provider_account_id' => $accountId,
            ],
            [
                'connected_by' => $user->id,
                'name' => $username,
                'username' => 'u/'.$username,
                'avatar_url' => ($profile['snoovatar_img'] ?? null) ?: ($profile['icon_img'] ?? null),
                'profile_url' => "https://www.reddit.com/user/{$username}/",
                'access_token' => $accessToken,
                'refresh_token' => $refreshToken,
                'token_meta' => [
                    'scope' => array_values(array_filter($scope)),
                    'token_type' => $tokens['token_type'] ?? 'bearer',
                    'reddit_fullname' => 't2_'.$accountId,
                ],
                'token_expires_at' => now()->addSeconds((int) ($tokens['expires_in'] ?? 3600)),
                'status' => 'active',
                'status_message' => null,
                'settings' => [
                    'link_karma' => (int) ($profile['link_karma'] ?? 0),
                    'comment_karma' => (int) ($profile['comment_karma'] ?? 0),
                    'has_verified_email' => (bool) ($profile['has_verified_email'] ?? false),
                ],
                'last_synced_at' => now(),
            ],
        );

        try {
            app(RedditService::class)->syncCommunities($account);
        } catch (\Throwable $e) {
            Log::warning('Reddit connected but community sync failed', [
                'account_id' => $account->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $account->fresh();
    }

    /**
     * @return array<int, SocialAccount>
     */
    protected function connectSnapchat(Workspace $workspace, User $user, string $code, array $credentials): array
    {
        $tokenResponse = Http::withBasicAuth($credentials['client_id'], $credentials['client_secret'])
            ->asForm()
            ->timeout(20)
            ->post('https://accounts.snapchat.com/login/oauth2/access_token', [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => $credentials['redirect'],
            ]);

        if (! $tokenResponse->successful()) {
            throw new \RuntimeException(
                $tokenResponse->json('error_description')
                ?? $tokenResponse->json('error')
                ?? 'Snapchat token exchange failed.'
            );
        }

        $tokens = $tokenResponse->json();
        $accessToken = $tokens['access_token'] ?? null;
        if (! $accessToken) {
            throw new \RuntimeException('Snapchat did not return an access token.');
        }

        $organizationsResponse = Http::withToken($accessToken)
            ->timeout(20)
            ->get('https://adsapi.snapchat.com/v1/me/organizations');

        $organizations = $organizationsResponse->successful()
            ? data_get($organizationsResponse->json(), 'organizations', [])
            : [];

        if (empty($organizations)) {
            $organizations = [[
                'id' => sha1($accessToken),
                'name' => 'Snapchat Account',
                'organization_id' => sha1($accessToken),
            ]];
        }

        return collect($organizations)->map(function (array $organization) use ($workspace, $user, $tokens, $accessToken) {
            $organizationId = (string) ($organization['organization_id'] ?? $organization['id'] ?? '');
            $name = $organization['name'] ?? 'Snapchat Account';

            return SocialAccount::upsertConnection(
                [
                    'workspace_id' => $workspace->id,
                    'platform' => 'snapchat',
                    'provider_account_id' => $organizationId,
                ],
                [
                    'connected_by' => $user->id,
                    'name' => $name,
                    'username' => null,
                    'avatar_url' => null,
                    'profile_url' => null,
                    'access_token' => $accessToken,
                    'refresh_token' => $tokens['refresh_token'] ?? null,
                    'token_meta' => [
                        'scope' => $tokens['scope'] ?? null,
                        'token_type' => $tokens['token_type'] ?? 'Bearer',
                        'organization' => $organization,
                    ],
                    'token_expires_at' => isset($tokens['expires_in']) ? now()->addSeconds((int) $tokens['expires_in']) : null,
                    'status' => 'active',
                    'status_message' => null,
                    'settings' => ['organization' => $organization],
                    'last_synced_at' => now(),
                ],
            );
        })->values()->all();
    }

    protected function oauthGroup(string $platform): string
    {
        $group = config("social.platforms.{$platform}.group", $platform);

        return match ($group) {
            'youtube' => 'google',
            default => $group,
        };
    }

    protected function oauthError(Request $request): ?string
    {
        $error = collect([
            $request->input('error_description'),
            $request->input('error_message'),
            $request->input('error_reason'),
            $request->input('error'),
        ])->first(fn ($value) => is_string($value) && trim($value) !== '');

        if (! $error && $request->filled('error_code')) {
            $error = 'Meta OAuth error '.$request->input('error_code');
        }

        return $error ? trim((string) $error) : null;
    }
}
