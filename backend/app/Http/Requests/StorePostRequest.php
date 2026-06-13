<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'content' => ['nullable', 'string', 'max:65000'],
            'type' => ['nullable', 'in:text,image,video,carousel,link'],
            'link_url' => ['nullable', 'url', 'max:2048'],
            'hashtags' => ['nullable', 'array'],
            'hashtags.*' => ['string', 'max:100'],
            'mentions' => ['nullable', 'array'],
            'options' => ['nullable', 'array'],
            'scheduled_at' => ['nullable', 'date'],
            'requires_approval' => ['boolean'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['integer', 'exists:media_assets,id'],
            'targets' => ['required', 'array', 'min:1'],
            'targets.*.social_account_id' => ['required', 'integer', 'exists:social_accounts,id'],
            'targets.*.content' => ['nullable', 'string', 'max:65000'],
            'targets.*.hashtags' => ['nullable', 'array'],
            'targets.*.options' => ['nullable', 'array'],
        ];
    }
}
