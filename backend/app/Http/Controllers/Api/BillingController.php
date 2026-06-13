<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Http\Resources\SubscriptionResource;
use App\Models\Plan;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Subscription + billing endpoints. Provider integration (Stripe/Paddle) is
 * abstracted: when no provider keys are present, plan changes are applied
 * directly so the flow is testable. With keys, return a checkout/portal URL.
 */
class BillingController extends Controller
{
    public function __construct(protected ActivityLogger $activity) {}

    public function plans(): JsonResponse
    {
        $plans = Plan::where('is_active', true)->orderBy('sort_order')->orderBy('price_monthly')->get();

        return response()->json(['data' => PlanResource::collection($plans)]);
    }

    public function current(): JsonResponse
    {
        $subscription = workspace()->subscription?->load('plan');

        return response()->json([
            'data' => $subscription ? new SubscriptionResource($subscription) : null,
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageBilling', $workspace);

        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'billing_cycle' => ['required', 'in:monthly,yearly'],
        ]);

        $plan = Plan::findOrFail($data['plan_id']);

        if (config('services.stripe.secret')) {
            // Real flow: create a Stripe Checkout session and return its URL.
            return response()->json([
                'mode' => 'checkout',
                'checkout_url' => $this->createCheckoutUrl($workspace, $plan, $data['billing_cycle']),
            ]);
        }

        // Demo flow: apply the plan change immediately.
        $period = $data['billing_cycle'] === 'yearly' ? now()->addYear() : now()->addMonth();

        $subscription = $workspace->subscription;
        if ($subscription) {
            $subscription->update([
                'plan_id' => $plan->id,
                'billing_cycle' => $data['billing_cycle'],
                'status' => SubscriptionStatus::Active,
                'current_period_start' => now(),
                'current_period_end' => $period,
                'cancel_at_period_end' => false,
            ]);
        } else {
            $subscription = $workspace->subscription()->create([
                'plan_id' => $plan->id,
                'billing_cycle' => $data['billing_cycle'],
                'status' => SubscriptionStatus::Active,
                'current_period_start' => now(),
                'current_period_end' => $period,
            ]);
        }

        $this->activity->log($workspace->id, 'billing.subscribed', $plan, "Subscribed to {$plan->name}");

        return response()->json([
            'mode' => 'demo',
            'data' => new SubscriptionResource($subscription->load('plan')),
        ]);
    }

    public function cancel(): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageBilling', $workspace);

        $workspace->subscription?->update([
            'cancel_at_period_end' => true,
            'canceled_at' => now(),
        ]);

        return response()->json(['message' => 'Subscription will cancel at the end of the period.']);
    }

    protected function createCheckoutUrl($workspace, Plan $plan, string $cycle): string
    {
        // Placeholder for Stripe Checkout session creation.
        return url("/billing/checkout?workspace={$workspace->id}&plan={$plan->slug}&cycle={$cycle}");
    }
}
