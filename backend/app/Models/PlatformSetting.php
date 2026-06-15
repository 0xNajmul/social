<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function valueFor(string $key, mixed $default = null): mixed
    {
        $value = static::query()->where('key', $key)->value('value');

        if (is_null($value)) {
            return $default;
        }

        return match ($value) {
            'true' => true,
            'false' => false,
            default => $value,
        };
    }

    /** @param array<string, mixed> $values */
    public static function storeValues(array $values): void
    {
        foreach ($values as $key => $value) {
            static::query()->updateOrCreate(
                ['key' => $key],
                ['value' => is_bool($value) ? ($value ? 'true' : 'false') : (string) ($value ?? '')],
            );
        }
    }
}
