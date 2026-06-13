<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminPlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => PlanResource::collection(Plan::withCount('subscriptions')->orderBy('sort_order')->get()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $plan = Plan::create($this->validateData($request) + ['slug' => Str::slug($request->name)]);

        return response()->json(['data' => new PlanResource($plan)], 201);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $plan->update($this->validateData($request));

        return response()->json(['data' => new PlanResource($plan)]);
    }

    public function destroy(Plan $plan): JsonResponse
    {
        abort_if($plan->subscriptions()->exists(), 422, 'Cannot delete a plan with active subscriptions.');
        $plan->delete();

        return response()->json(['message' => 'Plan deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validateData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price_monthly' => ['required', 'integer', 'min:0'],
            'price_yearly' => ['required', 'integer', 'min:0'],
            'trial_days' => ['integer', 'min:0'],
            'max_workspaces' => ['integer'],
            'max_team_members' => ['integer'],
            'max_social_accounts' => ['integer'],
            'max_scheduled_posts' => ['integer'],
            'max_monthly_posts' => ['integer'],
            'max_automations' => ['integer'],
            'max_ai_credits' => ['integer'],
            'max_storage_mb' => ['integer'],
            'features' => ['nullable', 'array'],
            'is_active' => ['boolean'],
            'is_featured' => ['boolean'],
            'sort_order' => ['integer'],
        ]);
    }
}
