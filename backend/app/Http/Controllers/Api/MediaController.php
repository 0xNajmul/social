<?php

namespace App\Http\Controllers\Api;

use App\Enums\MediaType;
use App\Http\Controllers\Controller;
use App\Http\Resources\MediaResource;
use App\Models\MediaAsset;
use App\Services\Billing\UsageGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaController extends Controller
{
    public function __construct(protected UsageGuard $usage) {}

    public function index(Request $request): JsonResponse
    {
        $assets = workspace()->mediaAssets()
            ->when($request->folder_id, fn ($q, $id) => $q->where('folder_id', $id))
            ->when($request->filled('folder_id') && $request->folder_id === 'root', fn ($q) => $q->whereNull('folder_id'))
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('original_name', 'like', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 40));

        return MediaResource::collection($assets)->response();
    }

    public function store(Request $request): JsonResponse
    {
        $workspace = workspace();
        $request->validate([
            'file' => ['required', 'file', 'max:204800', 'mimes:jpg,jpeg,png,gif,webp,mp4,mov,webm,pdf'],
            'folder_id' => ['nullable', 'integer', 'exists:media_folders,id'],
        ]);

        $file = $request->file('file');
        $sizeMb = (int) ceil($file->getSize() / 1048576);
        $this->usage->ensure($workspace, 'storage_mb', $sizeMb);

        $path = $file->store("workspaces/{$workspace->id}/media", 'public');
        $type = MediaType::fromMime($file->getMimeType() ?? '');

        [$width, $height] = $this->dimensions($file->getRealPath(), $type);

        $asset = $workspace->mediaAssets()->create([
            'folder_id' => $request->folder_id,
            'uploaded_by' => $request->user()->id,
            'type' => $type,
            'disk' => 'public',
            'path' => $path,
            'thumbnail_path' => $type === MediaType::Image ? $path : null,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'width' => $width,
            'height' => $height,
        ]);

        return response()->json(['data' => new MediaResource($asset)], 201);
    }

    public function show(MediaAsset $media): JsonResponse
    {
        $this->authorize('view', $media);

        return response()->json(['data' => new MediaResource($media)]);
    }

    public function update(Request $request, MediaAsset $media): JsonResponse
    {
        $this->authorize('view', $media);
        $data = $request->validate([
            'folder_id' => ['nullable', 'integer', 'exists:media_folders,id'],
            'tags' => ['nullable', 'array'],
            'original_name' => ['sometimes', 'string', 'max:255'],
            'alt_text' => ['nullable', 'string', 'max:255'],
        ]);

        $meta = $media->meta ?? [];
        if ($request->has('alt_text')) {
            $meta['alt_text'] = $data['alt_text'] ?? null;
        }

        unset($data['alt_text']);
        $data['meta'] = $meta;

        $media->update($data);

        return response()->json(['data' => new MediaResource($media)]);
    }

    public function destroy(MediaAsset $media): JsonResponse
    {
        $this->authorize('delete', $media);
        \Illuminate\Support\Facades\Storage::disk($media->disk)->delete($media->path);
        $media->delete();

        return response()->json(['message' => 'Media deleted.']);
    }

    /**
     * @return array{0:?int,1:?int}
     */
    protected function dimensions(string $path, MediaType $type): array
    {
        if ($type !== MediaType::Image && $type !== MediaType::Gif) {
            return [null, null];
        }

        $info = @getimagesize($path);

        return [$info[0] ?? null, $info[1] ?? null];
    }
}
