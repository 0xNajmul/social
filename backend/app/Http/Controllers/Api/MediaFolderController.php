<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFolder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaFolderController extends Controller
{
    public function index(): JsonResponse
    {
        $folders = workspace()->mediaFolders()->withCount('assets')->get();

        return response()->json(['data' => $folders]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'integer', 'exists:media_folders,id'],
        ]);

        $folder = workspace()->mediaFolders()->create($data);

        return response()->json(['data' => $folder], 201);
    }

    public function update(Request $request, MediaFolder $folder): JsonResponse
    {
        abort_unless($folder->workspace_id === workspace()->id, 403);
        $folder->update($request->validate(['name' => ['required', 'string', 'max:120']]));

        return response()->json(['data' => $folder]);
    }

    public function destroy(MediaFolder $folder): JsonResponse
    {
        abort_unless($folder->workspace_id === workspace()->id, 403);
        $folder->delete();

        return response()->json(['message' => 'Folder deleted.']);
    }
}
