<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

class BlueskyService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'bluesky';
    }

    protected function isConfigured(): bool
    {
        return true;
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $pds = $this->pds($account);
        $text = $this->postText($payload);
        $record = [
            '$type' => 'app.bsky.feed.post',
            'text' => $text,
            'createdAt' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];

        $facets = $this->linkFacets($text);
        if ($facets) {
            $record['facets'] = $facets;
        }

        if ($payload->media) {
            $record['embed'] = [
                '$type' => 'app.bsky.embed.images',
                'images' => collect($payload->media)
                    ->values()
                    ->map(fn (MediaItem $image, int $index) => [
                        'alt' => (string) data_get(
                            $payload->options,
                            "image_alt_texts.{$index}",
                            data_get($payload->options, 'alt_text', ''),
                        ),
                        'image' => $this->uploadImage($account, $image),
                    ])
                    ->all(),
            ];
        }

        $response = Http::withToken($account->access_token)
            ->post("{$pds}/xrpc/com.atproto.repo.createRecord", [
                'repo' => $account->provider_account_id,
                'collection' => 'app.bsky.feed.post',
                'record' => $record,
            ]);

        if (! $response->successful()) {
            return PublishResult::failure(
                $response->json('message') ?? 'Bluesky API error.',
                $response->json() ?? [],
                retryable: $response->serverError() || $response->status() === 429,
            );
        }

        $uri = (string) $response->json('uri');
        if ($uri === '') {
            return PublishResult::failure('Bluesky created the post but returned no AT URI.', $response->json() ?? []);
        }

        $rkey = str($uri)->afterLast('/')->toString();
        $handle = ltrim((string) data_get($account->token_meta, 'handle', $account->username), '@');

        return PublishResult::success(
            providerPostId: $uri,
            permalink: "https://bsky.app/profile/{$handle}/post/{$rkey}",
            raw: $response->json() ?? [],
        );
    }

    public function refreshToken(SocialAccount $account): ?AccountProfile
    {
        if (! $account->refresh_token) {
            return null;
        }

        $response = Http::withToken($account->refresh_token)
            ->post($this->pds($account).'/xrpc/com.atproto.server.refreshSession');

        if (! $response->successful() || ! $response->json('accessJwt')) {
            return null;
        }

        $accessJwt = (string) $response->json('accessJwt');
        $handle = (string) $response->json('handle', data_get($account->token_meta, 'handle', $account->username));

        return new AccountProfile(
            providerAccountId: (string) $response->json('did', $account->provider_account_id),
            name: $account->name,
            username: '@'.ltrim($handle, '@'),
            avatarUrl: $account->avatar_url,
            profileUrl: 'https://bsky.app/profile/'.ltrim($handle, '@'),
            accessToken: $accessJwt,
            refreshToken: $response->json('refreshJwt') ?? $account->refresh_token,
            expiresAt: $this->jwtExpiresAt($accessJwt),
            tokenMeta: array_filter([
                'handle' => $handle,
                'email' => $response->json('email', data_get($account->token_meta, 'email')),
            ]),
        );
    }

    /** @return array<int, string> */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = parent::validatePayload($payload);

        if (collect($payload->media)->contains(fn (MediaItem $item) => ! $item->isImage())) {
            $errors[] = 'Bluesky supports image attachments only in this integration.';
        }

        foreach ($payload->media as $image) {
            $path = $image->absolutePath();
            if ($path && is_readable($path) && filesize($path) > 2 * 1024 * 1024) {
                $errors[] = 'Each Bluesky image must be 2 MB or smaller.';
                break;
            }
        }

        if (trim($payload->content) === '' && ! $payload->link && empty($payload->media)) {
            $errors[] = 'Add text, a link, or an image before publishing to Bluesky.';
        }

        return $errors;
    }

    /** @return array<string, mixed> */
    protected function uploadImage(SocialAccount $account, MediaItem $image): array
    {
        $path = $image->absolutePath();
        if (! $path || ! is_readable($path)) {
            throw new \RuntimeException('Bluesky image file is missing on the server.');
        }

        $response = Http::withToken($account->access_token)
            ->withBody(file_get_contents($path), $image->mimeType)
            ->post($this->pds($account).'/xrpc/com.atproto.repo.uploadBlob');

        if (! $response->successful() || ! $response->json('blob')) {
            throw new \RuntimeException($response->json('message') ?? 'Bluesky image upload failed.');
        }

        return $response->json('blob');
    }

    protected function postText(PublishPayload $payload): string
    {
        $content = trim($payload->content);
        $link = trim((string) $payload->link);

        if ($link !== '' && ! str_contains($content, $link)) {
            $separator = $content === '' ? '' : "\n\n";
            $contentLength = max(0, 300 - mb_strlen($separator.$link));

            return mb_substr($content, 0, $contentLength).$separator.$link;
        }

        return mb_substr($content, 0, 300);
    }

    /** @return array<int, array<string, mixed>> */
    protected function linkFacets(string $text): array
    {
        preg_match_all('/https?:\/\/[^\s]+/u', $text, $matches, PREG_OFFSET_CAPTURE);

        return collect($matches[0] ?? [])->map(function (array $match) {
            [$uri, $byteStart] = $match;

            return [
                'index' => [
                    'byteStart' => $byteStart,
                    'byteEnd' => $byteStart + strlen($uri),
                ],
                'features' => [[
                    '$type' => 'app.bsky.richtext.facet#link',
                    'uri' => $uri,
                ]],
            ];
        })->all();
    }

    protected function pds(SocialAccount $account): string
    {
        return rtrim((string) data_get(
            $account->settings,
            'pds_url',
            data_get($this->credentials(), 'pds_url', 'https://bsky.social'),
        ), '/');
    }

    protected function jwtExpiresAt(string $jwt): ?\DateTimeInterface
    {
        $payload = explode('.', $jwt)[1] ?? null;
        if (! $payload) {
            return null;
        }

        $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);
        $expiresAt = $decoded ? data_get(json_decode($decoded, true), 'exp') : null;

        return is_numeric($expiresAt) ? now()->setTimestamp((int) $expiresAt) : null;
    }
}
