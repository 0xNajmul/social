<?php

namespace Database\Seeders;

use App\Models\SocialPlatform;
use Illuminate\Database\Seeder;

/**
 * Mirrors config/social.php into the social_platforms table so the platform
 * registry can be toggled/extended from the admin panel.
 */
class SocialPlatformSeeder extends Seeder
{
    public function run(): void
    {
        $sort = 0;

        foreach (config('social.platforms') as $key => $cfg) {
            SocialPlatform::updateOrCreate(['key' => $key], [
                'label' => $cfg['label'],
                'group' => $cfg['group'],
                'icon' => $cfg['icon'],
                'color' => $cfg['color'],
                'capabilities' => $cfg['capabilities'],
                'limits' => $cfg['limits'] ?? [],
                'is_enabled' => true,
                'sort_order' => $sort++,
            ]);
        }
    }
}
