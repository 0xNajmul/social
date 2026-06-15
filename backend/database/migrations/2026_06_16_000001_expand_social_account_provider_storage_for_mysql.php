<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('social_accounts')) {
            return;
        }

        if (! $this->usesMysql()) {
            return;
        }

        DB::statement(<<<'SQL'
            ALTER TABLE social_accounts
                MODIFY avatar_url TEXT NULL,
                MODIFY profile_url TEXT NULL,
                MODIFY access_token LONGTEXT NULL,
                MODIFY refresh_token LONGTEXT NULL,
                MODIFY token_meta LONGTEXT NULL
        SQL);
    }

    public function down(): void
    {
        if (! Schema::hasTable('social_accounts')) {
            return;
        }

        if (! $this->usesMysql()) {
            return;
        }

        DB::statement(<<<'SQL'
            ALTER TABLE social_accounts
                MODIFY avatar_url VARCHAR(255) NULL,
                MODIFY profile_url VARCHAR(255) NULL,
                MODIFY access_token TEXT NULL,
                MODIFY refresh_token TEXT NULL,
                MODIFY token_meta JSON NULL
        SQL);
    }

    protected function usesMysql(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }
};
