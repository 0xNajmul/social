<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('type'); // rss_feed | blog | youtube_channel | csv_import | recycle | repost_top_performing
            $table->boolean('is_active')->default(true);

            // Which connected accounts this automation posts to.
            $table->json('social_account_ids')->nullable();
            $table->json('config')->nullable();          // source url, schedule, templates, AI settings
            $table->boolean('requires_approval')->default(false);
            $table->boolean('use_ai')->default(false);

            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('next_run_at')->nullable();
            $table->unsignedBigInteger('items_created')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'next_run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automations');
    }
};
