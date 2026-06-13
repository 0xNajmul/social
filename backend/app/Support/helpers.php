<?php

use App\Models\Workspace;

if (! function_exists('workspace')) {
    /**
     * Resolve the active workspace for the current request (set by the
     * ResolveWorkspace middleware). Returns null when none is bound.
     */
    function workspace(): ?Workspace
    {
        return app()->bound('workspace') ? app('workspace') : null;
    }
}
