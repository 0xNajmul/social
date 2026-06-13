<?php

namespace App\Enums;

/**
 * Lifecycle states for a post / post variant.
 *
 * draft -> pending_approval -> approved -> scheduled -> publishing -> published
 * Any state may transition to failed or cancelled.
 */
enum PostStatus: string
{
    case Draft = 'draft';
    case PendingApproval = 'pending_approval';
    case Approved = 'approved';
    case Scheduled = 'scheduled';
    case Publishing = 'publishing';
    case Published = 'published';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    /**
     * Human readable label.
     */
    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::PendingApproval => 'Pending approval',
            self::Approved => 'Approved',
            self::Scheduled => 'Scheduled',
            self::Publishing => 'Publishing',
            self::Published => 'Published',
            self::Failed => 'Failed',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Tailwind-friendly colour token used by the UI.
     */
    public function color(): string
    {
        return match ($this) {
            self::Draft => 'slate',
            self::PendingApproval => 'amber',
            self::Approved => 'sky',
            self::Scheduled => 'indigo',
            self::Publishing => 'violet',
            self::Published => 'emerald',
            self::Failed => 'rose',
            self::Cancelled => 'gray',
        };
    }

    /**
     * States that still require the post to be published.
     *
     * @return array<int, self>
     */
    public static function open(): array
    {
        return [self::Scheduled, self::Approved, self::Publishing];
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Published, self::Cancelled], true);
    }
}
