<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithApi;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use InteractsWithApi, RefreshDatabase;

    public function test_user_can_register_and_receive_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Jane Creator',
            'email' => 'jane@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'workspace_name' => 'Jane Studio',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'name']]);

        $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
        $this->assertDatabaseHas('workspaces', ['name' => 'Jane Studio']);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'login@example.com',
            'password' => bcrypt('secret123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create(['email' => 'login@example.com']);

        $response = $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_authenticated_user_can_fetch_profile(): void
    {
        $user = $this->actingAsUser();

        $response = $this->getJson('/api/me');

        $response->assertOk()
            ->assertJsonPath('user.email', $user->email);
    }

    public function test_authenticated_user_can_update_profile(): void
    {
        $user = $this->actingAsUser();

        $response = $this->postJson('/api/profile', [
            'name' => 'Updated Name',
            'email' => 'updated@example.com',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'bn',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.name', 'Updated Name')
            ->assertJsonPath('user.email', 'updated@example.com');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Updated Name',
            'email' => 'updated@example.com',
            'timezone' => 'Asia/Dhaka',
            'locale' => 'bn',
        ]);
    }

    public function test_authenticated_user_can_upload_an_avatar(): void
    {
        Storage::fake('public');
        $user = $this->actingAsUser();

        $response = $this->post('/api/profile', [
            'name' => $user->name,
            'email' => $user->email,
            'timezone' => 'UTC',
            'locale' => 'en',
            'avatar' => UploadedFile::fake()->image('avatar.jpg', 300, 300),
        ], ['Accept' => 'application/json']);

        $response->assertOk();

        $user->refresh();
        $this->assertNotNull($user->avatar_path);
        Storage::disk('public')->assertExists($user->avatar_path);
    }
}
