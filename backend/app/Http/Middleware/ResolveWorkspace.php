<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the "active" workspace for the request and enforces membership.
 *
 * The workspace is taken from the `X-Workspace` header (id or slug) and falls
 * back to the authenticated user's current_workspace_id. The resolved model is
 * shared via the container (`app('workspace')`) and the request attributes so
 * controllers and the workspace() helper can access it.
 */
class ResolveWorkspace
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        $identifier = $request->header('X-Workspace') ?? $user->current_workspace_id;

        $workspace = $identifier
            ? Workspace::where('id', $identifier)->orWhere('slug', $identifier)->first()
            : $user->workspaces()->first();

        if (! $workspace) {
            abort(409, 'No workspace selected. Create or select a workspace first.');
        }

        if (! $user->is_admin && ! $user->belongsToWorkspace($workspace)) {
            abort(403, 'You do not have access to this workspace.');
        }

        app()->instance('workspace', $workspace);
        $request->attributes->set('workspace', $workspace);

        return $next($request);
    }
}
