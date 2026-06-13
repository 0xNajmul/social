<?php

namespace Database\Seeders;

use App\Enums\PostStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\AnalyticsSnapshot;
use App\Models\Automation;
use App\Models\Plan;
use App\Models\Post;
use App\Models\PostVariant;
use App\Models\PublishedPost;
use App\Models\SocialAccount;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        // Platform administrator.
        User::updateOrCreate(['email' => 'admin@social-automation.test'], [
            'name' => 'Platform Admin',
            'password' => Hash::make('password'),
            'is_admin' => true,
            'email_verified_at' => now(),
        ]);

        // Demo workspace owner.
        $owner = User::updateOrCreate(['email' => 'demo@social-automation.test'], [
            'name' => 'Demo Marketer',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'timezone' => 'America/New_York',
        ]);

        $editor = User::updateOrCreate(['email' => 'editor@social-automation.test'], [
            'name' => 'Casey Editor',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
        ]);

        $pro = Plan::where('slug', 'pro')->first();

        $workspace = Workspace::updateOrCreate(
            ['slug' => 'demo-studio'],
            ['owner_id' => $owner->id, 'name' => 'Demo Studio', 'timezone' => 'America/New_York', 'trial_ends_at' => now()->addDays(14)],
        );

        $workspace->addMember($owner, WorkspaceRole::Owner);
        $workspace->addMember($editor, WorkspaceRole::Editor);
        $owner->forceFill(['current_workspace_id' => $workspace->id])->save();
        $editor->forceFill(['current_workspace_id' => $workspace->id])->save();

        Subscription::updateOrCreate(['workspace_id' => $workspace->id], [
            'plan_id' => $pro?->id,
            'status' => SubscriptionStatus::Active,
            'billing_cycle' => 'monthly',
            'current_period_start' => now()->startOfMonth(),
            'current_period_end' => now()->endOfMonth(),
        ]);

        $accounts = $this->connectAccounts($workspace, $owner->id);
        $this->createPosts($workspace, $owner->id, $accounts);
        $this->createAnalytics($workspace, $accounts);
        $this->createAutomation($workspace, $owner->id, $accounts);
    }

    /**
     * @return array<int, SocialAccount>
     */
    protected function connectAccounts(Workspace $workspace, int $userId): array
    {
        $platforms = ['facebook_page', 'instagram', 'twitter', 'linkedin_page', 'tiktok', 'youtube', 'telegram'];
        $accounts = [];

        foreach ($platforms as $platform) {
            $label = config("social.platforms.{$platform}.label");
            $handle = Str::slug($label);

            $accounts[] = SocialAccount::updateOrCreate(
                ['workspace_id' => $workspace->id, 'platform' => $platform, 'provider_account_id' => (string) crc32($platform)],
                [
                    'connected_by' => $userId,
                    'name' => "Demo {$label}",
                    'username' => '@demo_'.$handle,
                    'avatar_url' => "https://api.dicebear.com/7.x/initials/svg?seed={$handle}",
                    'profile_url' => "https://example.com/{$handle}",
                    'access_token' => 'demo-'.Str::random(24),
                    'token_expires_at' => now()->addDays(45),
                    'status' => 'active',
                ],
            );
        }

        return $accounts;
    }

    /**
     * @param  array<int, SocialAccount>  $accounts
     */
    protected function createPosts(Workspace $workspace, int $userId, array $accounts): void
    {
        $samples = [
            ['content' => '🚀 We just shipped a huge update! Schedule once, publish everywhere. #saas #marketing', 'status' => PostStatus::Published, 'when' => now()->subDays(2)],
            ['content' => 'Behind the scenes of how our team plans content for the week 📅', 'status' => PostStatus::Published, 'when' => now()->subDay()],
            ['content' => '5 hooks that stopped the scroll this month 🧵', 'status' => PostStatus::Scheduled, 'when' => now()->addDay()],
            ['content' => 'Drafting our next product announcement...', 'status' => PostStatus::Draft, 'when' => null],
            ['content' => 'New blog post: The complete guide to social automation in 2026', 'status' => PostStatus::Scheduled, 'when' => now()->addDays(2)],
            ['content' => 'Customer spotlight: how @acme grew 3x with scheduled posting', 'status' => PostStatus::PendingApproval, 'when' => now()->addDays(3)],
            ['content' => 'This one failed to publish — token issue (demo).', 'status' => PostStatus::Failed, 'when' => now()->subHours(6)],
        ];

        foreach ($samples as $sample) {
            $post = Post::create([
                'workspace_id' => $workspace->id,
                'created_by' => $userId,
                'content' => $sample['content'],
                'type' => 'text',
                'status' => $sample['status'],
                'hashtags' => ['socialmedia', 'automation'],
                'scheduled_at' => $sample['when'],
                'published_at' => $sample['status'] === PostStatus::Published ? $sample['when'] : null,
                'requires_approval' => $sample['status'] === PostStatus::PendingApproval,
            ]);

            foreach (array_slice($accounts, 0, random_int(2, 4)) as $account) {
                $variant = PostVariant::create([
                    'post_id' => $post->id,
                    'social_account_id' => $account->id,
                    'platform' => $account->platform,
                    'status' => $sample['status'],
                    'scheduled_at' => $sample['when'],
                    'published_at' => $sample['status'] === PostStatus::Published ? $sample['when'] : null,
                    'provider_post_id' => $sample['status'] === PostStatus::Published ? Str::uuid()->toString() : null,
                    'error_message' => $sample['status'] === PostStatus::Failed ? 'The access token has expired. Please reconnect the account.' : null,
                ]);

                if ($sample['status'] === PostStatus::Published) {
                    PublishedPost::create([
                        'post_variant_id' => $variant->id,
                        'social_account_id' => $account->id,
                        'workspace_id' => $workspace->id,
                        'platform' => $account->platform,
                        'provider_post_id' => $variant->provider_post_id,
                        'permalink' => "https://example.com/p/".Str::random(8),
                        'published_at' => $sample['when'],
                        'likes' => random_int(20, 800),
                        'comments' => random_int(2, 120),
                        'shares' => random_int(0, 90),
                        'views' => random_int(500, 20000),
                        'clicks' => random_int(10, 600),
                        'impressions' => random_int(1000, 40000),
                        'metrics_synced_at' => now(),
                    ]);
                }
            }
        }
    }

    /**
     * @param  array<int, SocialAccount>  $accounts
     */
    protected function createAnalytics(Workspace $workspace, array $accounts): void
    {
        foreach ($accounts as $account) {
            $followers = random_int(2000, 50000);

            for ($d = 29; $d >= 0; $d--) {
                $delta = random_int(-20, 200);
                $followers += $delta;

                AnalyticsSnapshot::updateOrCreate(
                    ['social_account_id' => $account->id, 'date' => today()->subDays($d)],
                    [
                        'workspace_id' => $workspace->id,
                        'platform' => $account->platform,
                        'followers' => $followers,
                        'followers_delta' => $delta,
                        'posts_published' => random_int(0, 4),
                        'likes' => random_int(50, 2000),
                        'comments' => random_int(5, 300),
                        'shares' => random_int(0, 200),
                        'views' => random_int(500, 30000),
                        'clicks' => random_int(20, 1500),
                        'impressions' => random_int(2000, 80000),
                        'engagement_rate' => round(random_int(50, 950) / 100, 2),
                    ],
                );
            }
        }
    }

    /**
     * @param  array<int, SocialAccount>  $accounts
     */
    protected function createAutomation(Workspace $workspace, int $userId, array $accounts): void
    {
        $automation = Automation::updateOrCreate(
            ['workspace_id' => $workspace->id, 'name' => 'Blog → Social (RSS)'],
            [
                'created_by' => $userId,
                'type' => 'rss_feed',
                'is_active' => true,
                'social_account_ids' => collect($accounts)->take(3)->pluck('id')->all(),
                'config' => ['interval_minutes' => 60],
                'use_ai' => true,
                'next_run_at' => now()->addHour(),
            ],
        );

        $automation->feeds()->updateOrCreate(
            ['url' => 'https://wordpress.org/news/feed/'],
            ['workspace_id' => $workspace->id, 'title' => 'WordPress News'],
        );
    }
}
