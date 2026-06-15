<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\AccountProfile;
use App\Services\Social\Data\MediaItem;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * LinkedIn member posts through the versioned REST Posts API.
 */
class LinkedInProfileService extends AbstractPlatformService
{
    public function key(): string
    {
        return 'linkedin_profile';
    }

    protected function authorUrn(SocialAccount $account): string
    {
        return 'urn:li:person:'.$account->provider_account_id;
    }

    protected function publishToPlatform(SocialAccount $account, PublishPayload $payload): PublishResult
    {
        $authorUrn = $this->authorUrn($account);
        $commentary = trim($payload->content);
        if ($payload->link && ! str_contains($commentary, $payload->link)) {
            $commentary = trim($commentary."\n\n".$payload->link);
        }

        $post = [
            'author' => $authorUrn,
            'commentary' => $commentary,
            'visibility' => 'PUBLIC',
            'distribution' => ['feedDistribution' => 'MAIN_FEED'],
            'lifecycleState' => 'PUBLISHED',
            'isReshareDisabledByAuthor' => false,
        ];

        /** @var MediaItem|null $media */
        $media = collect($payload->media)->first();
        if ($media) {
            $mediaUrn = $media->isVideo()
                ? $this->uploadVideo($account, $media, $authorUrn)
                : $this->uploadImage($account, $media, $authorUrn);

            $post['content'] = ['media' => ['id' => $mediaUrn]];
        }

        $response = $this->request($account)->post('https://api.linkedin.com/rest/posts', $post);

        if (! $response->successful()) {
            return PublishResult::failure(
                $response->json('message') ?? 'LinkedIn API error.',
                $response->json() ?? [],
                retryable: $response->serverError() || $response->status() === 429,
            );
        }

        $id = (string) $response->header('x-restli-id');
        if ($id === '') {
            return PublishResult::failure('LinkedIn created the post but returned no post ID.', $response->json() ?? []);
        }

        return PublishResult::success(
            providerPostId: $id,
            permalink: "https://www.linkedin.com/feed/update/{$id}/",
            raw: $response->json() ?? [],
        );
    }

    public function refreshToken(SocialAccount $account): ?AccountProfile
    {
        if (! $account->refresh_token) {
            return null;
        }

        $credentials = $this->credentials();
        $response = Http::asForm()->post('https://www.linkedin.com/oauth/v2/accessToken', [
            'grant_type' => 'refresh_token',
            'refresh_token' => $account->refresh_token,
            'client_id' => $credentials['client_id'] ?? null,
            'client_secret' => $credentials['client_secret'] ?? null,
        ]);

        if (! $response->successful() || ! $response->json('access_token')) {
            return null;
        }

        return new AccountProfile(
            providerAccountId: $account->provider_account_id,
            name: $account->name,
            username: $account->username,
            avatarUrl: $account->avatar_url,
            profileUrl: $account->profile_url,
            accessToken: $response->json('access_token'),
            refreshToken: $response->json('refresh_token') ?? $account->refresh_token,
            expiresAt: isset($response['expires_in']) ? now()->addSeconds((int) $response['expires_in']) : null,
            tokenMeta: array_filter([
                'scope' => $response->json('scope'),
                'refresh_token_expires_in' => $response->json('refresh_token_expires_in'),
            ], fn ($value) => $value !== null),
        );
    }

    /** @return array<int, string> */
    public function validatePayload(PublishPayload $payload): array
    {
        $errors = parent::validatePayload($payload);

        if (count($payload->media) > 1) {
            $errors[] = "{$this->label()} currently supports one image or one video per post.";
        }

        if (collect($payload->media)->contains(fn (MediaItem $item) => ! $item->isImage() && ! $item->isVideo())) {
            $errors[] = "{$this->label()} only supports image and video uploads.";
        }

        if (trim($payload->content) === '' && ! $payload->link && empty($payload->media)) {
            $errors[] = 'Add text, a link, an image, or a video before publishing to LinkedIn.';
        }

        return $errors;
    }

