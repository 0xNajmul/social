<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ApiKey extends Model
{
    protected $fillable = [
        'workspace_id', 'created_by', 'name', 'prefix', 'last_four', 'key_hash',
        'scopes', 'last_used_at', 'expires_at', 'revoked_at',
    ];

    protected $hidden = ['key_hash'];

    protected function casts(): array
    {
        return [
            'scopes' => 'array',
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * Generate a new key, returning the plaintext secret (shown only once).
     *
     * @return array{model: self, secret: string}
     */
    public static function generate(Workspace $workspace, string $name, ?int $userId = null): array
    {
        $secret = 'sk_'.Str::random(40);

        $model = static::create([
            'workspace_id' => $workspace->id,
            'created_by' => $userId,
            'name' => $name,
            'prefix' => substr($secret, 0, 12),
            'last_four' => substr($secret, -4),
            'key_hash' => Hash::make($secret),
        ]);

        return ['model' => $model, 'secret' => $secret];
    }

    public function isActive(): bool
    {
        return is_null($this->revoked_at)
            && (is_null($this->expires_at) || $this->expires_at->isFuture());
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
