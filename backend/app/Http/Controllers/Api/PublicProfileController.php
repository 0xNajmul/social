<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PublicProfileController extends Controller
{
    public function show(string $handle): JsonResponse
    {
        $normalizedHandle = Str::lower($handle);
        $user = User::query()
            ->where('settings->public_profile->handle', $normalizedHandle)
            ->firstOrFail();

        $profile = $this->profileFor($user);
        abort_unless($profile['enabled'] ?? false, 404);

        return response()->json(['data' => $profile]);
    }

    public function current(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->profileFor($request->user())]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'enabled' => ['boolean'],
            'handle' => ['required', 'string', 'min:3', 'max:40', 'regex:/^[a-zA-Z0-9_][a-zA-Z0-9_-]*$/'],
            'display_name' => ['required', 'string', 'max:120'],
            'headline' => ['nullable', 'string', 'max:160'],
            'bio' => ['nullable', 'string', 'max:1200'],
            'location' => ['nullable', 'string', 'max:120'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            'cover_url' => ['nullable', 'string', 'max:2048'],
            'template' => ['nullable', Rule::in(['spotlight', 'links', 'portfolio', 'press'])],
            'theme' => ['nullable', Rule::in(['studio', 'minimal', 'bold', 'creator'])],
            'accent_color' => ['nullable', 'string', 'max:20'],
            'button_style' => ['nullable', Rule::in(['solid', 'outline', 'soft'])],
            'links' => ['nullable', 'array', 'max:20'],
            'links.*.label' => ['required_with:links', 'string', 'max:80'],
            'links.*.url' => ['required_with:links', 'url', 'max:2048'],
            'links.*.icon' => ['nullable', 'string', 'max:40'],
            'featured_links' => ['nullable', 'array', 'max:1'],
            'featured_links.*.label' => ['required_with:featured_links', 'string', 'max:80'],
            'featured_links.*.url' => ['required_with:featured_links', 'url', 'max:2048'],
            'featured_links.*.icon' => ['nullable', 'string', 'max:40'],
        ]);

        $handle = Str::lower($data['handle']);
        $taken = User::query()
            ->where('id', '!=', $user->id)
            ->where('settings->public_profile->handle', $handle)
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages(['handle' => ['This public profile name is already taken.']]);
        }

        $settings = $user->settings ?? [];
        $settings['public_profile'] = [
            ...$this->profileDefaults($user),
            ...Arr::except($data, ['handle']),
            'handle' => $handle,
            'links' => array_values($data['links'] ?? []),
            'featured_links' => array_values($data['featured_links'] ?? []),
        ];

        $user->forceFill(['settings' => $settings])->save();

        return response()->json([
            'message' => 'Public profile saved.',
            'data' => $this->profileFor($user->fresh()),
        ]);
    }

    protected function profileFor(User $user): array
    {
        $settings = $user->settings ?? [];
        $profile = [
            ...$this->profileDefaults($user),
            ...(is_array($settings['public_profile'] ?? null) ? $settings['public_profile'] : []),
        ];

        $profile['public_url'] = url('/'.$profile['handle']);

        return $profile;
    }

    protected function profileDefaults(User $user): array
    {
        return [
            'enabled' => false,
            'handle' => Str::slug($user->name ?: Str::before($user->email, '@')) ?: 'profile-'.$user->id,
            'display_name' => $user->name,
            'headline' => 'Creator and publisher',
            'bio' => '',
            'location' => '',
            'avatar_url' => $user->avatar_path ? asset('storage/'.$user->avatar_path) : '',
            'cover_url' => '',
            'template' => 'spotlight',
            'theme' => 'studio',
            'accent_color' => '#4f46e5',
            'button_style' => 'solid',
            'links' => [],
            'featured_links' => [],
        ];
    }
}
