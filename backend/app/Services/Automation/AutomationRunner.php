<?php

namespace App\Services\Automation;

use App\Enums\AutomationType;
use App\Enums\PostStatus;
use App\Jobs\ProcessAutomationJob;
use App\Models\Automation;
use App\Models\MediaAsset;
use App\Models\Post;
use App\Models\PostVariant;
use App\Models\RssFeed;
use App\Models\SocialAccount;
use App\Notifications\AutomationWorkflowNotification;
use App\Services\AI\AiContentService;
use App\Services\Scheduling\PostScheduler;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Executes classic automations and the visual workflow builder graph.
 */
class AutomationRunner
{
    public function __construct(
        protected PostScheduler $scheduler,
        protected AiContentService $ai,
    ) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function run(Automation $automation, array $context = []): int
    {
        $automation->loadMissing(['feeds', 'workspace.owner', 'workspace.members', 'creator']);
        $workflow = data_get($automation->config, 'workflow');

        if (is_array($workflow) && ! empty($workflow['nodes'])) {
            $result = $this->runWorkflow($automation, $workflow, $context);
            $created = $result['created'];
        } else {
            $created = match ($automation->type) {
                AutomationType::RssFeed, AutomationType::Blog => $this->runFeeds($automation),
                AutomationType::Recycle, AutomationType::RepostTopPerforming => $this->runRecycle($automation),
                default => 0,
            };
        }

        $automation->update([
            'last_run_at' => now(),
            'next_run_at' => $this->nextRunAt($automation),
            'items_created' => (int) $automation->items_created + $created,
        ]);

        return $created;
    }

