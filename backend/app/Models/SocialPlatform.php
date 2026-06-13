<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SocialPlatform extends Model
{
    protected $fillable = [
        'key', 'label', 'group', 'icon', 'color',
        'capabilities', 'limits', 'is_enabled', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'capabilities' => 'array',
            'limits' => 'array',
            'is_enabled' => 'boolean',
        ];
    }

    public function supports(string $capability): bool
    {
        return in_array($capability, $this->capabilities ?? [], true);
    }

    public function getRouteKeyName(): string
    {
        return 'key';
    }
}
