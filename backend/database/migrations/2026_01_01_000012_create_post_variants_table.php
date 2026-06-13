<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A post variant is the platform-specific version of a post targeting a
     * single connected social account. This is the unit that actually gets
     * published, scheduled, and tracked.
     */
    public function up(): void
    {
        Schema::create('post_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('social_account_id')->constrained()->cascadeOnDelete();
            $table->string('platform');
            $table->longText('content')->nullable();      // overrides post content when set
            $table->json('hashtags')->nullable();
            $table->json('options')->nullable();           // per-platform options
            $table->string('status')->default('draft');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('published_at')->nullable();

            // Result of publishing.
            $table->string('provider_post_id')->nullable();
            $table->string('permalink')->nullable();
            $table->json('provider_response')->nullable(); // stored API response for debugging
            $table->text('error_message')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamps();

            $table->index(['status', 'scheduled_at']);
            $table->index('social_account_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_variants');
    }
};