    /**
     * @param  array<string, mixed>  $workflow
     * @param  array<string, mixed>  $context
     * @return array{created:int,deferred:bool}
     */
    protected function runWorkflow(Automation $automation, array $workflow, array $context = []): array
    {
        $nodes = $this->orderedWorkflowNodes($workflow['nodes'] ?? [], $workflow['edges'] ?? []);
        $state = array_replace_recursive($this->initialWorkflowState($automation), is_array($context['state'] ?? null) ? $context['state'] : []);
        $startIndex = $this->resumeIndex($nodes, (string) ($context['resume_after_node'] ?? ''));
        $created = 0;

        for ($index = $startIndex; $index < count($nodes); $index++) {
            $node = $nodes[$index];
            $nodeId = (string) ($node['id'] ?? '');
            $key = (string) data_get($node, 'data.key', '');
            $config = (array) data_get($node, 'data.config', []);

            if ($key === 'delay_wait_until') {
                $seconds = $this->delaySeconds($config, $state);
                if ($seconds > 0 && ! ($context['skip_delays'] ?? false)) {
                    $resumeAt = now()->addSeconds($seconds);
                    $state['delay'] = [
                        'seconds' => $seconds,
                        'duration' => $this->formatSecondsForHumans($seconds),
                        'resume_at' => $resumeAt->toIso8601String(),
                    ];

                    ProcessAutomationJob::dispatch($automation->id, [
                        'resume_after_node' => $nodeId,
                        'skip_delays' => true,
                        'state' => $state,
                    ])->delay($resumeAt);

                    $this->sendAutomationNotification(
                        $automation,
                        "Workflow paused: {$automation->name}",
                        "{$automation->name} is waiting for {$state['delay']['duration']} and will resume around {$resumeAt->format('M j, Y g:i A')}.",
                        'delay_waiting',
                        $state['post_id'] ?? null,
                        [
                            'priority' => 'normal',
                            'channel' => 'in_app',
                            'audience' => 'automation_owner',
                            'action_label' => 'Open workflow',
                            'context' => [
                                'delay_seconds' => $seconds,
                                'delay_duration' => $state['delay']['duration'],
                                'resume_at' => $state['delay']['resume_at'],
                            ],
                        ],
                    );

                    return ['created' => $created, 'deferred' => true];
                }

                continue;
            }

            if ($key === 'manual_trigger' || $key === 'schedule_trigger' || $key === 'webhook_trigger') {
                $state['trigger'] = $key;
                continue;
            }

            if ($key === 'rss_feed_trigger') {
                $state = array_replace_recursive($state, $this->workflowRssState($automation, $config));
                continue;
            }

            if ($key === 'create_post') {
                $post = $this->createWorkflowPost($automation, $state, $config, PostStatus::Draft);
                $state['post_id'] = $post->id;
                $state['caption'] = $post->content;
                $state['media_urls'] = data_get($post->options, 'media_urls', []);
                $state['media_ids'] = data_get($post->options, 'media_ids', []);
                $state['counted_posts'][$post->id] = true;
                $created++;
                continue;
            }

            if ($key === 'content_library') {
                $state = $this->loadContentLibraryState($automation, $state, $config);
                continue;
            }

            if ($key === 'ai_caption_generator') {
                $topic = $state['caption'] ?: $state['rss']['title'] ?: $automation->name;
                $state['ai']['output'] = $this->ai->caption($automation->workspace, $topic, $config);
                $state['caption'] = $state['ai']['output'];
                continue;
            }

            if ($key === 'ai_content_generator') {
                $topic = $this->workflowAiTopic($automation, $state, $config);
                $state['ai']['content'] = $this->ai->content($automation->workspace, $topic, $config);
                $state['ai']['output'] = $state['ai']['content'];
                $state['caption'] = $state['ai']['content'];
                continue;
            }

            if ($key === 'ai_hashtag_generator') {
                $state['hashtags'] = $this->ai->hashtags($automation->workspace, $state['caption'] ?: $automation->name, $config);
                continue;
            }

            if ($key === 'ai_summarize_article') {
                $summary = $state['rss']['summary'] ?: $state['caption'] ?: $automation->name;
                $state['ai']['summary'] = $this->ai->caption($automation->workspace, $summary, ['tone' => 'concise'] + $config);
                $state['caption'] = $state['ai']['summary'];
                continue;
            }

            if ($key === 'platform_variant_generator') {
                $state['variant_instructions'] = (string) ($config['variants'] ?? '');
                continue;
            }

            if ($key === 'add_media') {
                $state = $this->applyWorkflowMediaState($state, $config);
                continue;
            }

            if ($key === 'filter' && ! $this->passesFilter($state, $config)) {
                $this->sendAutomationNotification($automation, 'Automation stopped', "{$automation->name} stopped because a filter did not match.", 'filter_stopped', $state['post_id'] ?? null);
                return ['created' => $created, 'deferred' => false];
            }

            if ($key === 'approval_required') {
                $post = $this->ensureWorkflowPost($automation, $state, $config, PostStatus::PendingApproval);
                $post->update(['requires_approval' => true, 'status' => PostStatus::PendingApproval]);
                $post->variants()->update(['status' => PostStatus::PendingApproval]);
                $state['post_id'] = $post->id;
                continue;
            }

            if ($key === 'create_draft') {
                $post = $this->ensureWorkflowPost($automation, $state, $config, PostStatus::Draft);
                $post->update(['status' => PostStatus::Draft]);
                $state['post_id'] = $post->id;
                if (! ($state['counted_posts'][$post->id] ?? false)) {
                    $state['counted_posts'][$post->id] = true;
                    $created++;
                }
                continue;
            }

            if ($key === 'publish_social_account' || str_starts_with($key, 'publish_')) {
                $post = $this->publishWorkflowPost($automation, $state, $config, $key);
                $state['post_id'] = $post->id;
                if (! ($state['counted_posts'][$post->id] ?? false)) {
                    $state['counted_posts'][$post->id] = true;
                    $created++;
                }
                continue;
            }

            if (in_array($key, ['send_notification', 'send_failure_alert', 'webhook_notification'], true)) {
                $this->sendConfiguredWorkflowNotification($automation, $state, $config, $key);
            }
        }

        $this->sendAutomationNotification($automation, 'Automation completed', "{$automation->name} finished running.", 'run_completed', $state['post_id'] ?? null);

        return ['created' => $created, 'deferred' => false];
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
        $source = $automation->workspace
            ->posts()
            ->where('status', PostStatus::Published->value)
            ->latest('published_at')
            ->first();

        if (! $source) {
            return 0;
        }

        $copy = $source->replicate(['published_at']);
        $copy->automation_id = $automation->id;
        $copy->status = PostStatus::Draft;
        $copy->scheduled_at = now()->addMinutes(10);
        $copy->save();

        return 1;
    }

