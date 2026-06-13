<?php

namespace App\Services\Social\Platforms;

use App\Models\SocialAccount;
use App\Services\Social\AbstractPlatformService;
use App\Services\Social\Data\PublishPayload;
use App\Services\Social\Data\PublishResult;
use Illuminate\Support\Facades\Http;

/**
 * LinkedIn UGC posts for a member profile via the REST Posts API.
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
        $response = Http::withToken($account->access_token)
            ->withHeaders(['X-Restli-Protocol-Version' => '2.0.0', 'LinkedIn-Version' => '202401'])
            ->post('https://api.linkedin.com/rest/posts', [
                'author' => $this->authorUrn($account),
                'commentary' => $payload->content,
                'visibility' => 'PUBLIC',
                'distribution' => ['feedDistribution' => 'MAIN_FEED'],
                'lifecycleState' => 'PUBLISHED',
            ]);

        if (! $response->successful()) {
            return PublishResult::failure($response->json('message') ?? 'LinkedIn API error', $response->json() ?? []);
        }

        $id = (string) $response->header('x-restli-id');

        return PublishResult::success($id, raw: $response->json() ?? []);
    }
}
