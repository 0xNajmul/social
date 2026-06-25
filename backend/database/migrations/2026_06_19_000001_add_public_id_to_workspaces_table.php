<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('workspaces', 'public_id')) {
            return;
        }

        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('public_id', 32)->nullable()->unique()->after('id');
        });

        DB::table('workspaces')->orderBy('id')->lazyById()->each(function ($workspace) {
            DB::table('workspaces')
                ->where('id', $workspace->id)
                ->update(['public_id' => $this->uniquePublicId()]);
        });

    }

    public function down(): void
    {
        if (! Schema::hasColumn('workspaces', 'public_id')) {
            return;
        }

        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropUnique(['public_id']);
            $table->dropColumn('public_id');
        });
    }

    private function uniquePublicId(): string
    {
        do {
            $id = 'ws_'.Str::lower(Str::random(12));
        } while (DB::table('workspaces')->where('public_id', $id)->exists());

        return $id;
    }
};
