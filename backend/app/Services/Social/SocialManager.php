<?php

namespace App\Services\Social;

use App\Contracts\SocialPublisher;
use Illuminate\Contracts\Container\Container;
use InvalidArgumentException;

/**
 * Resolves a {@see SocialPublisher} implementation for a given platform key.
 *
 * This is the single entry point the rest of the app uses to obtain a
 * publisher, keeping platform wiring in config/social.php and out of the
 * calling code.
 */
class SocialManager
{
    /** @var array<string, SocialPublisher> */
    protected array $resolved = [];

    public function __construct(protected Container $container) {}

    /**
     * Get the publisher for a platform key (e.g. "facebook_page").
     */
    public function driver(string $platform): SocialPublisher
    {
        if (isset($this->resolved[$platform])) {
            return $this->resolved[$platform];
        }

        $class = config("social.platforms.{$platform}.service");

        if (! $class || ! class_exists($class)) {
            throw new InvalidArgumentException("Unsupported social platform [{$platform}].");
        }

        return $this->resolved[$platform] = $this->container->make($class);
    }

    public function isSupported(string $platform): bool
    {
        return (bool) config("social.platforms.{$platform}.service");
    }

    /**
     * All configured platform keys.
     *
     * @return array<int, string>
     */
    public function platforms(): array
    {
        return array_keys(config('social.platforms', []));
    }

    /**
     * Capabilities for a platform.
     *
     * @return array<int, string>
     */
    public function capabilities(string $platform): array
    {
        return config("social.platforms.{$platform}.capabilities", []);
    }
}
