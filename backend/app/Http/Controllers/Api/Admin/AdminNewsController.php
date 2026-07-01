<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\NewsPostResource;
use App\Models\NewsPost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminNewsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = NewsPost::query()->latest('updated_at');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($builder) use ($search): void {
                $builder->where('title', 'like', "%{$search}%")
                    ->orWhere('summary', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('author', 'like', "%{$search}%");
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        $posts = $query->paginate((int) $request->query('per_page', 12));

        return response()->json([
            'data' => NewsPostResource::collection($posts->items()),
            'meta' => [
                'current_page' => $posts->currentPage(),
                'last_page' => $posts->lastPage(),
                'per_page' => $posts->perPage(),
                'total' => $posts->total(),
            ],
            'filters' => [
                'categories' => NewsPost::query()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category')->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedData($request);
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? $data['title']);
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        if ($request->hasFile('hero_image')) {
            $data['hero_image_url'] = Storage::url($request->file('hero_image')->store('news', 'public'));
        }

        $post = NewsPost::create($data);

        return response()->json(['data' => new NewsPostResource($post)], 201);
    }

    public function update(Request $request, NewsPost $news): JsonResponse
    {
        $data = $this->validatedData($request, $news);
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? $news->slug, $news);
        $data['updated_by'] = $request->user()->id;

        if ($request->hasFile('hero_image')) {
            $data['hero_image_url'] = Storage::url($request->file('hero_image')->store('news', 'public'));
        }

        $news->update($data);

        return response()->json(['data' => new NewsPostResource($news->fresh())]);
    }

    public function destroy(NewsPost $news): JsonResponse
    {
        $news->delete();

        return response()->json(['message' => 'News post deleted.']);
    }

    /**
     * @return array<string, mixed>
     */
    protected function validatedData(Request $request, ?NewsPost $post = null): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('news_posts', 'slug')->ignore($post?->id)],
            'summary' => ['nullable', 'string', 'max:1000'],
            'author' => ['nullable', 'string', 'max:120'],
            'body' => ['nullable', 'string'],
            'details' => ['nullable', 'string'],
            'category' => ['nullable', 'string', 'max:120'],
            'hero_image_url' => ['nullable', 'string', 'max:2048'],
            'hero_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:6144'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'meta_keywords' => ['nullable'],
        ]);

        $body = trim((string) ($data['body'] ?? $data['details'] ?? ''));
        abort_if($body === '', 422, 'News details are required.');

        $data['body'] = $body;
        unset($data['details'], $data['hero_image']);
        $data['slug'] = isset($data['slug']) && trim((string) $data['slug']) !== '' ? Str::slug($data['slug']) : null;
        $data['meta_keywords'] = $this->keywordList($request->input('meta_keywords', []));
        $data['published_at'] = ($data['status'] ?? 'draft') === 'published'
            ? ($data['published_at'] ?? now())
            : null;

        return $data;
    }

    /**
     * @return list<string>
     */
    protected function keywordList(mixed $keywords): array
    {
        if (is_string($keywords)) {
            $keywords = preg_split('/[\n,]+/', $keywords) ?: [];
        }

        if (! is_array($keywords)) {
            return [];
        }

        return collect($keywords)
            ->map(fn ($keyword): string => trim((string) $keyword))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    protected function uniqueSlug(string $value, ?NewsPost $existing = null): string
    {
        $base = Str::slug($value) ?: 'news';
        $slug = $base;
        $index = 2;

        while (NewsPost::where('slug', $slug)->when($existing, fn ($query) => $query->whereKeyNot($existing->id))->exists()) {
            $slug = "{$base}-{$index}";
            $index++;
        }

        return $slug;
    }
}
