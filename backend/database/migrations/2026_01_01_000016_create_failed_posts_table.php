<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('failed_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_variant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('platform');
            $table->text('error_message');
            $table->json('error_context')->nullable();
            $table->unsignedTinyInteger('attempts')->default(1);
            $table->boolean('is_resolved')->default(false);
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'is_resolved']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_posts');
    }
};
