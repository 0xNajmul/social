<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\PlatformSetting;
use App\Services\ActivityLogger;
use App\Services\WorkspaceProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        protected WorkspaceProvisioner $provisioner,
        protected ActivityLogger $activity,
    ) {}

    /**
     * Register a new user, provision their first workspace + trial, and issue
     * an API token.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        abort_unless(PlatformSetting::valueFor('registration_enabled', true), 403, 'New account registration is currently disabled.');

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'timezone' => $request->timezone ?? 'UTC',
        ]);

        $workspace = $this->provisioner->create(
            $user,
            $request->workspace_name ?: "{$user->name}'s Workspace",
        );

        $this->activity->log($workspace->id, 'user.registered', $user, 'Account created', userId: $user->id);

        $token = $user->createToken($request->input('device_name', 'web'))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ], 201);
    }

    /**
     * Authenticate and issue an API token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        $token = $user->createToken($request->input('device_name', 'web'))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        return response()->json([
            'message' => 'If an account exists for that email, password reset instructions will be sent shortly.',
        ]);
    }

    public function googleRedirect(Request $request): JsonResponse
    {
        $clientId = config('services.google_login.client_id');
        $redirect = config('services.google_login.redirect');

        abort_unless($clientId && $redirect, 422, 'Google login credentials are not configured.');

        $state = rtrim(strtr(base64_encode(json_encode([
            'admin' => $request->boolean('admin'),
            'nonce' => Str::random(32),
        ])), '+/', '-_'), '=');

        $url = 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirect,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        return response()->json(['url' => $url]);
    }

    public function googleCallback(Request $request)
    {
        $state = json_decode(base64_decode(strtr((string) $request->query('state'), '-_', '+/')), true) ?: [];
        $adminFlow = (bool) ($state['admin'] ?? false);
        $frontendRedirect = $adminFlow ? config('services.google_login.admin_redirect') : config('services.google_login.frontend_redirect');

        if ($request->query('error')) {
            return redirect($frontendRedirect.'?google_error='.urlencode((string) $request->query('error')));
        }

        if (! $request->query('code')) {
            return redirect($frontendRedirect.'?google_error=missing_code');
        }

        $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id' => config('services.google_login.client_id'),
            'client_secret' => config('services.google_login.client_secret'),
            'redirect_uri' => config('services.google_login.redirect'),
            'grant_type' => 'authorization_code',
            'code' => $request->query('code'),
        ]);

        if (! $tokenResponse->successful()) {
            return redirect($frontendRedirect.'?google_error=token_exchange_failed');
        }

        $profileResponse = Http::withToken($tokenResponse->json('access_token'))->get('https://www.googleapis.com/oauth2/v3/userinfo');

        if (! $profileResponse->successful() || ! $profileResponse->json('email')) {
            return redirect($frontendRedirect.'?google_error=profile_failed');
        }

        $email = strtolower((string) $profileResponse->json('email'));
        $user = User::where('email', $email)->first();

        if (! $user) {
            if (! PlatformSetting::valueFor('registration_enabled', true)) {
                return redirect($frontendRedirect.'?google_error=registration_disabled');
            }

            $user = User::create([
                'name' => $profileResponse->json('name') ?: Str::before($email, '@'),
                'email' => $email,
                'password' => Hash::make(Str::random(40)),
                'timezone' => 'UTC',
            ]);
            $workspace = $this->provisioner->create($user, "{$user->name}'s Workspace");
            $this->activity->log($workspace->id, 'user.registered_google', $user, 'Account created with Google', userId: $user->id);
        }

        if ($adminFlow && ! $user->is_admin) {
            return redirect($frontendRedirect.'?google_error=not_admin');
        }

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        $token = $user->createToken($adminFlow ? 'admin-google-login' : 'google-login')->plainTextToken;

        return redirect($frontendRedirect.'?google_token='.urlencode($token));
    }

    /**
     * Revoke the current access token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /**
     * Return the authenticated user with their workspaces.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load([
            'adminRole',
            'workspaces' => fn ($q) => $q->withCount(['members', 'pendingInvitations', 'socialAccounts'])->with('subscription.plan'),
        ]);

        return response()->json([
            'user' => new UserResource($user),
            'workspaces' => \App\Http\Resources\WorkspaceResource::collection($user->workspaces),
        ]);
    }

    /**
     * Update the authenticated user's personal profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'timezone' => ['required', 'timezone:all'],
            'locale' => ['required', 'string', 'max:8'],
            'settings' => ['nullable', 'array'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        if ($request->hasFile('avatar')) {
            $newAvatarPath = $request->file('avatar')->store('avatars', 'public');

            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }

            $user->avatar_path = $newAvatarPath;
        }

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
            'timezone' => $data['timezone'],
            'locale' => $data['locale'],
            'settings' => $request->has('settings')
                ? array_replace_recursive($user->settings ?? [], $data['settings'] ?? [])
                : ($user->settings ?? []),
        ])->save();

        return response()->json([
            'message' => 'Profile updated.',
            'user' => new UserResource($user->fresh()),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($data['password']),
        ])->save();

        return response()->json(['message' => 'Password updated.']);
    }
}