    /**
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
                break;
            }

            $items[] = [
                'guid' => $guid,
                'title' => (string) $entry->title,
                'summary' => (string) ($entry->description ?? $entry->summary ?? ''),
                'link' => (string) ($entry->link['href'] ?? $entry->link),
            ];
        }

        if (($first = $items[0] ?? null) && $feed->exists) {
            $feed->update(['last_item_guid' => $first['guid']]);
        }

        return array_slice($items, 0, 5);
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

    /**
     * @param  array<int, mixed>  $nodes
     * @param  array<int, mixed>  $edges
     * @return array<int, array<string, mixed>>
     */
    protected function orderedWorkflowNodes(array $nodes, array $edges): array
    {
        $nodeMap = collect($nodes)
            ->filter(fn ($node) => is_array($node) && ! empty($node['id']) && ! in_array((string) data_get($node, 'data.key'), ['group_background', 'sticky_note'], true))
            ->keyBy('id');
        $incoming = [];
        $outgoing = [];

        foreach ($edges as $edge) {
            $source = (string) ($edge['source'] ?? '');
            $target = (string) ($edge['target'] ?? '');
            if (! $nodeMap->has($source) || ! $nodeMap->has($target)) {
                continue;
            }
            $outgoing[$source][] = $target;
            $incoming[$target][] = $source;
        }

        $ordered = [];
        $visited = [];
        $queue = $nodeMap
            ->keys()
            ->filter(fn ($id) => empty($incoming[$id]))
            ->values()
            ->all();

        if (empty($queue)) {
            $queue = $nodeMap->keys()->values()->all();
        }

        while ($queue) {
            $id = array_shift($queue);
            if (isset($visited[$id])) {
                continue;
            }
            $visited[$id] = true;
            $ordered[] = $nodeMap[$id];
            foreach ($outgoing[$id] ?? [] as $nextId) {
                $queue[] = $nextId;
            }
        }

        foreach ($nodeMap as $id => $node) {
            if (! isset($visited[$id])) {
                $ordered[] = $node;
            }
        }

        return $ordered;
    }

    /**
     * @param  array<int, array<string, mixed>>  $nodes
     */
    protected function resumeIndex(array $nodes, string $resumeAfterNode): int
    {
        if ($resumeAfterNode === '') {
            return 0;
        }

        foreach ($nodes as $index => $node) {
            if (($node['id'] ?? '') === $resumeAfterNode) {
                return $index + 1;
            }
        }

        return 0;
    }

