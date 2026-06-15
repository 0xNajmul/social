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
use Illuminate\Support\Facades\Storage;
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
            'workspaces' => fn ($q) => $q->withCount(['members', 'socialAccounts'])->with('subscription.plan'),
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
        ])->save();

        return response()->json([
            'message' => 'Profile updated.',
            'user' => new UserResource($user->fresh()),
        ]);
    }
}
