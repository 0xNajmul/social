<?php

use App\Http\Controllers\Api\OAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// OAuth callbacks (must match YOUTUBE_REDIRECT_URI in .env and Google Cloud Console).
Route::get('oauth/{provider}/callback', [OAuthController::class, 'callback']);
