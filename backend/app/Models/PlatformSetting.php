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
            default => static::decodeValue($value),
        };
    }

    /** @param array<string, mixed> $values */
    public static function storeValues(array $values): void
    {
        foreach ($values as $key => $value) {
            static::query()->updateOrCreate(
                ['key' => $key],
                ['value' => static::encodeValue($value)],
            );
        }
    }

    protected static function encodeValue(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '[]';
        }

        return (string) ($value ?? '');
    }

    protected static function decodeValue(string $value): mixed
    {
        $trimmed = trim($value);

        if ($trimmed === '' || ! in_array($trimmed[0], ['{', '['], true)) {
            return $value;
        }

        $decoded = json_decode($value, true);

        return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
    }
}