    /**
     * @return array<string, mixed>
     */
    protected function initialWorkflowState(Automation $automation): array
    {
        return [
            'automation_id' => $automation->id,
            'workspace_id' => $automation->workspace_id,
            'caption' => '',
            'link' => '',
            'media_ids' => [],
            'media_urls' => [],
            'post_id' => null,
            'rss' => ['title' => '', 'summary' => '', 'link' => ''],
            'ai' => ['output' => '', 'summary' => ''],
            'hashtags' => [],
            'counted_posts' => [],
            'workflow' => [
                'next_run_at' => $automation->next_run_at?->toIso8601String(),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    protected function workflowRssState(Automation $automation, array $config): array
    {
        $feeds = $automation->feeds->values();
        if (! empty($config['feed_urls'])) {
            $configured = collect(preg_split('/[\s,]+/', (string) $config['feed_urls']) ?: [])
                ->map(fn ($item) => trim($item))
                ->filter()
                ->map(fn ($url) => new RssFeed([
                    'workspace_id' => $automation->workspace_id,
                    'automation_id' => $automation->id,
                    'url' => $url,
                ]));
            $feeds = $feeds->merge($configured);
        }

        $item = null;
        foreach ($feeds as $feed) {
            $item = $this->fetchNewItems($feed)[0] ?? null;
            if ($item) {
                break;
            }
        }

        if (! $item) {
            return [
                'caption' => $automation->name,
                'rss' => [
                    'title' => $automation->name,
                    'summary' => '',
                    'link' => '',
                ],
            ];
        }

        return [
            'caption' => $item['title'] ?? '',
            'link' => $item['link'] ?? '',
            'rss' => [
                'title' => $item['title'] ?? '',
                'summary' => $item['summary'] ?? '',
                'link' => $item['link'] ?? '',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function loadContentLibraryState(Automation $automation, array $state, array $config): array
    {
        $post = $automation->workspace->posts()->latest()->first();
        if (! $post) {
            return $state;
        }

        $state['post_id'] = $post->id;
        $state['caption'] = $post->content ?: $state['caption'];
        $state['link'] = $post->link_url ?: $state['link'];
        $state['media_ids'] = $post->media()->pluck('media_assets.id')->all();
        $state['media_urls'] = data_get($post->options, 'media_urls', $state['media_urls'] ?? []);

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    protected function applyWorkflowMediaState(array $state, array $config): array
    {
        $mediaUrl = $this->resolveText((string) ($config['media_url'] ?? ''), $state);
        if ($this->isSafeMediaUrl($mediaUrl)) {
            $state['media_urls'] = collect($state['media_urls'] ?? [])
                ->push($mediaUrl)
                ->unique()
                ->values()
                ->all();
        }

        if (! empty($config['alt_text'])) {
            $state['media_alt_text'] = (string) $config['alt_text'];
        }

        $mediaIds = $this->workflowMediaIds(null, $state, $config);
        if ($mediaIds) {
            $state['media_ids'] = $mediaIds;
        }

        return $state;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function workflowAiTopic(Automation $automation, array $state, array $config): string
    {
        $source = (string) ($config['source'] ?? 'feed_or_topic');
        $topic = $this->resolveText((string) ($config['topic'] ?? ''), $state);
        $rssTitle = (string) data_get($state, 'rss.title', '');
        $rssSummary = (string) data_get($state, 'rss.summary', '');
        $rssLink = (string) data_get($state, 'rss.link', '');

        if ($source === 'custom_prompt') {
            return trim(($topic ?: $automation->name)."\n\n".(string) ($config['prompt'] ?? ''));
        }

        if ($source !== 'topic' && ($rssTitle || $rssSummary)) {
            return trim($rssTitle."\n\n".$rssSummary.($rssLink ? "\n\nSource: {$rssLink}" : ''));
        }

        return $topic ?: $state['caption'] ?: $automation->name;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function createWorkflowPost(Automation $automation, array $state, array $config, PostStatus $status): Post
    {
        $caption = $this->resolveText((string) ($config['caption'] ?? $state['caption'] ?: $automation->name), $state);
        $link = $this->resolveText((string) ($config['link'] ?? $state['link'] ?? ''), $state);
        $title = $this->resolveText((string) ($config['title'] ?? ''), $state);
        $mediaUrls = $this->workflowMediaUrls($state, $config);
        $mediaIds = $this->workflowMediaIds($automation, $state, $config);

        $post = Post::create([
            'workspace_id' => $automation->workspace_id,
            'created_by' => $automation->created_by,
            'automation_id' => $automation->id,
            'title' => $title ?: null,
            'content' => $caption,
            'link_url' => $link ?: null,
            'type' => $this->workflowPostType($automation, $mediaUrls, $mediaIds, $link),
            'status' => $status,
            'hashtags' => $state['hashtags'] ?? [],
            'requires_approval' => $status === PostStatus::PendingApproval || $automation->requires_approval,
            'scheduled_at' => now(),
            'options' => [
                'campaign' => $config['campaign'] ?? null,
                'image_url' => $mediaUrls[0] ?? null,
                'media_ids' => $mediaIds,
                'media_urls' => $mediaUrls,
                'media_alt_text' => $config['alt_text'] ?? ($state['media_alt_text'] ?? null),
                'automation_workflow' => true,
            ],
        ]);

        $this->syncWorkflowPostMedia($post, $mediaIds);

        return $post;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function ensureWorkflowPost(Automation $automation, array $state, array $config, PostStatus $status): Post
    {
        if (! empty($state['post_id'])) {
            $post = Post::where('workspace_id', $automation->workspace_id)->find($state['post_id']);
            if ($post) {
                return $post;
            }
        }

        return $this->createWorkflowPost($automation, $state, $config, $status);
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function publishWorkflowPost(Automation $automation, array $state, array $config, string $nodeKey): Post
    {
        $status = $automation->requires_approval ? PostStatus::PendingApproval : PostStatus::Scheduled;
        $post = $this->ensureWorkflowPost($automation, $state, $config, $status);
        $accountIds = $this->workflowAccountIds($automation, $config);

        if ($nodeKey !== 'publish_social_account' && str_starts_with($nodeKey, 'publish_')) {
            $platform = Str::after($nodeKey, 'publish_');
            $allowedIds = $accountIds ?: ($automation->social_account_ids ?? []);
            $accountIds = SocialAccount::where('workspace_id', $automation->workspace_id)
                ->where('platform', $platform)
                ->whereIn('id', $allowedIds)
                ->pluck('id')
                ->all();
        }

        $this->syncPostVariants($post, $accountIds, $state, $config);

        $mode = (string) ($config['publish_mode'] ?? 'schedule_or_now');
        if ($automation->requires_approval || $post->requires_approval) {
            $post->update(['status' => PostStatus::PendingApproval]);
            $post->variants()->update(['status' => PostStatus::PendingApproval]);
        } elseif ($mode === 'publish_now') {
            $post->load('variants');
            $this->scheduler->publishNow($post);
        } elseif ($mode === 'draft') {
            $post->update(['status' => PostStatus::Draft]);
            $post->variants()->update(['status' => PostStatus::Draft]);
        } else {
            $post->load('variants');
            $this->scheduler->schedule($post, $post->scheduled_at ?: now());
        }

        return $post;
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function syncPostVariants(Post $post, array $accountIds, array $state, array $config): void
    {
        $accounts = SocialAccount::where('workspace_id', $post->workspace_id)->whereIn('id', $accountIds)->get();
        $caption = $this->resolveText((string) ($config['caption_field'] ?? $state['caption'] ?? $post->content), $state);

        foreach ($accounts as $account) {
            PostVariant::updateOrCreate(
                ['post_id' => $post->id, 'social_account_id' => $account->id],
                [
                    'platform' => $account->platform,
                    'content' => $caption ?: $post->content,
                    'hashtags' => $state['hashtags'] ?? [],
                    'status' => $post->status,
                    'scheduled_at' => $post->scheduled_at ?: now(),
                    'options' => [
                        'post_type' => $config['post_type'] ?? 'auto',
                        'media_ids' => data_get($post->options, 'media_ids', []),
                        'media_urls' => data_get($post->options, 'media_urls', []),
                        'image_url' => data_get($post->options, 'image_url'),
                        'automation_workflow' => true,
                    ],
                ],
            );
        }
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     * @return array<int, string>
     */
    protected function workflowMediaUrls(array $state, array $config): array
    {
        $urls = collect($state['media_urls'] ?? []);
        if (is_array($config['media_urls'] ?? null)) {
            $urls = $urls->merge($config['media_urls']);
        }
        if (is_array($config['media'] ?? null)) {
            $urls = $urls->merge(collect($config['media'])->pluck('url')->filter());
        }
        foreach (['image_url', 'media_url'] as $key) {
            if (! empty($config[$key])) {
                $urls->push($this->resolveText((string) $config[$key], $state));
            }
        }

        return $urls
            ->map(fn ($url) => trim((string) $url))
            ->filter(fn ($url) => $this->isSafeMediaUrl($url))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     * @return array<int, int>
     */
    protected function workflowMediaIds(?Automation $automation, array $state, array $config): array
    {
        $ids = collect($state['media_ids'] ?? []);
        if (is_array($config['media_ids'] ?? null)) {
            $ids = $ids->merge($config['media_ids']);
        }
        if (is_array($config['media'] ?? null)) {
            $ids = $ids->merge(collect($config['media'])->pluck('id'));
        }

        if ($automation) {
            $localPaths = $this->workflowLocalMediaPaths($state, $config);
            if ($localPaths) {
                $ids = $ids->merge(MediaAsset::where('workspace_id', $automation->workspace_id)
                    ->whereIn('path', $localPaths)
                    ->pluck('id'));
            }
        }

        $ids = $ids
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (! $automation || $ids === []) {
            return $ids;
        }

        $validIds = MediaAsset::where('workspace_id', $automation->workspace_id)
            ->whereIn('id', $ids)
            ->pluck('id')
            ->all();
        $validSet = array_flip($validIds);

        return array_values(array_filter($ids, fn ($id) => isset($validSet[$id])));
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     * @return array<int, string>
     */
    protected function workflowLocalMediaPaths(array $state, array $config): array
    {
        $urls = collect($state['media_urls'] ?? []);
        if (is_array($config['media_urls'] ?? null)) {
            $urls = $urls->merge($config['media_urls']);
        }
        if (is_array($config['media'] ?? null)) {
            $urls = $urls->merge(collect($config['media'])->pluck('url'));
        }

        foreach (['image_url', 'media_url'] as $key) {
            if (! empty($config[$key])) {
                $urls->push($this->resolveText((string) $config[$key], $state));
            }
        }

        return $urls
            ->map(fn ($url) => $this->storageUrlToPath((string) $url))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    protected function storageUrlToPath(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH) ?: $url;
        $path = ltrim(str_replace('\\', '/', $path), '/');

        if (! str_starts_with($path, 'storage/')) {
            return null;
        }

        return ltrim(substr($path, strlen('storage/')), '/');
    }

    /**
     * @param  array<int, string>  $mediaUrls
     * @param  array<int, int>  $mediaIds
     */
    protected function workflowPostType(Automation $automation, array $mediaUrls, array $mediaIds, string $link): string
    {
        if ($mediaIds) {
            $assets = MediaAsset::where('workspace_id', $automation->workspace_id)
                ->whereIn('id', $mediaIds)
                ->get()
                ->keyBy('id');

            foreach ($mediaIds as $id) {
                $asset = $assets->get($id);
                $type = $asset?->type instanceof \BackedEnum ? $asset->type->value : (string) ($asset?->type ?? '');
                if ($type === 'video') {
                    return 'video';
                }
                if (in_array($type, ['image', 'gif'], true)) {
                    return 'image';
                }
            }
        }

        return $mediaUrls ? 'image' : ($link ? 'link' : 'text');
    }

    /**
     * @param  array<int, int>  $mediaIds
     */
    protected function syncWorkflowPostMedia(Post $post, array $mediaIds): void
    {
        if ($mediaIds === []) {
            return;
        }

        $sync = [];
        foreach (array_values($mediaIds) as $position => $id) {
            $sync[$id] = ['position' => $position];
        }

        $post->media()->sync($sync);
    }

    protected function isSafeMediaUrl(string $url): bool
    {
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        return in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true);
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<int, int>
     */
    protected function workflowAccountIds(Automation $automation, array $config): array
    {
        $ids = collect($automation->social_account_ids ?? []);
        if (is_array($config['account_ids'] ?? null)) {
            $ids = $ids->merge($config['account_ids']);
        }
        if (! empty($config['account_id'])) {
            $ids->push($config['account_id']);
        }

        return $ids->map(fn ($id) => (int) $id)->filter()->unique()->values()->all();
    }

    /**
     * @param  array<string, mixed>  $config
     * @param  array<string, mixed>  $state
     */
    protected function delaySeconds(array $config, array $state): int
    {
        if (($config['mode'] ?? 'delay') === 'wait_until' && ! empty($config['wait_until'])) {
            $target = $this->resolveText((string) $config['wait_until'], $state);
            try {
                $seconds = max(0, now()->diffInSeconds(Carbon::parse($target), false));
                $maxHours = max(1, min((int) ($config['max_wait_hours'] ?? 168), 8760));

                return min($seconds, $maxHours * 3600);
            } catch (\Throwable) {
                return 0;
            }
        }

        if (array_key_exists('delay_value', $config)) {
            $value = max(0, (float) ($config['delay_value'] ?? 0));
            $unit = (string) ($config['delay_unit'] ?? 'minutes');
            $multiplier = match ($unit) {
                'seconds' => 1,
                'hours' => 3600,
                'days' => 86400,
                default => 60,
            };

            return (int) min($value * $multiplier, 31536000);
        }

        $minutes = (int) ($config['delay_minutes'] ?? 0);

        return max(0, min($minutes, 10080) * 60);
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function passesFilter(array $state, array $config): bool
    {
        $field = (string) ($config['field'] ?? 'caption');
        $actual = (string) data_get($state, str_replace('.', '.', $field), '');
        $expected = (string) ($config['value'] ?? '');

        return match ((string) ($config['operator'] ?? 'contains')) {
            'not_contains' => ! Str::contains(Str::lower($actual), Str::lower($expected)),
            'equals' => $actual === $expected,
            'exists' => $actual !== '',
            default => Str::contains(Str::lower($actual), Str::lower($expected)),
        };
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     */
    protected function sendConfiguredWorkflowNotification(Automation $automation, array $state, array $config, string $key): void
    {
        $event = (string) ($config['event'] ?? match ($key) {
            'send_failure_alert' => 'failure_alert',
            'webhook_notification' => 'webhook_notification',
            default => 'run_completed',
        });
        $template = $this->notificationTemplateForEvent($event, $key);
        $status = $this->workflowStatusLabel($event);
        $extra = [
            'notification.event' => $event,
            'workflow.status' => $status,
        ];
        $fallbackTitle = $this->resolveText($template['title'], $state, $automation, $extra);
        $fallbackMessage = $this->resolveText($template['message'], $state, $automation, $extra);
        $title = $this->resolveText((string) ($config['title'] ?? $template['title']), $state, $automation, $extra);
        $message = $this->resolveText((string) ($config['message'] ?? $template['message']), $state, $automation, $extra);
        $audience = (string) ($config['audience'] ?? match ((string) ($config['notify'] ?? '')) {
            'admins' => 'workspace_admins',
            'all_editors' => 'all_members',
            default => 'automation_owner',
        });
        $includeContext = (bool) ($config['include_context'] ?? true);

        $this->sendAutomationNotification(
            $automation,
            $title !== '' ? $title : $fallbackTitle,
            $message !== '' ? $message : $fallbackMessage,
            $event,
            $state['post_id'] ?? null,
            [
                'priority' => $config['priority'] ?? $template['priority'],
                'channel' => $config['channel'] ?? 'in_app',
                'audience' => $audience,
                'action_label' => $config['action_label'] ?? 'Open automation',
                'context' => $includeContext ? [
                    'node' => $key,
                    'event' => $event,
                    'workflow_status' => $status,
                    'post_id' => $state['post_id'] ?? null,
                    'delay' => data_get($state, 'delay'),
                ] : [],
            ],
        );
    }

    /**
     * @return array{title:string,message:string,priority:string}
     */
    protected function notificationTemplateForEvent(string $event, string $key): array
    {
        return match ($event) {
            'run_started' => [
                'title' => 'Workflow started: {{automation.name}}',
                'message' => '{{automation.name}} started running at {{now}}.',
                'priority' => 'normal',
            ],
            'delay_waiting' => [
                'title' => 'Workflow paused: {{automation.name}}',
                'message' => '{{automation.name}} is waiting for {{delay.duration}} and will resume automatically.',
                'priority' => 'normal',
            ],
            'approval_needed' => [
                'title' => 'Approval needed: {{automation.name}}',
                'message' => '{{automation.name}} created content that needs review before the workflow can continue.',
                'priority' => 'high',
            ],
            'publish_failed', 'failure_alert' => [
                'title' => 'Workflow alert: {{automation.name}}',
                'message' => '{{automation.name}} needs attention at the '.$this->humanNodeName($key).' step.',
                'priority' => 'high',
            ],
            'token_warning' => [
                'title' => 'Account attention needed',
                'message' => 'A connected account used by {{automation.name}} may need reconnection before the next run.',
                'priority' => 'high',
            ],
            'webhook_notification' => [
                'title' => 'Webhook step completed',
                'message' => '{{automation.name}} reached the webhook notification step.',
                'priority' => 'normal',
            ],
            default => [
                'title' => 'Workflow completed: {{automation.name}}',
                'message' => '{{automation.name}} finished successfully. Review the latest output when you are ready.',
                'priority' => 'normal',
            ],
        };
    }

    protected function workflowStatusLabel(string $event): string
    {
        return match ($event) {
            'run_started' => 'Started',
            'delay_waiting' => 'Waiting',
            'approval_needed' => 'Needs approval',
            'publish_failed', 'failure_alert' => 'Needs attention',
            'token_warning' => 'Account warning',
            default => 'Completed',
        };
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $extra
     */
    protected function resolveText(string $value, array $state, ?Automation $automation = null, array $extra = []): string
    {
        $replacements = [
            '{{now}}' => now()->toIso8601String(),
            '{{automation.id}}' => (string) ($automation?->id ?? ''),
            '{{automation.name}}' => (string) ($automation?->name ?? ''),
            '{{caption}}' => (string) ($state['caption'] ?? ''),
            '{{link}}' => (string) ($state['link'] ?? ''),
            '{{rss.title}}' => (string) data_get($state, 'rss.title', ''),
            '{{rss.summary}}' => (string) data_get($state, 'rss.summary', ''),
            '{{rss.link}}' => (string) data_get($state, 'rss.link', ''),
            '{{ai.output}}' => (string) data_get($state, 'ai.output', ''),
            '{{ai.content}}' => (string) data_get($state, 'ai.content', ''),
            '{{post.id}}' => (string) ($state['post_id'] ?? ''),
            '{{delay.duration}}' => (string) data_get($state, 'delay.duration', ''),
            '{{delay.resume_at}}' => (string) data_get($state, 'delay.resume_at', ''),
            '{{workflow.next_run_at}}' => (string) data_get($state, 'workflow.next_run_at', ''),
            '{{workflow.status}}' => (string) ($extra['workflow.status'] ?? ''),
        ];

        foreach ($extra as $key => $replacement) {
            $token = Str::startsWith($key, '{{') ? $key : '{{'.$key.'}}';
            $replacements[$token] = (string) $replacement;
        }

        return trim(strtr($value, $replacements));
    }

    /**
     * @param  array<string, mixed>  $options
     */
    protected function sendAutomationNotification(Automation $automation, string $title, string $message, string $event, ?int $postId = null, array $options = []): void
    {
        $priority = $this->normalizeNotificationPriority((string) ($options['priority'] ?? 'normal'));
        $channel = $this->normalizeNotificationChannel((string) ($options['channel'] ?? 'in_app'));
        $audience = (string) ($options['audience'] ?? 'all_members');
        $actionLabel = isset($options['action_label']) ? trim((string) $options['action_label']) : null;
        $context = is_array($options['context'] ?? null) ? $options['context'] : [];

        $this->notificationRecipients($automation, $audience)->each(function ($user) use ($automation, $title, $message, $event, $postId, $priority, $channel, $actionLabel, $context) {
            $user?->notify(new AutomationWorkflowNotification(
                $automation,
                $title,
                $message,
                $event,
                $postId,
                $priority,
                $channel,
                $actionLabel ?: null,
                "/app/automations/{$automation->id}",
                $context,
            ));
        });
    }

    /**
     * @return Collection<int, mixed>
     */
    protected function notificationRecipients(Automation $automation, string $audience = 'all_members'): Collection
    {
        $members = $automation->workspace?->members ?? collect();
        $admins = $members->filter(fn ($user) => in_array((string) ($user->pivot?->role ?? ''), ['admin', 'owner'], true));

        $recipients = match ($audience) {
            'automation_owner' => collect([$automation->creator, $automation->workspace?->owner]),
            'workspace_admins' => collect([$automation->creator, $automation->workspace?->owner])->merge($admins),
            default => collect([$automation->creator, $automation->workspace?->owner])->merge($members),
        };

        return $recipients->filter()
            ->unique('id')
            ->values();
    }

    protected function normalizeNotificationPriority(string $priority): string
    {
        return in_array($priority, ['low', 'normal', 'high', 'critical'], true) ? $priority : 'normal';
    }

    protected function normalizeNotificationChannel(string $channel): string
    {
        return in_array($channel, ['in_app', 'email', 'both'], true) ? $channel : 'in_app';
    }

    protected function formatSecondsForHumans(int $seconds): string
    {
        if ($seconds < 60) {
            return $seconds.' second'.($seconds === 1 ? '' : 's');
        }

        if ($seconds < 3600) {
            $minutes = (int) ceil($seconds / 60);

            return $minutes.' minute'.($minutes === 1 ? '' : 's');
        }

        if ($seconds < 86400) {
            $hours = (int) ceil($seconds / 3600);

            return $hours.' hour'.($hours === 1 ? '' : 's');
        }

        $days = (int) ceil($seconds / 86400);

        return $days.' day'.($days === 1 ? '' : 's');
    }

    protected function humanNodeName(string $key): string
    {
        return str_replace('_', ' ', Str::after($key, 'publish_'));
    }

    protected function nextRunAt(Automation $automation): Carbon
    {
        $schedule = $this->automationSchedule($automation);
        $cadence = (string) ($schedule['cadence'] ?? 'interval');

        if (in_array($cadence, ['hourly', 'interval'], true)) {
            $minutes = (int) ($schedule['interval_minutes'] ?? data_get($automation->config, 'interval_minutes', 60));

            return now()->addMinutes(max($cadence === 'hourly' ? 15 : 1, $minutes));
        }

        $timezone = $this->scheduleTimezone($automation, (string) ($schedule['timezone'] ?? 'workspace'));
        $now = Carbon::now($timezone);
        [$hour, $minute] = $this->scheduleTimeParts((string) ($schedule['time'] ?? '09:00'));
        $next = $now->copy()->setTime($hour, $minute);

        if ($cadence === 'weekly') {
            $weekday = strtolower((string) ($schedule['weekday'] ?? 'monday'));
            while (strtolower($next->format('l')) !== $weekday || $next->lte($now)) {
                $next->addDay();
            }

            return $next->setTimezone(config('app.timezone', 'UTC'));
        }

        if ($next->lte($now)) {
            $next->addDay();
        }

        return $next->setTimezone(config('app.timezone', 'UTC'));
    }

    /**
     * @return array<string, mixed>
     */
    protected function automationSchedule(Automation $automation): array
    {
        $schedule = data_get($automation->config, 'schedule');
        if (is_array($schedule) && $schedule !== []) {
            return $schedule;
        }

        $nodes = data_get($automation->config, 'workflow.nodes', []);
        if (is_array($nodes)) {
            foreach ($nodes as $node) {
                if (data_get($node, 'data.key') === 'schedule_trigger') {
                    $config = data_get($node, 'data.config', []);
                    if (is_array($config)) {
                        return $config;
                    }
                }
            }
        }

        return [
            'cadence' => 'interval',
            'interval_minutes' => (int) data_get($automation->config, 'interval_minutes', 60),
        ];
    }

    protected function scheduleTimezone(Automation $automation, string $timezone): string
    {
        $resolved = $timezone === 'workspace'
            ? (string) data_get($automation->workspace?->settings, 'timezone', config('app.timezone', 'UTC'))
            : $timezone;

        try {
            new \DateTimeZone($resolved);

            return $resolved;
        } catch (\Throwable) {
            return config('app.timezone', 'UTC');
        }
    }

    /**
     * @return array{0:int,1:int}
     */
    protected function scheduleTimeParts(string $time): array
    {
        if (! preg_match('/^(\d{2}):(\d{2})$/', $time, $matches)) {
            return [9, 0];
        }

        return [
            max(0, min(23, (int) $matches[1])),
            max(0, min(59, (int) $matches[2])),
        ];
    }
}
