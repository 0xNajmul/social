<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_generations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // caption | hook | hashtags | ideas | rewrite | tone | calendar | reply | image_prompt
            $table->text('prompt');
            $table->longText('result')->nullable();
            $table->json('params')->nullable();
            $table->string('model')->nullable();
            $table->unsignedInteger('tokens_used')->default(0);
            $table->unsignedInteger('credits_used')->default(1);
            $table->timestamps();

            $table->index(['workspace_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_generations');
    }
};
