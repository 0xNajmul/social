<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Free',
                'slug' => 'free',
                'description' => 'Get started and explore the platform.',
                'price_monthly' => 0, 'price_yearly' => 0, 'trial_days' => 0,
                'max_workspaces' => 1, 'max_team_members' => 1, 'max_social_accounts' => 3,
                'max_scheduled_posts' => 10, 'max_monthly_posts' => 30, 'max_automations' => 1,
                'max_ai_credits' => 20, 'max_storage_mb' => 512, 'sort_order' => 1,
                'features' => ['3 social accounts', '10 scheduled posts', 'Basic analytics', '1 automation'],
            ],
            [
                'name' => 'Starter',
                'slug' => 'starter',
                'description' => 'For solo creators getting serious.',
                'price_monthly' => 1900, 'price_yearly' => 19000, 'trial_days' => 14,
                'max_workspaces' => 1, 'max_team_members' => 3, 'max_social_accounts' => 10,
                'max_scheduled_posts' => 100, 'max_monthly_posts' => 300, 'max_automations' => 5,
                'max_ai_credits' => 200, 'max_storage_mb' => 5120, 'sort_order' => 2,
                'features' => ['10 social accounts', '100 scheduled posts', 'AI assistant', '5 automations', 'Calendar & analytics'],
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'description' => 'For growing teams and agencies.',
                'price_monthly' => 4900, 'price_yearly' => 49000, 'trial_days' => 14,
                'max_workspaces' => 3, 'max_team_members' => 10, 'max_social_accounts' => 30,
                'max_scheduled_posts' => 1000, 'max_monthly_posts' => 3000, 'max_automations' => 25,
                'max_ai_credits' => 1000, 'max_storage_mb' => 51200, 'sort_order' => 3,
                'is_featured' => true,
                'features' => ['30 social accounts', 'Unlimited-feel scheduling', 'Approval workflows', 'Team collaboration', 'Advanced analytics & exports', 'API & webhooks'],
            ],
            [
                'name' => 'Business',
                'slug' => 'business',
                'description' => 'Unlimited scale for large organisations.',
                'price_monthly' => 9900, 'price_yearly' => 99000, 'trial_days' => 14,
                'max_workspaces' => -1, 'max_team_members' => -1, 'max_social_accounts' => -1,
                'max_scheduled_posts' => -1, 'max_monthly_posts' => -1, 'max_automations' => -1,
                'max_ai_credits' => 5000, 'max_storage_mb' => 512000, 'sort_order' => 4,
                'features' => ['Unlimited everything', 'Priority support', 'SSO & audit logs', 'Dedicated success manager'],
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
