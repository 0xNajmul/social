<?php

namespace App\Providers;

use App\Services\Social\SocialManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(SocialManager::class, fn ($app) => new SocialManager($app));
    }

    public function boot(): void
    {
        // Surface N+1 query bugs during development.
        Model::preventLazyLoading(! $this->app->isProduction());

        // Platform admins bypass all workspace gates.
        Gate::before(fn ($user) => $user->is_admin ? true : null);
    }
}
