<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('platform');                 // matches social_platforms.key
            $table->string('provider_account_id');       // id on the platform
            $table->string('name');                       // display name / handle
            $table->string('username')->nullable();
            $table->text('avatar_url')->nullable();
            $table->text('profile_url')->nullable();

            // Encrypted token storage (cast to 'encrypted' on the model).
            $table->longText('access_token')->nullable();
            $table->longText('refresh_token')->nullable();
            $table->longText('token_meta')->nullable();    // encrypted scopes, page tokens, etc.
            $table->timestamp('token_expires_at')->nullable();

            $table->string('status')->default('active');  // active | expired | revoked | error
            $table->text('status_message')->nullable();
            $table->json('settings')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['workspace_id', 'platform', 'provider_account_id'], 'social_accounts_unique');
            $table->index(['workspace_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
