<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'data' => new UserResource($user->load('workspaces')),
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'is_admin' => ['sometimes', 'boolean'],
            'name' => ['sometimes', 'string', 'max:255'],
        ]);

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
        abort_if($user->is_admin, 422, 'Cannot delete an administrator.');
        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}
