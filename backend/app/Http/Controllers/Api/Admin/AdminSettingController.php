<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->values()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'platform_name' => ['required', 'string', 'max:80'],
            'support_email' => ['nullable', 'email', 'max:255'],
            'registration_enabled' => ['required', 'boolean'],
            'default_trial_days' => ['required', 'integer', 'min:0', 'max:365'],
            'maintenance_notice' => ['nullable', 'string', 'max:500'],
        ]);

        PlatformSetting::storeValues($data);

        return response()->json([
            'message' => 'Platform settings updated.',
            'data' => $this->values(),
        ]);
    }

    /** @return array<string, mixed> */
    protected function values(): array
    {
        return [
            'platform_name' => PlatformSetting::valueFor('platform_name', config('app.name', 'Postflow')),
            'support_email' => PlatformSetting::valueFor('support_email', ''),
            'registration_enabled' => PlatformSetting::valueFor('registration_enabled', true),
            'default_trial_days' => (int) PlatformSetting::valueFor('default_trial_days', 14),
            'maintenance_notice' => PlatformSetting::valueFor('maintenance_notice', ''),
        ];
    }
}
