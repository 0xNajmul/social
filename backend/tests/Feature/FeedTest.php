<?php

namespace Tests\Feature;

use App\Models\RssFeed;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class FeedTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_user_can_create_feed_and_read_stored_items(): void
    {
        $user = $this->actingAsUser();
        Http::fake([
            'https://example.com/feed.xml' => Http::response($this->rssXml()),
        ]);

        $this->postJson('/api/feeds', [
            'title' => 'Example Feed',
            'url' => 'https://example.com/feed.xml',
            'country' => 'US',
            'category' => 'News',
        ], $this->workspaceHeaders($user))
            ->assertCreated()
            ->assertJsonPath('data.title', 'Example Feed')
            ->assertJsonPath('data.items_count', 1);

        $this->getJson('/api/feed/items?category=News', $this->workspaceHeaders($user))
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Stored RSS story')
            ->assertJsonPath('data.0.source', 'Example Feed')
            ->assertJsonPath('data.0.country', 'US');
    }

    public function test_user_can_request_a_specific_number_of_latest_feed_items(): void
    {
        $user = $this->actingAsUser();
        $workspace = $user->workspaces()->firstOrFail();
        $feed = RssFeed::create([
            'workspace_id' => $workspace->id,
            'status' => 'active',
            'title' => 'Latest Feed',
            'url' => 'https://example.com/latest.xml',
            'country' => 'Global',
            'category' => 'News',
            'last_fetched_at' => now(),
        ]);

        foreach (range(1, 5) as $index) {
            $feed->items()->create([
                'guid' => "story-{$index}",
                'title' => "Story {$index}",
                'link' => "https://example.com/story-{$index}",
                'published_at' => now()->subMinutes($index),
            ]);
        }

        $this->getJson('/api/feed/items?per_page=2', $this->workspaceHeaders($user))
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('data.0.title', 'Story 1');
    }

    public function test_admin_can_manage_workspace_feeds(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $user = $this->actingAsUser($admin);
        $workspace = $user->workspaces()->firstOrFail();
        Http::fake([
            'https://example.com/admin-feed.xml' => Http::response($this->rssXml('Admin RSS story')),
        ]);

        $this->postJson('/api/admin/feeds', [
            'workspace_id' => $workspace->id,
            'title' => 'Admin Feed',
            'url' => 'https://example.com/admin-feed.xml',
            'country' => 'Global',
            'category' => 'Technology',
        ])
            ->assertCreated()
            ->assertJsonPath('data.workspace.id', $workspace->id)
            ->assertJsonPath('data.items_count', 1);

        $feed = RssFeed::where('title', 'Admin Feed')->firstOrFail();

        $this->putJson("/api/admin/feeds/{$feed->id}", [
            'status' => 'paused',
        ])->assertOk()->assertJsonPath('data.status', 'paused');

        $this->deleteJson("/api/admin/feeds/{$feed->id}")
            ->assertOk();

        $this->assertDatabaseMissing('rss_feeds', ['id' => $feed->id]);
    }

    protected function rssXml(string $title = 'Stored RSS story'): string
    {
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Remote Feed Title</title>
    <item>
      <guid>story-1</guid>
      <title>{$title}</title>
      <description><![CDATA[This item came from the remote RSS document.]]></description>
      <link>https://example.com/story-1</link>
      <pubDate>Wed, 24 Jun 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
XML;
    }
}
