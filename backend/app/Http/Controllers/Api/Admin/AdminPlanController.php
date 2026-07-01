<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

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
        $data = $this->validateData($request);
        $slug = Str::slug($data['name']);
        abort_if(Plan::where('slug', $slug)->exists(), 422, 'A plan with this name already exists.');
        $plan = Plan::create($data + ['slug' => $slug]);

        return response()->json(['data' => new PlanResource($plan)], 201);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $plan->update($this->validateData($request, $plan));

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
    protected function validateData(Request $request, ?Plan $plan = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('plans', 'name')->ignore($plan?->id)],
            'description' => ['nullable', 'string'],
            'price_monthly' => ['required', 'integer', 'min:0'],
            'price_yearly' => ['required', 'integer', 'min:0'],
            'price_lifetime' => ['integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'trial_days' => ['integer', 'min:0'],
            'lifetime_enabled' => ['boolean'],
            'preferred_payment_provider' => ['nullable', Rule::in(['default', 'manual', 'stripe', 'dodo', 'creem'])],
            'dodo_monthly_product_id' => ['nullable', 'string', 'max:255'],
            'dodo_yearly_product_id' => ['nullable', 'string', 'max:255'],
            'dodo_lifetime_product_id' => ['nullable', 'string', 'max:255'],
            'creem_monthly_product_id' => ['nullable', 'string', 'max:255'],
            'creem_yearly_product_id' => ['nullable', 'string', 'max:255'],
            'creem_lifetime_product_id' => ['nullable', 'string', 'max:255'],
            'checkout_success_url' => ['nullable', 'string', 'max:2048'],
            'checkout_cancel_url' => ['nullable', 'string', 'max:2048'],
            'payment_meta' => ['nullable', 'array'],
            'max_workspaces' => ['integer', 'min:-1'],
            'max_team_members' => ['integer', 'min:-1'],
            'max_social_accounts' => ['integer', 'min:-1'],
            'max_scheduled_posts' => ['integer', 'min:-1'],
            'max_monthly_posts' => ['integer', 'min:-1'],
            'max_automations' => ['integer', 'min:-1'],
            'max_ai_credits' => ['integer', 'min:-1'],
            'max_storage_mb' => ['integer', 'min:0'],
            'features' => ['nullable', 'array'],
            'is_active' => ['boolean'],
            'is_featured' => ['boolean'],
            'sort_order' => ['integer'],
        ]);
    }
}
