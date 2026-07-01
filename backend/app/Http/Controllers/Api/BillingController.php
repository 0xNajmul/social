<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PlanResource;
use App\Http\Resources\SubscriptionResource;
use App\Http\Resources\WorkspaceResource;
use App\Models\PlatformSetting;
use App\Models\Plan;
use App\Models\Workspace;
use App\Services\ActivityLogger;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Subscription + billing endpoints. Provider integration (Stripe/Paddle) is
 * abstracted: when no provider keys are present, plan changes are applied
 * directly so the flow is testable. With keys, return a checkout/portal URL.
 */
class BillingController extends Controller
{
    public function __construct(
        protected ActivityLogger $activity,
        protected UsageGuard $usage,
    ) {}

    public function plans(): JsonResponse
    {
        $plans = Plan::where('is_active', true)->orderBy('sort_order')->orderBy('price_monthly')->get();

        return response()->json(['data' => PlanResource::collection($plans)]);
    }

    public function webhook(Request $request, string $provider): JsonResponse
    {
        abort_unless(in_array($provider, ['dodo', 'creem'], true), 404);

        $payments = PlatformSetting::valueFor('payments', []);
        $payments = is_array($payments) ? $payments : [];
        $secret = (string) ($payments["{$provider}_webhook_secret"] ?? config("services.{$provider}.webhook_secret") ?? '');

        if ($secret !== '') {
            $candidate = (string) (
                $request->header('X-Postflow-Webhook-Secret')
                ?: $request->query('secret')
                ?: $request->input('secret')
                ?: ''
            );
            abort_unless($candidate !== '' && hash_equals($secret, $candidate), 401, 'Invalid webhook secret.');
        }

        $payload = $request->all();
        $metadata = $this->payloadMetadata($payload);

        if (! $this->isPaidWebhookEvent($payload)) {
            return response()->json(['message' => 'Webhook accepted but no paid event was detected.']);
        }

        $workspace = Workspace::find((int) ($metadata['workspace_id'] ?? 0));
        $plan = Plan::find((int) ($metadata['plan_id'] ?? 0));
        $cycle = (string) ($metadata['billing_cycle'] ?? 'monthly');
        abort_unless($workspace && $plan, 422, 'Webhook metadata is missing workspace_id or plan_id.');
        abort_unless(in_array($cycle, ['monthly', 'yearly', 'lifetime'], true), 422, 'Webhook metadata has an invalid billing cycle.');
        abort_if($cycle === 'lifetime' && ! $plan->lifetime_enabled, 422, 'This plan does not offer a lifetime deal.');

        $period = match ($cycle) {
            'lifetime' => null,
            'yearly' => now()->addYear(),
            default => now()->addMonth(),
        };

        $subscription = null;
        Workspace::where('owner_id', $workspace->owner_id)
            ->with('subscription')
            ->get()
            ->each(function (Workspace $ownedWorkspace) use (&$subscription, $plan, $cycle, $provider, $period, $payload): void {
                $attributes = [
                    'plan_id' => $plan->id,
                    'billing_cycle' => $cycle,
                    'provider' => $provider,
                    'provider_subscription_id' => $this->providerReference($payload, ['subscription_id', 'data.subscription_id', 'data.object.subscription_id', 'subscription.id', 'data.subscription.id', 'checkout_id', 'data.checkout_id', 'id']),
                    'provider_customer_id' => $this->providerReference($payload, ['customer_id', 'data.customer_id', 'data.object.customer_id', 'customer.id', 'data.customer.id']),
                    'status' => SubscriptionStatus::Active,
                    'current_period_start' => now(),
                    'current_period_end' => $period,
                    'cancel_at_period_end' => false,
                    'meta' => [
                        'webhook_provider' => $provider,
                        'webhook_event' => $this->webhookEventName($payload),
                        'webhook_status' => $this->webhookStatus($payload),
                        'webhook_received_at' => now()->toIso8601String(),
                    ],
                ];

                $subscription = $ownedWorkspace->subscription;
                if ($subscription) {
                    $subscription->update($attributes);
                } else {
                    $subscription = $ownedWorkspace->subscription()->create($attributes);
                }
            });

        $this->activity->log($workspace->id, 'billing.webhook_subscribed', $plan, "Activated {$plan->name} from {$provider} webhook");

        return response()->json([
            'message' => 'Webhook processed.',
            'data' => $subscription ? new SubscriptionResource($subscription->load('plan')) : null,
        ]);
    }

