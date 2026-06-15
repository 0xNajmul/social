<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

/**
 * Pinterest API v5 board discovery and Pin publishing.
 */
class PinterestService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'pinterest';
    }

    protected function isConfigured(): bool
    {
        $credentials = $this->credentials();

        return ! empty($credentials['client_id']) || ! empty($credentials['access_token']);
    }

    /**
     * Connect every available board as an independently selectable target.
     *
     * @param  array<string, mixed>  $tokenMeta
     * @return array<int, SocialAccount>
     */
    public function connectBoards(
        Workspace $workspace,
        User $user,
        string $accessToken,
        ?string $refreshToken = null,
        ?\DateTimeInterface $expiresAt = null,
        array $tokenMeta = [],
    ): array {
        $profileResponse = Http::withToken($accessToken)
            ->timeout(20)
            ->get($this->apiBase().'/user_account');
        if (! $profileResponse->successful()) {
            throw new \RuntimeException($this->errorMessage($profileResponse, 'Could not load the Pinterest account.'));
        }

        $profile = $profileResponse->json();
        $username = (string) ($profile['username'] ?? '');
        $userId = (string) ($profile['id'] ?? $username);
        if ($userId === '') {
            throw new \RuntimeException('Pinterest returned an incomplete account profile.');
        }

        $boardsResponse = Http::withToken($accessToken)
            ->timeout(20)
            ->get($this->apiBase().'/boards', ['page_size' => 250]);
        if (! $boardsResponse->successful()) {
            throw new \RuntimeException($this->errorMessage($boardsResponse, 'Could not load Pinterest boards.'));
        }

        $boards = $boardsResponse->json('items', []);
        if (empty($boards)) {
            throw new \RuntimeException('No Pinterest boards were returned. Create a board in Pinterest, then reconnect.');
        }

        return collect($boards)->map(function (array $board) use (
            $workspace,
            $user,
            $accessToken,
            $refreshToken,
            $expiresAt,
            $tokenMeta,
            $profile,
            $username,
            $userId,
        ) {
            $boardId = (string) ($board['id'] ?? '');
            if ($boardId === '') {
                return null;
            }

            $boardName = (string) ($board['name'] ?? 'Pinterest Board');

            return SocialAccount::upsertConnection(
                [
                    'workspace_id' => $workspace->id,
                    'platform' => 'pinterest',
                    'provider_account_id' => $boardId,
                ],
                [
                    'connected_by' => $user->id,
                    'name' => $boardName,
                    'username' => $username !== '' ? '@'.$username : null,
                    'avatar_url' => $profile['profile_image'] ?? null,
                    'profile_url' => $username !== '' ? "https://www.pinterest.com/{$username}/" : null,
                    'access_token' => $accessToken,
                    'refresh_token' => $refreshToken,
                    'token_meta' => array_merge($tokenMeta, [
                        'pinterest_user_id' => $userId,
                        'board_id' => $boardId,
                    ]),
                    'token_expires_at' => $expiresAt,
                    'status' => 'active',
                    'status_message' => null,
                    'settings' => [
                        'board_id' => $boardId,
                        'board_name' => $boardName,
                        'board_description' => $board['description'] ?? null,
                        'board_privacy' => $board['privacy'] ?? null,
                        'pinterest_user_id' => $userId,
                        'account_type' => $profile['account_type'] ?? null,
                        'account_type_label' => isset($profile['account_type'])
                            ? ucfirst(strtolower((string) $profile['account_type']))
                            : null,
                    ],
                    'last_synced_at' => now(),
                ],
            );
        })->filter()->values()->all();
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $media = $payload->media[0] ?? null;
        if (! $media instanceof MediaItem) {
            return PublishResult::failure('Pinterest requires one image or video.', retryable: false);
        }

        $boardId = (string) data_get($account->settings, 'board_id', $account->provider_account_id);
        $title = trim((string) data_get($payload->options, 'pinterest_title', ''));
        if ($title === '') {
            $title = trim(strtok(trim($payload->content), "\r\n") ?: 'New Pin');
        }

        $body = array_filter([
            'board_id' => $boardId,
            'title' => mb_substr($title, 0, 100),
            'description' => mb_substr(trim($payload->content), 0, 500),
            'link' => $payload->link,
            'alt_text' => mb_substr((string) data_get($payload->options, 'alt_text', ''), 0, 500),
            'media_source' => $media->isVideo()
                ? ['source_type' => 'video_id', 'media_id' => $this->uploadVideo($account, $media)]
                : $this->imageSource($media),
        ], fn ($value) => $value !== null && $value !== '');

        $response = Http::withToken($account->access_token)
            ->timeout(60)
            ->post($this->apiBase().'/pins', $body);
        if (! $response->successful()) {
            return PublishResult::failure(
                $this->errorMessage($response, 'Pinterest rejected the Pin.'),
                $response->json() ?? [],
                retryable: $response->serverError() || $response->status() === 429,
            );
        }

        $pinId = (string) $response->json('id');
        if ($pinId === '') {
            return PublishResult::failure('Pinterest created the Pin but returned no Pin ID.', $response->json() ?? []);
        }

        return PublishResult::success(
            providerPostId: $pinId,
            permalink: "https://www.pinterest.com/pin/{$pinId}/",
            raw: $response->json() ?? [],
        );
    }

    public function refreshToken(SocialAccount $account): ?AccountProfile
    {
        if (! $account->refresh_token) {
            return null;
        }

        $credentials = $this->credentials();
        $response = Http::withBasicAuth($credentials['client_id'], $credentials['client_secret'])
            ->asForm()
            ->timeout(20)
            ->post($this->apiBase().'/oauth/token', [
                'grant_type' => 'refresh_token',
                'refresh_token' => $account->refresh_token,
            ]);

        $accessToken = $response->successful() ? $response->json('access_token') : null;
        if (! is_string($accessToken) || $accessToken === '') {
            return null;
        }

        $scopes = preg_split('/[\s,]+/', trim((string) $response->json('scope', ''))) ?: [];

        return new AccountProfile(
            providerAccountId: $account->provider_account_id,
            name: $account->name,
            username: $account->username,
            avatarUrl: $account->avatar_url,
            profileUrl: $account->profile_url,
            accessToken: $accessToken,
            refreshToken: $response->json('refresh_token') ?? $account->refresh_token,
            expiresAt: now()->addSeconds((int) $response->json('expires_in', 2592000)),
            tokenMeta: array_filter([
                'scopes' => array_values(array_filter($scopes)),
                'token_type' => $response->json('token_type', 'bearer'),
                'refresh_token_expires_at' => $response->json('refresh_token_expires_at'),
                'refresh_token_expires_in' => $response->json('refresh_token_expires_in'),
                'refreshed_at' => now()->toIso8601String(),
            ], fn ($value) => $value !== null),
        );
    }

    /** @return array<int, string> */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = parent::validatePayload($payload);

        if (count($payload->media) !== 1) {
            $errors[] = 'Pinterest requires exactly one image or one video per Pin.';
        }

        if (isset($payload->media[0])
            && ! $payload->media[0]->isImage()
            && ! $payload->media[0]->isVideo()) {
            $errors[] = 'Pinterest only supports image and video attachments.';
        }

        return array_values(array_unique($errors));
    }

    /** @return array<string, string> */
    protected function imageSource(MediaItem $image): array
    {
        if ($image->url && filter_var($image->url, FILTER_VALIDATE_URL)) {
            return ['source_type' => 'image_url', 'url' => $image->url];
        }

        $path = $image->absolutePath();
        if (! $path || ! is_readable($path)) {
            throw new \RuntimeException('Pinterest image file is missing on the server.');
        }

        return [
            'source_type' => 'image_base64',
            'content_type' => $image->mimeType,
            'data' => base64_encode(file_get_contents($path)),
        ];
    }

    protected function uploadVideo(SocialAccount $account, MediaItem $video): string
    {
        $path = $video->absolutePath();
        if (! $path || ! is_readable($path)) {
            throw new \RuntimeException('Pinterest video file is missing on the server.');
        }

        $registration = Http::withToken($account->access_token)
            ->timeout(30)
            ->post($this->apiBase().'/media', ['media_type' => 'video']);
        if (! $registration->successful()) {
            throw new \RuntimeException($this->errorMessage($registration, 'Pinterest video upload could not be initialized.'));
        }

        $mediaId = (string) $registration->json('media_id');
        $uploadUrl = $registration->json('upload_url');
        $uploadParameters = $registration->json('upload_parameters', []);
        if ($mediaId === '' || ! is_string($uploadUrl) || $uploadUrl === '') {
            throw new \RuntimeException('Pinterest returned an invalid video upload session.');
        }

        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \RuntimeException('Could not read the Pinterest video file.');
        }

        try {
            $upload = Http::asMultipart()
                ->attach('file', $handle, basename($path), ['Content-Type' => $video->mimeType])
                ->timeout(300)
                ->post($uploadUrl, $uploadParameters);
        } finally {
            fclose($handle);
        }

        if (! $upload->successful()) {
            throw new \RuntimeException('Pinterest video upload failed.');
        }

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $statusResponse = Http::withToken($account->access_token)
                ->timeout(20)
                ->get($this->apiBase().'/media/'.$mediaId);
            $status = strtolower((string) $statusResponse->json('status'));

            if ($statusResponse->successful() && in_array($status, ['succeeded', 'success', 'finished'], true)) {
                return $mediaId;
            }
            if (in_array($status, ['failed', 'error'], true)) {
                throw new \RuntimeException($statusResponse->json('failure_reason') ?? 'Pinterest could not process the video.');
            }

            usleep(500_000);
        }

        throw new \RuntimeException('Pinterest video processing did not finish in time.');
    }

    protected function apiBase(): string
    {
        return rtrim((string) data_get($this->credentials(), 'api_base', 'https://api.pinterest.com/v5'), '/');
    }

    protected function errorMessage($response, string $fallback): string
    {
        return (string) ($response->json('message')
            ?? $response->json('error.message')
            ?? $response->json('error_description')
            ?? $fallback);
    }
}
