<?php

namespace App\Enums;

/**
 * Roles a user can hold inside a workspace. Ordered from most to least
 * privileged; {@see WorkspaceRole::atLeast()} relies on this ordering.
 */
enum WorkspaceRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Manager = 'manager';
    case Editor = 'editor';
    case Viewer = 'viewer';
    case Client = 'client';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /**
     * Numeric weight used for privilege comparisons (higher = more access).
     */
    public function weight(): int
    {
        return match ($this) {
            self::Owner => 50,
            self::Admin => 40,
            self::Manager => 30,
            self::Editor => 20,
            self::Viewer => 10,
            self::Client => 5,
        };
    }

    /**
     * Whether this role has at least the privilege level of $role.
     */
    public function atLeast(self $role): bool
    {
        return $this->weight() >= $role->weight();
    }

    public function canManageTeam(): bool
    {
        return $this->atLeast(self::Admin);
    }

    public function canManageBilling(): bool
    {
        return $this->atLeast(self::Admin);
    }

    public function canApprove(): bool
    {
        return $this->atLeast(self::Manager);
    }

    public function canPublish(): bool
    {
        return $this->atLeast(self::Editor);
    }

    public function canEdit(): bool
    {
        return $this->atLeast(self::Editor);
    }
}
