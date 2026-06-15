<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SocialAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $needsPermissionReconnect = $this->platform === 'facebook_page'
            && ! data_get($this->token_meta, 'permissions_verified_at');
        $needsInstagramReconnect = $this->platform === 'instagram'
            && ! data_get($this->token_meta, 'permissions_verified_at');
        $hasManagedRefresh = in_array($this->platform, ['bluesky', 'pinterest', 'reddit'], true)
            && ! empty($this->refresh_token);

        return [
            'id' => $this->id,
            'platform' => $this->platform,
            'platform_label' => data_get($this->platformConfig(), 'label', $this->platform),
            'platform_color' => data_get($this->platformConfig(), 'color'),
            'name' => $this->name,
            'username' => $this->username,
            'avatar_url' => $this->avatar_url,
            'profile_url' => $this->profile_url,
            'status' => $this->status,
            'status_message' => $this->status_message,
            'is_expired' => ! $hasManagedRefresh && $this->isExpired(),
            'is_expiring_soon' => ! $hasManagedRefresh && $this->isExpiringSoon(),
            'needs_reconnect' => str_contains($this->name, 'Demo Account')
                || $needsPermissionReconnect
                || $needsInstagramReconnect
                || $this->status === 'error',
            'reconnect_reason' => match (true) {
                $needsPermissionReconnect => 'Facebook publishing permissions have not been verified. Reconnect this Page.',
                $needsInstagramReconnect => 'Instagram publishing permissions have not been verified. Reconnect this account.',
                default => $this->status_message,
            },
            'account_type' => data_get($this->settings, 'account_type_label'),
            'creator_info' => $this->platform === 'tiktok' ? data_get($this->settings, 'creator_info') : null,
            'reddit_communities' => $this->platform === 'reddit' ? data_get($this->settings, 'communities', []) : null,
            'reddit_default_subreddit' => $this->platform === 'reddit' ? data_get($this->settings, 'default_subreddit') : null,
            'reddit_communities_synced_at' => $this->platform === 'reddit' ? data_get($this->settings, 'communities_synced_at') : null,
            'token_expires_at' => $this->token_expires_at,
            'last_synced_at' => $this->last_synced_at,
            'created_at' => $this->created_at,
        ];
    }
}