    protected function uploadImage(SocialAccount $account, MediaItem $media, string $ownerUrn): string
    {
        $path = $media->absolutePath();
        if (! $path || ! is_readable($path)) {
            throw new \RuntimeException('LinkedIn image file is missing on the server.');
        }

        $initialize = $this->request($account)->post('https://api.linkedin.com/rest/images?action=initializeUpload', [
            'initializeUploadRequest' => ['owner' => $ownerUrn],
        ]);
        if (! $initialize->successful()) {
            throw new \RuntimeException($initialize->json('message') ?? 'LinkedIn image upload could not be initialized.');
        }

        $uploadUrl = $initialize->json('value.uploadUrl');
        $imageUrn = $initialize->json('value.image');
        if (! $uploadUrl || ! $imageUrn) {
            throw new \RuntimeException('LinkedIn returned an invalid image upload session.');
        }

        $upload = Http::withBody(file_get_contents($path), $media->mimeType)->put($uploadUrl);
        if (! $upload->successful()) {
            throw new \RuntimeException('LinkedIn image upload failed.');
        }

        return (string) $imageUrn;
    }

    protected function uploadVideo(SocialAccount $account, MediaItem $media, string $ownerUrn): string
    {
        $path = $media->absolutePath();
        if (! $path || ! is_readable($path)) {
            throw new \RuntimeException('LinkedIn video file is missing on the server.');
        }

        $fileSize = filesize($path);
        if ($fileSize === false || $fileSize < 1) {
            throw new \RuntimeException('LinkedIn video file is empty.');
        }

        $initialize = $this->request($account)->post('https://api.linkedin.com/rest/videos?action=initializeUpload', [
            'initializeUploadRequest' => [
                'owner' => $ownerUrn,
                'fileSizeBytes' => $fileSize,
                'uploadCaptions' => false,
                'uploadThumbnail' => false,
            ],
        ]);
        if (! $initialize->successful()) {
            throw new \RuntimeException($initialize->json('message') ?? 'LinkedIn video upload could not be initialized.');
        }

        $videoUrn = $initialize->json('value.video');
        $uploadToken = (string) $initialize->json('value.uploadToken', '');
        $instructions = $initialize->json('value.uploadInstructions', []);
        if (! $videoUrn || empty($instructions)) {
            throw new \RuntimeException('LinkedIn returned an invalid video upload session.');
        }

        $partIds = [];
        foreach ($instructions as $instruction) {
            $firstByte = (int) ($instruction['firstByte'] ?? 0);
            $lastByte = (int) ($instruction['lastByte'] ?? -1);
            $length = $lastByte - $firstByte + 1;
            $uploadUrl = $instruction['uploadUrl'] ?? null;
            if (! $uploadUrl || $length < 1) {
                throw new \RuntimeException('LinkedIn returned invalid video upload instructions.');
            }

            $chunk = file_get_contents($path, false, null, $firstByte, $length);
            if ($chunk === false) {
                throw new \RuntimeException('Could not read the LinkedIn video upload chunk.');
            }

            $upload = Http::withBody($chunk, 'application/octet-stream')->put($uploadUrl);
            if (! $upload->successful()) {
                throw new \RuntimeException('LinkedIn video upload failed.');
            }

            $partId = $upload->header('ETag');
            if (! $partId) {
                throw new \RuntimeException('LinkedIn video upload returned no part identifier.');
            }
            $partIds[] = trim($partId, '"');
        }

        $finalize = $this->request($account)->post('https://api.linkedin.com/rest/videos?action=finalizeUpload', [
            'finalizeUploadRequest' => [
                'video' => $videoUrn,
                'uploadToken' => $uploadToken,
                'uploadedPartIds' => $partIds,
            ],
        ]);
        if (! $finalize->successful()) {
            throw new \RuntimeException($finalize->json('message') ?? 'LinkedIn video upload could not be finalized.');
        }

        return (string) $videoUrn;
    }

    protected function request(SocialAccount $account): PendingRequest
    {
        $credentials = $this->credentials();

        return Http::withToken($account->access_token)
            ->withHeaders([
                'X-Restli-Protocol-Version' => '2.0.0',
                'LinkedIn-Version' => (string) ($credentials['version'] ?? '202606'),
            ]);
    }
}
