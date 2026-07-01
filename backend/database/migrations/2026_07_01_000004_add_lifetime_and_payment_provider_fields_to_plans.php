<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (! Schema::hasColumn('plans', 'price_lifetime')) {
                $table->unsignedInteger('price_lifetime')->default(0);
            }
            if (! Schema::hasColumn('plans', 'lifetime_enabled')) {
                $table->boolean('lifetime_enabled')->default(false);
            }
            if (! Schema::hasColumn('plans', 'preferred_payment_provider')) {
                $table->string('preferred_payment_provider')->nullable();
            }
            if (! Schema::hasColumn('plans', 'dodo_monthly_product_id')) {
                $table->string('dodo_monthly_product_id')->nullable();
            }
            if (! Schema::hasColumn('plans', 'dodo_yearly_product_id')) {
                $table->string('dodo_yearly_product_id')->nullable();
            }
            if (! Schema::hasColumn('plans', 'dodo_lifetime_product_id')) {
                $table->string('dodo_lifetime_product_id')->nullable();
            }
            if (! Schema::hasColumn('plans', 'creem_monthly_product_id')) {
                $table->string('creem_monthly_product_id')->nullable();
            }
            if (! Schema::hasColumn('plans', 'creem_yearly_product_id')) {
                $table->string('creem_yearly_product_id')->nullable();
            }
            if (! Schema::hasColumn('plans', 'creem_lifetime_product_id')) {
                $table->string('creem_lifetime_product_id')->nullable();
            }
            if (! Schema::hasColumn('plans', 'checkout_success_url')) {
                $table->string('checkout_success_url')->nullable();
            }
            if (! Schema::hasColumn('plans', 'checkout_cancel_url')) {
                $table->string('checkout_cancel_url')->nullable();
            }
            if (! Schema::hasColumn('plans', 'payment_meta')) {
                $table->json('payment_meta')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $columns = [
                'price_lifetime',
                'lifetime_enabled',
                'preferred_payment_provider',
                'dodo_monthly_product_id',
                'dodo_yearly_product_id',
                'dodo_lifetime_product_id',
                'creem_monthly_product_id',
                'creem_yearly_product_id',
                'creem_lifetime_product_id',
                'checkout_success_url',
                'checkout_cancel_url',
                'payment_meta',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('plans', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
