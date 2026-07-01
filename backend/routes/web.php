<?php

use App\Http\Controllers\Api\OAuthController;
use App\Models\PlatformSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('sitemap.xml', function (Request $request) {
    $settings = PlatformSetting::valueFor('sitemap', []);
    $settings = is_array($settings) ? $settings : [];
    $enabled = $settings['enabled'] ?? true;
    $frequency = in_array($settings['change_frequency'] ?? 'weekly', ['daily', 'weekly', 'monthly'], true)
        ? $settings['change_frequency']
        : 'weekly';

    $forwardedHost = $request->headers->get('x-forwarded-host');
    $forwardedProto = $request->headers->get('x-forwarded-proto', $request->getScheme());
    $baseUrl = $forwardedHost
        ? "{$forwardedProto}://{$forwardedHost}"
        : rtrim((string) config('app.url', $request->getSchemeAndHttpHost()), '/');
    $baseUrl = rtrim($baseUrl, '/');

    $urls = [];
    if ($enabled) {
        if ($settings['include_landing'] ?? true) {
            $urls[] = ['loc' => "{$baseUrl}/", 'priority' => '1.0'];
        }

        if ($settings['include_public_pages'] ?? true) {
            foreach (['/login', '/register', '/forgot-password', '/pricing', '/privacy', '/terms'] as $path) {
                $urls[] = ['loc' => "{$baseUrl}{$path}", 'priority' => '0.6'];
            }
        }
    }

    $lastModified = now()->toDateString();
    $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";

    foreach ($urls as $url) {
        $xml .= "  <url>\n";
        $xml .= '    <loc>'.htmlspecialchars($url['loc'], ENT_XML1)."</loc>\n";
        $xml .= "    <lastmod>{$lastModified}</lastmod>\n";
        $xml .= "    <changefreq>{$frequency}</changefreq>\n";
        $xml .= "    <priority>{$url['priority']}</priority>\n";
        $xml .= "  </url>\n";
    }

    $xml .= "</urlset>\n";

    return response($xml, 200)->header('Content-Type', 'application/xml; charset=UTF-8');
});

// OAuth callbacks (must match YOUTUBE_REDIRECT_URI in .env and Google Cloud Console).
Route::get('oauth/{provider}/callback', [OAuthController::class, 'callback']);
