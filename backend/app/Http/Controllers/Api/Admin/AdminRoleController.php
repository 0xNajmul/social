<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminRoleController extends Controller
{
    public function index(): JsonResponse
    {
        $this->ensureDefaultRoles();

        $roles = AdminRole::query()
            ->withCount('users')
            ->orderByDesc('is_system')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $roles]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['name']);
        $data['is_system'] = false;

        $role = AdminRole::create($data);

        return response()->json(['data' => $role->loadCount('users')], 201);
    }

    public function update(Request $request, AdminRole $role): JsonResponse
    {
        $data = $this->validated($request, $role);

        if (! $role->is_system) {
            $data['slug'] = $this->uniqueSlug($data['name'], $role);
        } else {
            unset($data['name']);
        }

        $role->update($data);

        return response()->json(['data' => $role->fresh()->loadCount('users')]);
    }

    public function destroy(AdminRole $role): JsonResponse
    {
        abort_if($role->is_system, 422, 'System roles cannot be deleted.');
        abort_if($role->users()->exists(), 422, 'Move administrators to another role before deleting this role.');

        $role->delete();

        return response()->json(['message' => 'Role deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validated(Request $request, ?AdminRole $role = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('admin_roles', 'name')->ignore($role?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['boolean'],
        ]);
    }

    protected function uniqueSlug(string $name, ?AdminRole $ignore = null): string
    {
        $base = Str::slug($name) ?: 'role';
        $slug = $base;
        $index = 2;

        while (AdminRole::query()->where('slug', $slug)->when($ignore, fn ($query) => $query->whereKeyNot($ignore->id))->exists()) {
            $slug = "{$base}-{$index}";
            $index++;
        }

        return $slug;
    }

    protected function ensureDefaultRoles(): void
    {
        $defaults = [
            [
                'name' => 'Super admin',
                'slug' => 'super-admin',
                'description' => 'Full control over all admin pages, billing, users, settings, and platform operations.',
                'permissions' => [
                    'dashboard.view' => true,
                    'users.manage' => true,
                    'roles.manage' => true,
                    'posts.manage' => true,
                    'plans.manage' => true,
                    'workspaces.manage' => true,
                    'jobs.manage' => true,
                    'settings.manage' => true,
                ],
            ],
            [
                'name' => 'Support manager',
                'slug' => 'support-manager',
                'description' => 'Can help customers, inspect workspaces, and retry operational jobs.',
                'permissions' => [
                    'dashboard.view' => true,
                    'users.manage' => true,
                    'roles.manage' => false,
                    'posts.manage' => true,
                    'plans.manage' => false,
                    'workspaces.manage' => true,
                    'jobs.manage' => true,
                    'settings.manage' => false,
                ],
            ],
            [
                'name' => 'Content moderator',
                'slug' => 'content-moderator',
                'description' => 'Can review posts and plans without managing billing or platform settings.',
                'permissions' => [
                    'dashboard.view' => true,
                    'users.manage' => false,
                    'roles.manage' => false,
                    'posts.manage' => true,
                    'plans.manage' => true,
                    'workspaces.manage' => false,
                    'jobs.manage' => false,
                    'settings.manage' => false,
                ],
            ],
        ];

        foreach ($defaults as $role) {
            AdminRole::firstOrCreate(
                ['slug' => $role['slug']],
                [
                    'name' => $role['name'],
                    'description' => $role['description'],
                    'permissions' => $role['permissions'],
                    'is_system' => true,
                ],
            );
        }
    }
}
