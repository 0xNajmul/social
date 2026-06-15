<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Reddit submit API (self / link posts to a subreddit).
 */
class RedditService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'reddit';
    }

    protected function isConfigured(): bool
    {
        $credentials = $this->credentials();

        return ! empty($credentials['client_id']) && ! empty($credentials['client_secret']);
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $kind = (string) data_get($payload->options, 'reddit_post_type', 'self');
        $subreddit = $this->normaliseSubreddit((string) data_get($payload->options, 'subreddit', ''));
        $title = trim((string) data_get($payload->options, 'reddit_title', ''));

        $body = [
            'api_type' => 'json',
            'kind' => $kind,
            'sr' => $subreddit,
            'title' => $title,
            'sendreplies' => (bool) data_get($payload->options, 'sendreplies', true),
            'nsfw' => (bool) data_get($payload->options, 'nsfw', false),
            'spoiler' => (bool) data_get($payload->options, 'spoiler', false),
            'resubmit' => (bool) data_get($payload->options, 'resubmit', true),
            'raw_json' => 1,
        ];

        if ($flairId = data_get($payload->options, 'flair_id')) {
            $body['flair_id'] = $flairId;
        }
        if ($flairText = data_get($payload->options, 'flair_text')) {
            $body['flair_text'] = $flairText;
        }

        if ($kind === 'self') {
            $body['text'] = $payload->content;
        } elseif ($kind === 'image') {
            $body['url'] = $this->absoluteMediaUrl($payload->media[0]->url ?? null);
        } else {
            $body['url'] = data_get($payload->options, 'reddit_url', $payload->link);
        }

        $response = $this->request($account, 'post', '/api/submit', $body, asForm: true);
        $errors = $response->json('json.errors', []);

        if (! $response->successful() || $errors) {
            return $this->failureFromResponse($response, 'Reddit rejected the submission.');
        }

        $id = (string) ($response->json('json.data.name') ?: $response->json('json.data.id'));
        if ($id === '') {
            return PublishResult::failure('Reddit did not return a post ID.', $response->json() ?? [], retryable: false);
        }

        if (! str_starts_with($id, 't3_')) {
            $id = 't3_'.$id;
        }

        $permalink = $response->json('json.data.url');
        if (is_string($permalink) && str_starts_with($permalink, '/')) {
            $permalink = 'https://www.reddit.com'.$permalink;
        }

        return PublishResult::success(
            providerPostId: $id,
            permalink: is_string($permalink) ? $permalink : null,
            raw: $response->json() ?? [],
        );
    }

    public function refreshToken(SocialAccount $account): ?AccountProfile
    {
        if (! $account->refresh_token || ! $this->isConfigured()) {
            return null;
        }

        $credentials = $this->credentials();
        $response = Http::withBasicAuth($credentials['client_id'], $credentials['client_secret'])
            ->withHeaders(['User-Agent' => $this->userAgent()])
            ->asForm()
            ->timeout(20)
            ->post('https://www.reddit.com/api/v1/access_token', [
                'grant_type' => 'refresh_token',
                'refresh_token' => $account->refresh_token,
            ]);

        $accessToken = $response->successful() ? $response->json('access_token') : null;
        if (! is_string($accessToken) || $accessToken === '') {
            return null;
        }

        return new AccountProfile(
            providerAccountId: $account->provider_account_id,
            name: $account->name,
            username: $account->username,
            avatarUrl: $account->avatar_url,
            profileUrl: $account->profile_url,
            accessToken: $accessToken,
            refreshToken: $account->refresh_token,
            expiresAt: now()->addSeconds((int) $response->json('expires_in', 3600)),
            tokenMeta: array_merge($account->token_meta ?? [], [
                'scope' => $response->json('scope') ?? data_get($account->token_meta, 'scope'),
                'token_type' => $response->json('token_type', 'bearer'),
                'refreshed_at' => now()->toIso8601String(),
            ]),
        );
    }

    /** @return array<int, array<string, mixed>> */
    public function syncCommunities(SocialAccount $account): array
    {
        $account = $this->ensureFreshToken($account);
        $communities = collect(['subscriber', 'moderator'])
            ->flatMap(function (string $type) use ($account) {
                $response = $this->request($account, 'get', "/subreddits/mine/{$type}", [
                    'limit' => 100,
                    'raw_json' => 1,
                ]);

                if (! $response->successful()) {
                    throw new \RuntimeException($this->errorMessage($response, 'Could not load Reddit communities.'));
                }

                return collect($response->json('data.children', []))->map(function (array $child) use ($type) {
                    $data = $child['data'] ?? [];
                    $name = (string) ($data['display_name'] ?? '');

                    return $name === '' ? null : [
                        'name' => $name,
                        'title' => $data['title'] ?? $name,
                        'icon_url' => $data['community_icon'] ?? $data['icon_img'] ?? null,
                        'over_18' => (bool) ($data['over18'] ?? false),
                        'submission_type' => $data['submission_type'] ?? 'any',
                        'relationship' => $type,
                    ];
                })->filter();
            })
            ->unique('name')
            ->sortBy(fn (array $community) => strtolower($community['name']))
            ->values()
            ->all();

        $settings = $account->settings ?? [];
        $account->update([
            'settings' => array_merge($settings, [
                'communities' => $communities,
                'communities_synced_at' => now()->toIso8601String(),
                'default_subreddit' => data_get($settings, 'default_subreddit', data_get($communities, '0.name')),
            ]),
            'last_synced_at' => now(),
        ]);

        return $communities;
    }

    public function delete(SocialAccount $account, string $providerPostId): bool
    {
        if (! $this->isConfigured()) {
            return parent::delete($account, $providerPostId);
        }

        $account = $this->ensureFreshToken($account);
        $id = str_starts_with($providerPostId, 't3_') ? $providerPostId : 't3_'.$providerPostId;
        $response = $this->request($account, 'post', '/api/del', ['id' => $id], asForm: true);

        return $response->successful();
    }

    /** @return array<string, int> */
    public function fetchMetrics(SocialAccount $account, string $providerPostId): array
    {
        if (! $this->isConfigured()) {
            return parent::fetchMetrics($account, $providerPostId);
        }

        $account = $this->ensureFreshToken($account);
        $id = str_starts_with($providerPostId, 't3_') ? $providerPostId : 't3_'.$providerPostId;
        $response = $this->request($account, 'get', '/by_id/'.$id, ['raw_json' => 1]);
        $post = $response->successful() ? $response->json('data.children.0.data') : null;

        if (! is_array($post)) {
            return [];
        }

        return [
            'likes' => max(0, (int) ($post['score'] ?? 0)),
            'comments' => max(0, (int) ($post['num_comments'] ?? 0)),
            'shares' => 0,
            'views' => 0,
            'clicks' => 0,
            'impressions' => 0,
        ];
    }

    /** @return array<int, string> */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = parent::validatePayload($payload);
        $subreddit = $this->normaliseSubreddit((string) data_get($payload->options, 'subreddit', ''));
        $title = trim((string) data_get($payload->options, 'reddit_title', ''));
        $kind = (string) data_get($payload->options, 'reddit_post_type', 'self');

        if ($subreddit === '' || ! preg_match('/^[A-Za-z0-9_]{2,32}$/', $subreddit)) {
            $errors[] = 'Choose a valid subreddit.';
        }
        if ($title === '' || mb_strlen($title) > 300) {
            $errors[] = 'Reddit requires a title between 1 and 300 characters.';
        }
        if (! in_array($kind, ['self', 'link', 'image'], true)) {
            $errors[] = 'Reddit post type must be text, link, or image.';
        }
        if ($kind === 'link') {
            $url = data_get($payload->options, 'reddit_url', $payload->link);
            if (! is_string($url) || ! filter_var($url, FILTER_VALIDATE_URL)) {
                $errors[] = 'Reddit link posts require a valid URL.';
            }
        }
        if ($kind === 'image') {
            if (count($payload->media) !== 1 || ! $payload->media[0]->isImage()) {
                $errors[] = 'Reddit image posts require exactly one image.';
            } elseif (! $payload->media[0]->url) {
                $errors[] = 'The Reddit image needs a public URL.';
            }
        }

        return array_values(array_unique($errors));
    }

    protected function ensureFreshToken(SocialAccount $account): SocialAccount
    {
        if (! $this->shouldRefreshToken($account)) {
            return $account;
        }

        $profile = $this->refreshToken($account);
        if (! $profile?->accessToken) {
            throw new \RuntimeException('The Reddit access token expired. Reconnect the account.');
        }

        $account->update([
            'access_token' => $profile->accessToken,
            'refresh_token' => $profile->refreshToken ?? $account->refresh_token,
            'token_meta' => $profile->tokenMeta,
            'token_expires_at' => $profile->expiresAt,
            'status' => 'active',
            'status_message' => null,
        ]);

        return $account->refresh();
    }

    protected function shouldRefreshToken(SocialAccount $account): bool
    {
        return $account->isExpired()
            || ($account->token_expires_at && $account->token_expires_at->lte(now()->addMinutes(5)));
    }

    protected function request(
        SocialAccount $account,
        string $method,
        string $path,
        array $data = [],
        bool $asForm = false,
    ): Response {
        $request = Http::withToken($account->access_token)
            ->withHeaders(['User-Agent' => $this->userAgent()])
            ->timeout(25);

        if ($asForm) {
            $request = $request->asForm();
        }

        return $request->{$method}($this->apiBase().$path, $data);
    }

    protected function failureFromResponse(Response $response, string $fallback): PublishResult
    {
        $errors = collect($response->json('json.errors', []))
            ->map(fn ($error) => is_array($error) ? implode(': ', array_filter($error)) : (string) $error)
            ->filter()
            ->implode(' ');
        $message = $errors ?: $this->errorMessage($response, $fallback);
        $retryable = $response->status() === 429 || $response->serverError() || str_contains(strtoupper($message), 'RATELIMIT');

        return PublishResult::failure($message, $response->json() ?? [], $retryable);
    }

    protected function errorMessage(Response $response, string $fallback): string
    {
        return (string) ($response->json('message')
            ?? $response->json('error_description')
            ?? $response->json('error')
            ?? $fallback);
    }

    protected function apiBase(): string
    {
        return (string) ($this->credentials()['api_base'] ?? 'https://oauth.reddit.com');
    }

    protected function userAgent(): string
    {
        return (string) ($this->credentials()['user_agent'] ?? 'web:postflow.social-automation:v1.0.0 (by /u/your_reddit_username)');
    }

    protected function normaliseSubreddit(string $subreddit): string
    {
        return preg_replace('#^(?:https?://(?:www\.)?reddit\.com)?/?r/#i', '', trim($subreddit)) ?? '';
    }

    protected function absoluteMediaUrl(?string $url): ?string
    {
        if (! $url || preg_match('#^https?://#i', $url)) {
            return $url;
        }

        return rtrim((string) config('app.url'), '/').'/'.ltrim($url, '/');
    }
}
