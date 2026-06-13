<?php

namespace App\Console\Commands;

use App\Jobs\ProcessAutomationJob;
use App\Models\Automation;
use Illuminate\Console\Command;

class RunAutomationsCommand extends Command
{
    protected $signature = 'automations:run';

    protected $description = 'Dispatch jobs for all automations that are due to run';

    public function handle(): int
    {
        $due = Automation::where('is_active', true)
            ->where(fn ($q) => $q->whereNull('next_run_at')->orWhere('next_run_at', '<=', now()))
            ->get();

        foreach ($due as $automation) {
            ProcessAutomationJob::dispatch($automation->id);
        }

        $this->info("Dispatched {$due->count()} automation(s).");

        return self::SUCCESS;
    }
}
