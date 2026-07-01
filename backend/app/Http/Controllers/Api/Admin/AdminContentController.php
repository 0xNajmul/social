<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AutomationType;
use App\Enums\MediaType;
use App\Http\Controllers\Controller;
use App\Models\Automation;
use App\Models\MediaAsset;
use App\Models\PlannerNote;
use App\Models\SocialAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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
            'data' => $notes->getCollection()->map(fn (PlannerNote $note) => $this->plannerPayload($note))->values(),
            'meta' => $this->meta($notes),
        ]);
    }

    public function showPlanner(PlannerNote $plannerNote): JsonResponse
    {
        return response()->json([
            'data' => $this->plannerPayload($plannerNote->load(['workspace:id,name,slug', 'author:id,name,email'])),
        ]);
    }

    public function storePlanner(Request $request): JsonResponse
    {
        $data = $request->validate($this->plannerRules(true));
        $contentText = $data['content_text'] ?? strip_tags($data['content_html'] ?? '');

        $note = PlannerNote::create([
            'workspace_id' => $data['workspace_id'],
            'created_by' => $data['created_by'] ?? null,
            'title' => $data['title'],
            'content_html' => $data['content_html'] ?? nl2br($contentText, false),
            'content_text' => $contentText,
            'status' => $data['status'] ?? 'note',
            'meta' => [
                'scheduled_at' => $data['scheduled_at'] ?? null,
                'categories' => $data['categories'] ?? [],
                'tags' => $data['tags'] ?? [],
            ],
        ]);

        return response()->json([
            'data' => $this->plannerPayload($note->load(['workspace:id,name,slug', 'author:id,name,email'])),
            'message' => 'Planner note created.',
        ], 201);
    }

    public function updatePlanner(Request $request, PlannerNote $plannerNote): JsonResponse
    {
        $data = $request->validate($this->plannerRules(false));
        $updates = [];

        foreach (['workspace_id', 'created_by', 'title', 'content_html', 'content_text', 'status'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }

        if (array_key_exists('content_html', $updates) && ! array_key_exists('content_text', $updates)) {
            $updates['content_text'] = strip_tags($updates['content_html']);
        }

        if (array_intersect(['scheduled_at', 'categories', 'tags'], array_keys($data))) {
            $meta = $plannerNote->meta ?? [];
            foreach (['scheduled_at', 'categories', 'tags'] as $field) {
                if (array_key_exists($field, $data)) {
                    $meta[$field] = $data[$field];
                }
            }
            $updates['meta'] = $meta;
        }

        $plannerNote->update($updates);

        return response()->json([
            'data' => $this->plannerPayload($plannerNote->fresh()->load(['workspace:id,name,slug', 'author:id,name,email'])),
            'message' => 'Planner note updated.',
        ]);
    }

    public function destroyPlanner(PlannerNote $plannerNote): JsonResponse
    {
        $plannerNote->delete();

        return response()->json(['message' => 'Planner note deleted.']);
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
            'data' => $assets->getCollection()->map(fn (MediaAsset $asset) => $this->mediaPayload($asset))->values(),
            'meta' => $this->meta($assets),
        ]);
    }

    public function showMedia(MediaAsset $mediaAsset): JsonResponse
    {
        return response()->json([
            'data' => $this->mediaPayload($mediaAsset->load(['workspace:id,name,slug', 'uploader:id,name,email'])),
        ]);
    }

    public function storeMedia(Request $request): JsonResponse
    {
        $data = $request->validate($this->mediaRules(true));
        $asset = MediaAsset::create([
            ...$data,
            'disk' => $data['disk'] ?? 'public',
            'tags' => $data['tags'] ?? [],
            'meta' => $data['meta'] ?? [],
        ]);

        return response()->json([
            'data' => $this->mediaPayload($asset->load(['workspace:id,name,slug', 'uploader:id,name,email'])),
            'message' => 'Media asset created.',
        ], 201);
    }

    public function updateMedia(Request $request, MediaAsset $mediaAsset): JsonResponse
    {
        $data = $request->validate($this->mediaRules(false));
        $mediaAsset->update($data);

        return response()->json([
            'data' => $this->mediaPayload($mediaAsset->fresh()->load(['workspace:id,name,slug', 'uploader:id,name,email'])),
            'message' => 'Media asset updated.',
        ]);
    }

    public function destroyMedia(MediaAsset $mediaAsset): JsonResponse
    {
        $mediaAsset->delete();

        return response()->json(['message' => 'Media asset deleted.']);
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
            'data' => $automations->getCollection()->map(fn (Automation $automation) => $this->automationPayload($automation))->values(),
            'meta' => $this->meta($automations),
        ]);
    }

    public function showAutomation(Automation $automation): JsonResponse
    {
        return response()->json([
            'data' => $this->automationPayload($automation->load(['workspace:id,name,slug', 'creator:id,name,email'])->loadCount('feeds')),
        ]);
    }

    public function storeAutomation(Request $request): JsonResponse
    {
        $data = $request->validate($this->automationRules(true));
        $automation = Automation::create([
            ...$data,
            'social_account_ids' => $data['social_account_ids'] ?? [],
            'config' => $data['config'] ?? [],
            'is_active' => $data['is_active'] ?? true,
            'requires_approval' => $data['requires_approval'] ?? false,
            'use_ai' => $data['use_ai'] ?? false,
            'items_created' => $data['items_created'] ?? 0,
        ]);

        return response()->json([
            'data' => $this->automationPayload($automation->load(['workspace:id,name,slug', 'creator:id,name,email'])->loadCount('feeds')),
            'message' => 'Automation created.',
        ], 201);
    }

    public function updateAutomation(Request $request, Automation $automation): JsonResponse
    {
        $data = $request->validate($this->automationRules(false));
        $automation->update($data);

        return response()->json([
            'data' => $this->automationPayload($automation->fresh()->load(['workspace:id,name,slug', 'creator:id,name,email'])->loadCount('feeds')),
            'message' => 'Automation updated.',
        ]);
    }

    public function destroyAutomation(Automation $automation): JsonResponse
    {
        $automation->delete();

        return response()->json(['message' => 'Automation deleted.']);
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
            'data' => $accounts->getCollection()->map(fn (SocialAccount $account) => $this->accountPayload($account))->values(),
            'meta' => $this->meta($accounts),
        ]);
    }

    public function showAccount(SocialAccount $socialAccount): JsonResponse
    {
        return response()->json([
            'data' => $this->accountPayload($socialAccount->load(['workspace:id,name,slug', 'connector:id,name,email'])),
        ]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $data = $request->validate($this->accountRules($request, true));
        $account = SocialAccount::create([
            ...$data,
            'settings' => $data['settings'] ?? [],
        ]);

        return response()->json([
            'data' => $this->accountPayload($account->load(['workspace:id,name,slug', 'connector:id,name,email'])),
            'message' => 'Social account created.',
        ], 201);
    }

    public function updateAccount(Request $request, SocialAccount $socialAccount): JsonResponse
    {
        $data = $request->validate($this->accountRules($request, false, $socialAccount));
        $socialAccount->update($data);

        return response()->json([
            'data' => $this->accountPayload($socialAccount->fresh()->load(['workspace:id,name,slug', 'connector:id,name,email'])),
            'message' => 'Social account updated.',
        ]);
    }

    public function destroyAccount(SocialAccount $socialAccount): JsonResponse
    {
        $socialAccount->delete();

        return response()->json(['message' => 'Social account deleted.']);
    }

    protected function plannerPayload(PlannerNote $note): array
    {
        return [
            'id' => $note->id,
            'workspace_id' => $note->workspace_id,
            'created_by' => $note->created_by,
            'title' => $note->title,
            'status' => $note->status,
            'content_html' => $note->content_html,
            'content_text' => $note->content_text,
            'excerpt' => Str::limit($note->content_text ?? '', 180),
            'workspace' => $note->workspace,
            'author' => $note->author,
            'scheduled_at' => data_get($note->meta, 'scheduled_at'),
            'categories' => data_get($note->meta, 'categories', []),
            'tags' => data_get($note->meta, 'tags', []),
            'created_at' => $note->created_at,
            'updated_at' => $note->updated_at,
        ];
    }

    protected function mediaPayload(MediaAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'workspace_id' => $asset->workspace_id,
            'uploaded_by' => $asset->uploaded_by,
            'type' => $asset->type instanceof MediaType ? $asset->type->value : $asset->type,
            'disk' => $asset->disk,
            'path' => $asset->path,
            'url' => $asset->url,
            'thumbnail_path' => $asset->thumbnail_path,
            'thumbnail_url' => $asset->thumbnail_url,
            'original_name' => $asset->original_name,
            'mime_type' => $asset->mime_type,
            'size' => $asset->size,
            'width' => $asset->width,
            'height' => $asset->height,
            'duration' => $asset->duration,
            'tags' => $asset->tags ?? [],
            'meta' => $asset->meta ?? [],
            'workspace' => $asset->workspace,
            'uploader' => $asset->uploader,
            'created_at' => $asset->created_at,
            'updated_at' => $asset->updated_at,
        ];
    }

    protected function automationPayload(Automation $automation): array
    {
        return [
            'id' => $automation->id,
            'workspace_id' => $automation->workspace_id,
            'created_by' => $automation->created_by,
            'name' => $automation->name,
            'type' => $automation->type instanceof AutomationType ? $automation->type->value : $automation->type,
            'type_label' => $automation->type instanceof AutomationType ? $automation->type->label() : Str::headline($automation->type),
            'is_active' => $automation->is_active,
            'requires_approval' => $automation->requires_approval,
            'use_ai' => $automation->use_ai,
            'social_account_ids' => $automation->social_account_ids ?? [],
            'social_accounts_count' => count($automation->social_account_ids ?? []),
            'config' => $automation->config ?? [],
            'feeds_count' => $automation->feeds_count ?? $automation->feeds()->count(),
            'items_created' => $automation->items_created,
            'workspace' => $automation->workspace,
            'creator' => $automation->creator,
            'last_run_at' => $automation->last_run_at,
            'next_run_at' => $automation->next_run_at,
            'created_at' => $automation->created_at,
            'updated_at' => $automation->updated_at,
        ];
    }

    protected function accountPayload(SocialAccount $account): array
    {
        return [
            'id' => $account->id,
            'workspace_id' => $account->workspace_id,
            'connected_by' => $account->connected_by,
            'platform' => $account->platform,
            'platform_label' => data_get($account->platformConfig(), 'label', $account->platform),
            'provider_account_id' => $account->provider_account_id,
            'name' => $account->name,
            'username' => $account->username,
            'avatar_url' => $account->avatar_url,
            'profile_url' => $account->profile_url,
            'status' => $account->status,
            'status_message' => $account->status_message,
            'settings' => $account->settings ?? [],
            'workspace' => $account->workspace,
            'connector' => $account->connector,
            'token_expires_at' => $account->token_expires_at,
            'last_synced_at' => $account->last_synced_at,
            'created_at' => $account->created_at,
            'updated_at' => $account->updated_at,
        ];
    }

    protected function plannerRules(bool $creating): array
    {
        return [
            'workspace_id' => [$creating ? 'required' : 'sometimes', 'integer', 'exists:workspaces,id'],
            'created_by' => ['nullable', 'integer', 'exists:users,id'],
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'content_html' => ['nullable', 'string'],
            'content_text' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:50'],
            'scheduled_at' => ['nullable', 'date'],
            'categories' => ['nullable', 'array'],
            'categories.*' => ['string', 'max:80'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:80'],
        ];
    }

    protected function mediaRules(bool $creating): array
    {
        return [
            'workspace_id' => [$creating ? 'required' : 'sometimes', 'integer', 'exists:workspaces,id'],
            'uploaded_by' => ['nullable', 'integer', 'exists:users,id'],
            'type' => [$creating ? 'required' : 'sometimes', Rule::enum(MediaType::class)],
            'disk' => ['nullable', 'string', 'max:50'],
            'path' => [$creating ? 'required' : 'sometimes', 'string', 'max:2048'],
            'thumbnail_path' => ['nullable', 'string', 'max:2048'],
            'original_name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'mime_type' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'size' => ['nullable', 'integer', 'min:0'],
            'width' => ['nullable', 'integer', 'min:0'],
            'height' => ['nullable', 'integer', 'min:0'],
            'duration' => ['nullable', 'integer', 'min:0'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:80'],
            'meta' => ['nullable', 'array'],
        ];
    }

    protected function automationRules(bool $creating): array
    {
        return [
            'workspace_id' => [$creating ? 'required' : 'sometimes', 'integer', 'exists:workspaces,id'],
            'created_by' => ['nullable', 'integer', 'exists:users,id'],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'type' => [$creating ? 'required' : 'sometimes', Rule::enum(AutomationType::class)],
            'is_active' => ['sometimes', 'boolean'],
            'requires_approval' => ['sometimes', 'boolean'],
            'use_ai' => ['sometimes', 'boolean'],
            'social_account_ids' => ['nullable', 'array'],
            'social_account_ids.*' => ['integer', 'exists:social_accounts,id'],
            'config' => ['nullable', 'array'],
            'last_run_at' => ['nullable', 'date'],
            'next_run_at' => ['nullable', 'date'],
            'items_created' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function accountRules(Request $request, bool $creating, ?SocialAccount $account = null): array
    {
        $workspaceId = $request->input('workspace_id', $account?->workspace_id);
        $platform = $request->input('platform', $account?->platform);

        $providerRule = Rule::unique('social_accounts', 'provider_account_id')
            ->where(fn ($query) => $query
                ->where('workspace_id', $workspaceId)
                ->where('platform', $platform));

        if ($account) {
            $providerRule->ignore($account->id);
        }

        return [
            'workspace_id' => [$creating ? 'required' : 'sometimes', 'integer', 'exists:workspaces,id'],
            'connected_by' => ['nullable', 'integer', 'exists:users,id'],
            'platform' => [$creating ? 'required' : 'sometimes', 'string', 'max:50'],
            'provider_account_id' => [$creating ? 'required' : 'sometimes', 'string', 'max:255', $providerRule],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'avatar_url' => ['nullable', 'url', 'max:2048'],
            'profile_url' => ['nullable', 'url', 'max:2048'],
            'status' => ['nullable', Rule::in(['active', 'expired', 'revoked', 'error', 'paused'])],
            'status_message' => ['nullable', 'string', 'max:1000'],
            'settings' => ['nullable', 'array'],
            'token_expires_at' => ['nullable', 'date'],
            'last_synced_at' => ['nullable', 'date'],
        ];
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
