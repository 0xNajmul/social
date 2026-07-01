<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Language;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class PublicSettingController extends Controller
{
    public function index(): JsonResponse
    {
        $general = PlatformSetting::valueFor('general', []);
        $seo = PlatformSetting::valueFor('seo', []);
        $mainMenu = PlatformSetting::valueFor('main_menu', []);
        $footer = PlatformSetting::valueFor('footer', []);
        $pagination = PlatformSetting::valueFor('pagination', []);
        $language = PlatformSetting::valueFor('language', []);

        if (Schema::hasTable('languages')) {
            $languages = Language::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get();

            if ($languages->isNotEmpty()) {
                $default = $languages->firstWhere('is_default', true) ?: $languages->first();
                $language = [
                    'default_language' => $default?->code ?? 'en',
                    'available_languages' => $languages->pluck('code')->implode(', '),
                    'auto_detect' => is_array($language) ? (bool) ($language['auto_detect'] ?? true) : true,
                    'rtl_languages' => $languages->where('is_rtl', true)->pluck('code')->implode(', '),
                    'languages' => $languages->map(fn (Language $item): array => [
                        'code' => $item->code,
                        'name' => $item->name,
                        'native_name' => $item->native_name ?: $item->name,
                        'is_rtl' => $item->is_rtl,
                    ])->values()->all(),
                ];
            } else {
                $language = [
                    'default_language' => 'en',
                    'available_languages' => 'en',
                    'auto_detect' => is_array($language) ? (bool) ($language['auto_detect'] ?? true) : true,
                    'rtl_languages' => '',
                    'languages' => [
                        ['code' => 'en', 'name' => 'English', 'native_name' => 'English', 'is_rtl' => false],
                    ],
                ];
            }
        }

        return response()->json([
            'data' => [
                'general' => is_array($general) ? $general : [],
                'seo' => is_array($seo) ? $seo : [],
                'main_menu' => is_array($mainMenu) ? $mainMenu : [],
                'footer' => is_array($footer) ? $footer : [],
                'pagination' => is_array($pagination) ? $pagination : [],
                'language' => is_array($language) ? $language : [],
                'platform_name' => PlatformSetting::valueFor('platform_name', config('app.name', 'Postflow')),
            ],
        ]);
    }
}
