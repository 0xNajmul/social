<?php

namespace App\Jobs;

use App\Models\Automation;
use App\Services\Automation\AutomationRunner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessAutomationJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $automationId) {}

    public function handle(AutomationRunner $runner): void
    {
        $automation = Automation::find($this->automationId);

        if ($automation && $automation->is_active) {
            $runner->run($automation);
        }
    }
}
