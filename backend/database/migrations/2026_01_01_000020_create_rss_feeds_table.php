<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rss_feeds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('automation_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->string('url');
            $table->string('last_item_guid')->nullable();
            $table->timestamp('last_fetched_at')->nullable();
            $table->timestamps();
        });

        Schema::create('rss_feed_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rss_feed_id')->constrained()->cascadeOnDelete();
            $table->string('guid');
            $table->string('title')->nullable();
            $table->text('summary')->nullable();
            $table->string('link')->nullable();
            $table->string('image_url')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->boolean('is_processed')->default(false);
            $table->timestamps();

            $table->unique(['rss_feed_id', 'guid']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rss_feed_items');
        Schema::dropIfExists('rss_feeds');
    }
};
