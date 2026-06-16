<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;

class PublicSettingController extends Controller
{
    public function index(): JsonResponse
    {
        $general = PlatformSetting::valueFor('general', []);
        $seo = PlatformSetting::valueFor('seo', []);
        $mainMenu = PlatformSetting::valueFor('main_menu', []);

        return response()->json([
            'data' => [
                'general' => is_array($general) ? $general : [],
                'seo' => is_array($seo) ? $seo : [],
                'main_menu' => is_array($mainMenu) ? $mainMenu : [],
                'platform_name' => PlatformSetting::valueFor('platform_name', config('app.name', 'Postflow')),
            ],
        ]);
    }
}
