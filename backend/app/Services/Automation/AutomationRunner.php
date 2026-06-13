<?php

namespace App\Services\Automation;

use App\Enums\AutomationType;
use App\Enums\PostStatus;
use App\Models\Automation;
use App\Models\Post;
use App\Models\PostVariant;
use App\Models\RssFeed;
use App\Models\SocialAccount;
use App\Services\AI\AiContentService;
use App\Services\Scheduling\PostScheduler;
use Illuminate\Support\Carbon;

/**
 * Executes a single automation. RSS / blog automations pull new items and
 * turn them into scheduled posts; recycle/repost automations re-queue existing
 * evergreen content. Optionally enriches copy via the AI service.
 */
class AutomationRunner
{
    public function __construct(
        protected PostScheduler $scheduler,
        protected AiContentService $ai,
    ) {}

    public function run(Automation $automation): int
    {
        $created = match ($automation->type) {
            AutomationType::RssFeed, AutomationType::Blog => $this->runFeeds($automation),
            AutomationType::Recycle, AutomationType::RepostTopPerforming => $this->runRecycle($automation),
            default => 0,
        };

        $automation->update([
            'last_run_at' => now(),
            'next_run_at' => $this->nextRunAt($automation),
            'items_created' => $automation->items_created + $created,
        ]);

        return $created;
    }

    protected function runFeeds(Automation $automation): int
    {
        $created = 0;

        foreach ($automation->feeds as $feed) {
            foreach ($this->fetchNewItems($feed) as $item) {
                $content = $item['title'].($item['link'] ? "\n".$item['link'] : '');

                if ($automation->use_ai) {
                    $content = $this->ai->captionFromTitle($automation->workspace, $item['title'], $item['summary'] ?? '');
                }

                $this->createPost($automation, $content, $item['link'] ?? null);
                $created++;
            }

            $feed->update(['last_fetched_at' => now()]);
        }

        return $created;
    }

    protected function runRecycle(Automation $automation): int
    {
        // Re-queue the workspace's top evergreen posts. Implementation hook:
        // select best performing published posts and clone them as drafts.
        return 0;
    }

    /**
     * Read an RSS/Atom feed and return unseen items.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function fetchNewItems(RssFeed $feed): array
    {
        try {
            $xml = @simplexml_load_file($feed->url);
        } catch (\Throwable) {
            return [];
        }

        if (! $xml) {
            return [];
        }

        $items = [];
        $entries = $xml->channel->item ?? $xml->entry ?? [];

        foreach ($entries as $entry) {
            $guid = (string) ($entry->guid ?? $entry->id ?? $entry->link);
            if ($guid === $feed->last_item_guid) {
                break; // Reached previously processed items.
            }

            $items[] = [
                'guid' => $guid,
                'title' => (string) $entry->title,
                'summary' => (string) ($entry->description ?? $entry->summary ?? ''),
                'link' => (string) ($entry->link['href'] ?? $entry->link),
            ];
        }

        if ($first = $items[0] ?? null) {
            $feed->update(['last_item_guid' => $first['guid']]);
        }

        return array_slice($items, 0, 5); // Cap per run.
    }

    protected function createPost(Automation $automation, string $content, ?string $link): void
    {
        $post = Post::create([
            'workspace_id' => $automation->workspace_id,
            'created_by' => $automation->created_by,
            'automation_id' => $automation->id,
            'content' => $content,
            'link_url' => $link,
            'type' => $link ? 'link' : 'text',
            'status' => $automation->requires_approval ? PostStatus::PendingApproval : PostStatus::Scheduled,
            'requires_approval' => $automation->requires_approval,
            'scheduled_at' => now()->addMinutes(10),
        ]);

        foreach ($automation->social_account_ids ?? [] as $accountId) {
            $account = SocialAccount::find($accountId);
            if (! $account) {
                continue;
            }

            PostVariant::create([
                'post_id' => $post->id,
                'social_account_id' => $account->id,
                'platform' => $account->platform,
                'status' => $post->status,
                'scheduled_at' => $post->scheduled_at,
            ]);
        }

        if (! $automation->requires_approval) {
            $post->load('variants');
            $this->scheduler->schedule($post, $post->scheduled_at);
        }
    }

    protected function nextRunAt(Automation $automation): Carbon
    {
        $minutes = (int) data_get($automation->config, 'interval_minutes', 60);

        return now()->addMinutes(max(15, $minutes));
    }
}
