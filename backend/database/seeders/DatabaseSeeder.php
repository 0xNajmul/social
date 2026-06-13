<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            SocialPlatformSeeder::class,
            PlanSeeder::class,
            DemoSeeder::class,
        ]);
    }
}
