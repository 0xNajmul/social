<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialAccountResource;
use App\Jobs\RefreshSocialTokenJob;
use App\Models\SocialAccount;
use App\Services\ActivityLogger;
use App\Services\Billing\UsageGuard;
use App\Services\Social\SocialManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $group = config("social.platforms.{$platform}.group");
        $credentials = config("services.{$group}");

        if (! empty($credentials['client_id']) && ! empty($credentials['redirect'])) {
            // Real OAuth: hand the SPA an authorize URL with signed state.
            $state = encrypt(['workspace_id' => $workspace->id, 'platform' => $platform, 'nonce' => Str::random(16)]);

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

    protected function authorizeUrl(string $platform, array $credentials, string $state): string
    {
        // Minimal generic OAuth2 authorize URL builder. Real implementations
        // map each platform to its specific authorize endpoint + scopes.
        $endpoints = [
            'facebook' => 'https://www.facebook.com/v21.0/dialog/oauth',
            'linkedin' => 'https://www.linkedin.com/oauth/v2/authorization',
            'twitter' => 'https://twitter.com/i/oauth2/authorize',
            'google' => 'https://accounts.google.com/o/oauth2/v2/auth',
            'pinterest' => 'https://www.pinterest.com/oauth/',
            'reddit' => 'https://www.reddit.com/api/v1/authorize',
        ];

        $base = $endpoints[config("social.platforms.{$platform}.group")] ?? 'https://example.com/oauth';

        return $base.'?'.http_build_query([
            'client_id' => $credentials['client_id'],
            'redirect_uri' => $credentials['redirect'],
            'response_type' => 'code',
            'state' => $state,
        ]);
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
}
