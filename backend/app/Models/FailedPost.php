<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FailedPost extends Model
{
    protected $fillable = [
        'post_variant_id', 'workspace_id', 'platform', 'error_message',
        'error_context', 'attempts', 'is_resolved', 'next_retry_at',
    ];

    protected function casts(): array
    {
        return [
            'error_context' => 'array',
            'is_resolved' => 'boolean',
            'next_retry_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PostVariant, $this> */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(PostVariant::class, 'post_variant_id');
    }
}
