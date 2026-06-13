<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('email');
            $table->string('timezone')->default('UTC')->after('avatar_path');
            $table->string('locale', 8)->default('en')->after('timezone');
            $table->boolean('is_admin')->default(false)->after('locale');
            $table->foreignId('current_workspace_id')->nullable()->after('is_admin');
            $table->string('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->string('last_login_ip', 45)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'avatar_path', 'timezone', 'locale', 'is_admin',
                'current_workspace_id', 'two_factor_secret',
                'two_factor_recovery_codes', 'two_factor_confirmed_at',
                'last_login_at', 'last_login_ip',
            ]);
        });
    }
};