    public function current(): JsonResponse
    {
        $workspace = workspace();
        $subscription = $this->usage->accountSubscription($workspace);
        $workspaces = Workspace::where('owner_id', $workspace->owner_id)
            ->with('subscription.plan')
            ->withCount(['members', 'pendingInvitations', 'socialAccounts', 'posts', 'automations'])
            ->latest()
            ->get();

        return response()->json([
            'data' => $subscription ? new SubscriptionResource($subscription) : null,
            'usage' => $this->usage->usage($workspace),
            'workspace_usage' => $this->usage->workspaceUsage($workspace),
            'workspace' => new WorkspaceResource($workspace->loadCount(['members', 'pendingInvitations', 'socialAccounts', 'posts', 'automations'])),
            'workspaces' => WorkspaceResource::collection($workspaces),
            'account_owner_id' => $workspace->owner_id,
            'account_owner_name' => $workspace->owner?->name,
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $workspace = workspace();
        $this->authorize('manageBilling', $workspace);
        abort_unless($workspace->owner_id === $request->user()->id, 403, 'Only the workspace owner can manage the account subscription package.');

        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
            'billing_cycle' => ['required', 'in:monthly,yearly,lifetime'],
        ]);

        $plan = Plan::findOrFail($data['plan_id']);
        abort_if($data['billing_cycle'] === 'lifetime' && ! $plan->lifetime_enabled, 422, 'This plan does not offer a lifetime deal.');

        $payments = PlatformSetting::valueFor('payments', []);
        $provider = $this->providerFor($plan, is_array($payments) ? $payments : []);

        if (in_array($provider, ['dodo', 'creem'], true)) {
            return response()->json([
                'mode' => 'checkout',
                'provider' => $provider,
                'checkout_url' => $this->createGatewayCheckoutUrl($request, $workspace, $plan, $data['billing_cycle'], $provider, is_array($payments) ? $payments : []),
            ]);
        }

        if ($provider === 'stripe' && config('services.stripe.secret')) {
            // Real flow: create a Stripe Checkout session and return its URL.
            return response()->json([
                'mode' => 'checkout',
                'provider' => 'stripe',
                'checkout_url' => $this->createCheckoutUrl($workspace, $plan, $data['billing_cycle']),
            ]);
        }

        // Demo flow: apply the plan change immediately.
        $period = match ($data['billing_cycle']) {
            'lifetime' => null,
            'yearly' => now()->addYear(),
            default => now()->addMonth(),
        };

        $subscription = null;
        $ownedWorkspaces = Workspace::where('owner_id', $request->user()->id)
            ->with('subscription')
            ->get();
        foreach ($ownedWorkspaces as $ownedWorkspace) {
            $subscription = $ownedWorkspace->subscription;
            if ($subscription) {
                $subscription->update([
                    'plan_id' => $plan->id,
                    'billing_cycle' => $data['billing_cycle'],
                    'provider' => $provider,
                    'status' => SubscriptionStatus::Active,
                    'current_period_start' => now(),
                    'current_period_end' => $period,
                    'cancel_at_period_end' => false,
                    'meta' => [
                        'checkout_mode' => 'manual',
                        'plan_price' => $this->planPriceForCycle($plan, $data['billing_cycle']),
                    ],
                ]);
            } else {
                $subscription = $ownedWorkspace->subscription()->create([
                    'plan_id' => $plan->id,
                    'billing_cycle' => $data['billing_cycle'],
                    'provider' => $provider,
                    'status' => SubscriptionStatus::Active,
                    'current_period_start' => now(),
                    'current_period_end' => $period,
                    'meta' => [
                        'checkout_mode' => 'manual',
                        'plan_price' => $this->planPriceForCycle($plan, $data['billing_cycle']),
                    ],
                ]);
            }
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
        abort_unless($workspace->owner_id === request()->user()->id, 403, 'Only the workspace owner can manage the account subscription package.');

        Workspace::where('owner_id', request()->user()->id)
            ->with('subscription')
            ->get()
            ->each(fn (Workspace $ownedWorkspace) => $ownedWorkspace->subscription?->update([
                'cancel_at_period_end' => true,
                'canceled_at' => now(),
            ]));

        return response()->json(['message' => 'Subscription will cancel at the end of the period.']);
    }

    protected function createCheckoutUrl($workspace, Plan $plan, string $cycle): string
    {
        // Placeholder for Stripe Checkout session creation.
        return url("/billing/checkout?workspace={$workspace->id}&plan={$plan->slug}&cycle={$cycle}");
    }

    /**
     * @param  array<string, mixed>  $payments
     */
    protected function providerFor(Plan $plan, array $payments): string
    {
        $provider = $plan->preferred_payment_provider ?: ($payments['default_provider'] ?? 'manual');
        if ($provider === 'default') {
            $provider = $payments['default_provider'] ?? 'manual';
        }

        return in_array($provider, ['manual', 'stripe', 'dodo', 'creem'], true) ? $provider : 'manual';
    }

    /**
     * @param  array<string, mixed>  $payments
     */
    protected function createGatewayCheckoutUrl(Request $request, $workspace, Plan $plan, string $cycle, string $provider, array $payments): string
    {
        $productId = $this->productIdFor($plan, $provider, $cycle);
        abort_if(! $productId, 422, "Missing {$provider} product ID for the {$cycle} package.");

        $apiKey = $payments["{$provider}_api_key"] ?? config("services.{$provider}.api_key");
        abort_if(! $apiKey, 422, "Missing {$provider} API key in payment settings.");

        $baseUrl = rtrim((string) ($payments["{$provider}_api_base"] ?? config("services.{$provider}.base_url")), '/');
        $successUrl = $plan->checkout_success_url ?: $this->frontendUrl($request, '/app/pricing-plan?checkout=success');
        $cancelUrl = $plan->checkout_cancel_url ?: $this->frontendUrl($request, '/app/pricing-plan?checkout=cancelled');
        $metadata = [
            'workspace_id' => (string) $workspace->id,
            'plan_id' => (string) $plan->id,
            'plan_slug' => $plan->slug,
            'billing_cycle' => $cycle,
            'user_id' => (string) $request->user()->id,
        ];

        try {
            $response = $provider === 'dodo'
                ? Http::withToken((string) $apiKey)
                    ->acceptJson()
                    ->post("{$baseUrl}/checkouts", [
                        'product_cart' => [
                            ['product_id' => (string) $productId, 'quantity' => 1],
                        ],
                        'customer' => [
                            'email' => $request->user()->email,
                            'name' => $request->user()->name,
                        ],
                        'metadata' => $metadata,
                        'return_url' => $successUrl,
                    ])
                : Http::withHeaders(['x-api-key' => (string) $apiKey])
                    ->acceptJson()
                    ->post("{$baseUrl}/v1/checkouts", [
                        'product_id' => (string) $productId,
                        'units' => 1,
                        'success_url' => $successUrl,
                        'customer' => [
                            'email' => $request->user()->email,
                        ],
                        'metadata' => $metadata + ['cancel_url' => $cancelUrl],
                    ]);
        } catch (Throwable $error) {
            abort(422, ucfirst($provider).' checkout could not be created: '.$error->getMessage());
        }

        abort_unless($response->successful(), 422, ucfirst($provider).' checkout failed: '.$this->gatewayErrorMessage($response->json(), $response->body()));

        $payload = $response->json();
        $checkoutUrl = data_get($payload, 'checkout_url')
            ?: data_get($payload, 'data.checkout_url')
            ?: data_get($payload, 'url')
            ?: data_get($payload, 'payment_link');

        abort_unless($checkoutUrl, 422, ucfirst($provider).' did not return a checkout URL.');

        return (string) $checkoutUrl;
    }

    protected function productIdFor(Plan $plan, string $provider, string $cycle): ?string
    {
        $attribute = "{$provider}_{$cycle}_product_id";
        $value = $plan->getAttribute($attribute);

        return $value ? (string) $value : null;
    }

    protected function planPriceForCycle(Plan $plan, string $cycle): int
    {
        return (int) match ($cycle) {
            'lifetime' => $plan->price_lifetime,
            'yearly' => $plan->price_yearly,
            default => $plan->price_monthly,
        };
    }

    protected function frontendUrl(Request $request, string $path): string
    {
        $origin = rtrim((string) ($request->headers->get('origin') ?: config('app.frontend_url') ?: config('app.url')), '/');

        return $origin.'/'.ltrim($path, '/');
    }

    protected function gatewayErrorMessage(mixed $payload, string $fallback): string
    {
        if (is_array($payload)) {
            return (string) (data_get($payload, 'message') ?: data_get($payload, 'error.message') ?: data_get($payload, 'error') ?: $fallback);
        }

        return $fallback ?: 'Unknown gateway error.';
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function payloadMetadata(array $payload): array
    {
        foreach (['metadata', 'data.metadata', 'data.object.metadata', 'object.metadata', 'checkout.metadata', 'payment.metadata', 'subscription.metadata'] as $path) {
            $metadata = data_get($payload, $path);
            if (is_array($metadata)) {
                return $metadata;
            }
        }

        return $this->findMetadata($payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    protected function findMetadata(array $payload): array
    {
        if (array_key_exists('workspace_id', $payload) && array_key_exists('plan_id', $payload)) {
            return $payload;
        }

        foreach ($payload as $value) {
            if (is_array($value)) {
                $metadata = $this->findMetadata($value);
                if ($metadata !== []) {
                    return $metadata;
                }
            }
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function isPaidWebhookEvent(array $payload): bool
    {
        $event = $this->webhookEventName($payload);
        $status = $this->webhookStatus($payload);
        $combined = "{$event} {$status}";

        foreach (['paid', 'succeeded', 'success', 'completed', 'complete', 'active'] as $needle) {
            if (str_contains($combined, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function webhookEventName(array $payload): string
    {
        return strtolower((string) (
            data_get($payload, 'type')
            ?: data_get($payload, 'event')
            ?: data_get($payload, 'event_type')
            ?: data_get($payload, 'data.type')
            ?: ''
        ));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function webhookStatus(array $payload): string
    {
        return strtolower((string) (
            data_get($payload, 'status')
            ?: data_get($payload, 'data.status')
            ?: data_get($payload, 'data.object.status')
            ?: data_get($payload, 'payment.status')
            ?: data_get($payload, 'checkout.status')
            ?: ''
        ));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $paths
     */
    protected function providerReference(array $payload, array $paths): ?string
    {
        foreach ($paths as $path) {
            $value = data_get($payload, $path);
            if ($value) {
                return (string) $value;
            }
        }

        return null;
    }
}
