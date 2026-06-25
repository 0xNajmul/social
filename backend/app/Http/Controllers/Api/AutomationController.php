<?php

namespace App\Http\Controllers\Api;

use App\Enums\AutomationType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AutomationResource;
use App\Jobs\ProcessAutomationJob;
use App\Models\Automation;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Enum;

class AutomationController extends Controller
{
    public function __construct(protected UsageGuard $usage) {}

    public function index(): JsonResponse
    {
        $automations = workspace()->automations()->with('feeds')->latest()->get();

        return response()->json(['data' => AutomationResource::collection($automations)]);
    }

    public function show(Automation $automation): JsonResponse
    {
        $this->authorize('view', $automation);

        return response()->json(['data' => new AutomationResource($automation->load('feeds'))]);
    }

    public function store(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->usage->ensure($workspace, 'automations');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'type' => ['nullable', new Enum(AutomationType::class)],
            'social_account_ids' => ['nullable', 'array'],
            'social_account_ids.*' => ['integer', 'exists:social_accounts,id'],
            'config' => ['nullable', 'array'],
            'requires_approval' => ['boolean'],
            'use_ai' => ['boolean'],
            'feed_urls' => ['nullable', 'array'],
            'feed_urls.*' => ['url'],
        ]);
        $config = $data['config'] ?? [];
        if (array_key_exists('description', $data)) {
            $config['description'] = $data['description'];
        }

        $automation = $workspace->automations()->create([
            'created_by' => $request->user()->id,
            'name' => $data['name'],
            'type' => $data['type'] ?? AutomationType::RssFeed,
            'social_account_ids' => $data['social_account_ids'] ?? [],
            'config' => $config,
            'requires_approval' => $data['requires_approval'] ?? false,
            'use_ai' => $data['use_ai'] ?? false,
            'next_run_at' => now()->addMinutes(5),
        ]);

        foreach ($data['feed_urls'] ?? [] as $url) {
            $automation->feeds()->create(['workspace_id' => $workspace->id, 'url' => $url]);
        }

        return response()->json(['data' => new AutomationResource($automation->load('feeds'))], 201);
    }

    public function update(Request $request, Automation $automation): JsonResponse
    {
        $this->authorize('update', $automation);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
            'social_account_ids' => ['sometimes', 'array'],
            'config' => ['nullable', 'array'],
            'requires_approval' => ['boolean'],
            'use_ai' => ['boolean'],
            'feed_urls' => ['nullable', 'array'],
            'feed_urls.*' => ['url'],
        ]);
        $hasFeedUrls = array_key_exists('feed_urls', $data);
        $feedUrls = $data['feed_urls'] ?? [];
        unset($data['feed_urls']);
        $config = $data['config'] ?? ($automation->config ?? []);
        if (array_key_exists('description', $data)) {
            $config['description'] = $data['description'];
        }
        if (array_key_exists('config', $data) || array_key_exists('description', $data)) {
            $data['config'] = $config;
        }
        unset($data['description']);

        $automation->update($data);
        if ($hasFeedUrls) {
            $automation->feeds()->delete();
            foreach ($feedUrls as $url) {
                $automation->feeds()->create(['workspace_id' => $automation->workspace_id, 'url' => $url]);
            }
        }

        return response()->json(['data' => new AutomationResource($automation->fresh()->load('feeds'))]);
    }

    public function destroy(Automation $automation): JsonResponse
    {
        $this->authorize('delete', $automation);
        $automation->delete();

        return response()->json(['message' => 'Automation deleted.']);
    }

    /**
     * Trigger an automation run immediately.
     */
    public function run(Automation $automation): JsonResponse
    {
        $this->authorize('update', $automation);
        ProcessAutomationJob::dispatch($automation->id);

        return response()->json(['message' => 'Automation run queued.']);
    }
}
