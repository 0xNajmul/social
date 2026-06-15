<?php

namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workspace;
use App\Models\PlatformSetting;
use Illuminate\Support\Facades\DB;

/**
 * Creates a workspace, assigns the owner, and starts a trial subscription on
 * the default plan. Used during onboarding and when a user adds a workspace.
 */
class WorkspaceProvisioner
{
    public function create(User $owner, string $name, ?Plan $plan = null): Workspace
    {
        return DB::transaction(function () use ($owner, $name, $plan) {
            $plan ??= Plan::where('is_active', true)->orderBy('price_monthly')->first();
            $trialDays = (int) PlatformSetting::valueFor('default_trial_days', $plan?->trial_days ?? 14);

            $workspace = Workspace::create([
                'owner_id' => $owner->id,
                'name' => $name,
                'timezone' => $owner->timezone ?? 'UTC',
                'trial_ends_at' => now()->addDays($trialDays),
            ]);

            $workspace->addMember($owner, WorkspaceRole::Owner);

            if ($plan) {
                Subscription::create([
                    'workspace_id' => $workspace->id,
                    'plan_id' => $plan->id,
                    'status' => SubscriptionStatus::Trialing,
                    'trial_ends_at' => now()->addDays($trialDays),
                    'current_period_start' => now(),
                    'current_period_end' => now()->addDays($trialDays),
                ]);
            }

            if (! $owner->current_workspace_id) {
                $owner->forceFill(['current_workspace_id' => $workspace->id])->save();
            }

            return $workspace;
        });
    }
}
