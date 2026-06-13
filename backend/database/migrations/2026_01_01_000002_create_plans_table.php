<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('price_monthly')->default(0); // stored in cents
            $table->unsignedInteger('price_yearly')->default(0);
            $table->string('currency', 3)->default('USD');
            $table->string('stripe_monthly_price_id')->nullable();
            $table->string('stripe_yearly_price_id')->nullable();
            $table->unsignedSmallInteger('trial_days')->default(14);

            // Usage limits (-1 = unlimited)
            $table->integer('max_workspaces')->default(1);
            $table->integer('max_team_members')->default(1);
            $table->integer('max_social_accounts')->default(3);
            $table->integer('max_scheduled_posts')->default(30);
            $table->integer('max_monthly_posts')->default(100);
            $table->integer('max_automations')->default(1);
            $table->integer('max_ai_credits')->default(50);
            $table->unsignedBigInteger('max_storage_mb')->default(1024);

            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
