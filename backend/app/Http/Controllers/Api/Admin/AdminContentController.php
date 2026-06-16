<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Automation;
use App\Models\MediaAsset;
use App\Models\PlannerNote;
use App\Models\SocialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminContentController extends Controller
{
    public function planners(Request $request): JsonResponse
    {
        $notes = PlannerNote::query()
            ->with(['workspace:id,name,slug', 'author:id,name,email'])
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', "%{$search}%")
                ->orWhere('content_text', 'like', "%{$search}%")))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $notes->getCollection()->map(fn (PlannerNote $note) => [
                'id' => $note->id,
                'title' => $note->title,
                'status' => $note->status,
                'excerpt' => Str::limit($note->content_text ?? '', 180),
                'workspace' => $note->workspace,
                'author' => $note->author,
                'scheduled_at' => data_get($note->meta, 'scheduled_at'),
                'categories' => data_get($note->meta, 'categories', []),
                'tags' => data_get($note->meta, 'tags', []),
                'created_at' => $note->created_at,
                'updated_at' => $note->updated_at,
            ])->values(),
            'meta' => $this->meta($notes),
        ]);
    }

    public function media(Request $request): JsonResponse
    {
        $assets = MediaAsset::query()
            ->with(['workspace:id,name,slug', 'uploader:id,name,email'])
            ->when($request->search, fn ($query, $search) => $query->where('original_name', 'like', "%{$search}%"))
            ->when($request->type, fn ($query, $type) => $query->where('type', $type))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $assets->getCollection()->map(fn (MediaAsset $asset) => [
                'id' => $asset->id,
                'type' => $asset->type->value,
                'url' => $asset->url,
                'thumbnail_url' => $asset->thumbnail_url,
                'original_name' => $asset->original_name,
                'mime_type' => $asset->mime_type,
                'size' => $asset->size,
                'width' => $asset->width,
                'height' => $asset->height,
                'workspace' => $asset->workspace,
                'uploader' => $asset->uploader,
                'created_at' => $asset->created_at,
            ])->values(),
            'meta' => $this->meta($assets),
        ]);
    }

    public function automations(Request $request): JsonResponse
    {
        $automations = Automation::query()
            ->with(['workspace:id,name,slug', 'creator:id,name,email'])
            ->withCount('feeds')
            ->when($request->search, fn ($query, $search) => $query->where('name', 'like', "%{$search}%"))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $automations->getCollection()->map(fn (Automation $automation) => [
                'id' => $automation->id,
                'name' => $automation->name,
                'type' => $automation->type->value,
                'type_label' => $automation->type->label(),
                'is_active' => $automation->is_active,
                'requires_approval' => $automation->requires_approval,
                'use_ai' => $automation->use_ai,
                'social_accounts_count' => count($automation->social_account_ids ?? []),
                'feeds_count' => $automation->feeds_count,
                'items_created' => $automation->items_created,
                'workspace' => $automation->workspace,
                'creator' => $automation->creator,
                'last_run_at' => $automation->last_run_at,
                'next_run_at' => $automation->next_run_at,
                'created_at' => $automation->created_at,
            ])->values(),
            'meta' => $this->meta($automations),
        ]);
    }

    public function accounts(Request $request): JsonResponse
    {
        $accounts = SocialAccount::query()
            ->with(['workspace:id,name,slug', 'connector:id,name,email'])
            ->when($request->search, fn ($query, $search) => $query->where(fn ($inner) => $inner
                ->where('name', 'like', "%{$search}%")
                ->orWhere('username', 'like', "%{$search}%")
                ->orWhere('platform', 'like', "%{$search}%")))
            ->when($request->status, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $accounts->getCollection()->map(fn (SocialAccount $account) => [
                'id' => $account->id,
                'platform' => $account->platform,
                'platform_label' => data_get($account->platformConfig(), 'label', $account->platform),
                'name' => $account->name,
                'username' => $account->username,
                'avatar_url' => $account->avatar_url,
                'status' => $account->status,
                'status_message' => $account->status_message,
                'workspace' => $account->workspace,
                'connector' => $account->connector,
                'token_expires_at' => $account->token_expires_at,
                'last_synced_at' => $account->last_synced_at,
                'created_at' => $account->created_at,
            ])->values(),
            'meta' => $this->meta($accounts),
        ]);
    }

    protected function meta($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
