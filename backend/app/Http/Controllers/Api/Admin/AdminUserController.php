<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->withCount('workspaces')
            ->when($request->search, fn ($q, $s) => $q->where(fn ($w) => $w->where('name', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%")))
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return UserResource::collection($users)->response();
    }

    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($user->load('workspaces.subscription.plan')),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'timezone' => ['nullable', 'timezone:all'],
            'locale' => ['nullable', 'string', 'max:8'],
            'is_admin' => ['boolean'],
        ]);

        $data['timezone'] = $data['timezone'] ?? 'UTC';
        $data['locale'] = $data['locale'] ?? 'en';
        $data['password'] = Hash::make($data['password']);
        $user = User::create($data);

        return response()->json(['data' => new UserResource($user)], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'is_admin' => ['sometimes', 'boolean'],
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'timezone' => ['sometimes', 'timezone:all'],
            'locale' => ['sometimes', 'string', 'max:8'],
        ]);

        abort_if(
            $request->user()->is($user) && array_key_exists('is_admin', $data) && ! $data['is_admin'],
            422,
            'You cannot revoke your own administrator access.',
        );

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        $user->update($data);

        return response()->json(['data' => new UserResource($user)]);
    }

    public function impersonationToken(User $user): JsonResponse
    {
        // Issue a short-lived token to log in as the user (support tooling).
        $token = $user->createToken('admin-impersonation', ['*'], now()->addMinutes(30))->plainTextToken;

        return response()->json(['token' => $token]);
    }

    public function destroy(User $user): JsonResponse
    {
        abort_if(request()->user()->is($user), 422, 'You cannot delete your own account.');
        abort_if($user->is_admin, 422, 'Cannot delete an administrator.');
        abort_if($user->ownedWorkspaces()->exists(), 422, 'Transfer or delete this user\'s workspaces first.');
        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}
