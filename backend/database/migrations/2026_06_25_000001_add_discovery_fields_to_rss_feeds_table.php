<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rss_feeds', function (Blueprint $table) {
            $table->string('country')->default('Global')->after('url');
            $table->string('category')->default('General')->after('country');
            $table->string('status')->default('active')->after('category');
            $table->text('description')->nullable()->after('status');
            $table->index(['workspace_id', 'status']);
            $table->index(['country', 'category']);
        });
    }

    public function down(): void
    {
        Schema::table('rss_feeds', function (Blueprint $table) {
            $table->dropIndex(['workspace_id', 'status']);
            $table->dropIndex(['country', 'category']);
            $table->dropColumn(['country', 'category', 'status', 'description']);
        });
    }
};
