<?php

namespace App\Http\Controllers\Api;

use App\Enums\WorkspaceRole;
use App\Http\Controllers\Controller;
use App\Models\PlannerNote;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlannerNoteController extends Controller
{
    public function __construct(protected ActivityLogger $activity) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = max(1, min($request->integer('per_page', $request->integer('limit', 12)), 100));

        $notes = workspace()->plannerNotes()
            ->with('author')
            ->when($request->search, function ($query, string $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('content_text', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'data' => collect($notes->items())->map(fn (PlannerNote $note) => $this->serialize($note))->values(),
            'links' => [
                'first' => $notes->url(1),
                'last' => $notes->url($notes->lastPage()),
                'prev' => $notes->previousPageUrl(),
                'next' => $notes->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $notes->currentPage(),
                'from' => $notes->firstItem(),
                'last_page' => $notes->lastPage(),
                'path' => $notes->path(),
                'per_page' => $notes->perPage(),
                'to' => $notes->lastItem(),
                'total' => $notes->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $workspace = workspace();
        $role = $request->user()->roleIn($workspace);

        if (! ($role?->atLeast(WorkspaceRole::Editor) ?? false)) {
            abort(403);
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content_html' => ['required', 'string', 'max:50000'],
            'ai_prompt' => ['nullable', 'string', 'max:1000'],
            'scheduled_at' => ['nullable', 'date'],
            'social_account_id' => ['nullable', 'integer', Rule::exists('social_accounts', 'id')->where('workspace_id', $workspace->id)],
            'categories' => ['nullable', 'array'],
            'categories.*' => ['string', 'max:80'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:80'],
            'tag_colors' => ['nullable', 'array'],
            'tag_colors.*' => ['string', 'max:20'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['integer', Rule::exists('media_assets', 'id')->where('workspace_id', $workspace->id)],
            'media' => ['nullable', 'array'],
            'status' => ['nullable', 'string', 'max:50'],
        ]);

        $contentText = trim(html_entity_decode(strip_tags($data['content_html'])));

        $note = PlannerNote::create([
            'workspace_id' => $workspace->id,
            'created_by' => $request->user()->id,
            'title' => $data['title'],
            'content_html' => $data['content_html'],
            'content_text' => Str::limit($contentText, 12000, ''),
            'status' => $data['status'] ?? 'note',
            'meta' => array_filter([
                'ai_prompt' => $data['ai_prompt'] ?? null,
                'scheduled_at' => $data['scheduled_at'] ?? null,
                'social_account_id' => $data['social_account_id'] ?? null,
                'categories' => $data['categories'] ?? null,
                'tags' => $data['tags'] ?? null,
                'tag_colors' => $data['tag_colors'] ?? null,
                'media_ids' => $data['media_ids'] ?? null,
                'media' => $this->sanitizeMediaMeta($data['media'] ?? []),
            ]),
        ]);

        $this->activity->log($workspace->id, 'planner_note.created', $note, "Created planner note: {$note->title}");

        return response()->json(['data' => $this->serialize($note->load('author'))], 201);
    }

    public function update(Request $request, PlannerNote $plannerNote): JsonResponse
    {
        $this->ensureCanManage($request, $plannerNote);
        $workspace = workspace();

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content_html' => ['required', 'string', 'max:50000'],
            'ai_prompt' => ['nullable', 'string', 'max:1000'],
            'scheduled_at' => ['nullable', 'date'],
            'social_account_id' => ['nullable', 'integer', Rule::exists('social_accounts', 'id')->where('workspace_id', $workspace->id)],
            'categories' => ['nullable', 'array'],
            'categories.*' => ['string', 'max:80'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:80'],
            'tag_colors' => ['nullable', 'array'],
            'tag_colors.*' => ['string', 'max:20'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['integer', Rule::exists('media_assets', 'id')->where('workspace_id', $workspace->id)],
            'media' => ['nullable', 'array'],
            'status' => ['nullable', 'string', 'max:50'],
        ]);

        $contentText = trim(html_entity_decode(strip_tags($data['content_html'])));

        $plannerNote->update([
            'title' => $data['title'],
            'content_html' => $data['content_html'],
            'content_text' => Str::limit($contentText, 12000, ''),
            'status' => $data['status'] ?? $plannerNote->status,
            'meta' => array_filter([
                'ai_prompt' => $data['ai_prompt'] ?? null,
                'scheduled_at' => $data['scheduled_at'] ?? null,
                'social_account_id' => $data['social_account_id'] ?? null,
                'categories' => $data['categories'] ?? null,
                'tags' => $data['tags'] ?? null,
                'tag_colors' => $data['tag_colors'] ?? null,
                'media_ids' => $data['media_ids'] ?? null,
                'media' => $this->sanitizeMediaMeta($data['media'] ?? []),
            ]),
        ]);

        $this->activity->log($plannerNote->workspace_id, 'planner_note.updated', $plannerNote, "Updated planner note: {$plannerNote->title}");

        return response()->json(['data' => $this->serialize($plannerNote->fresh()->load('author'))]);
    }

    public function destroy(Request $request, PlannerNote $plannerNote): JsonResponse
    {
        $this->ensureCanManage($request, $plannerNote);

        $title = $plannerNote->title;
        $workspaceId = $plannerNote->workspace_id;

        $plannerNote->delete();

        $this->activity->log($workspaceId, 'planner_note.deleted', null, "Deleted planner note: {$title}");

        return response()->json(['message' => 'Planner note deleted.']);
    }

    protected function serialize(PlannerNote $note): array
    {
        return [
            'id' => $note->id,
            'title' => $note->title,
            'content_html' => $note->content_html,
            'content_text' => $note->content_text,
            'excerpt' => Str::limit($note->content_text ?? '', 180),
            'status' => $note->status,
            'meta' => $note->meta ?? [],
            'author' => $note->relationLoaded('author') && $note->author ? [
                'id' => $note->author->id,
                'name' => $note->author->name,
                'avatar_url' => $note->author->avatar_path ? asset('storage/'.$note->author->avatar_path) : null,
            ] : null,
            'created_at' => $note->created_at,
            'updated_at' => $note->updated_at,
        ];
    }

    protected function ensureCanManage(Request $request, PlannerNote $note): void
    {
        $workspace = workspace();

        abort_unless($note->workspace_id === $workspace->id, 404);

        $role = $request->user()->roleIn($workspace);

        if (! ($role?->atLeast(WorkspaceRole::Editor) ?? false)) {
            abort(403);
        }
    }

    protected function sanitizeMediaMeta(array $media): array
    {
        return collect($media)
            ->filter(fn ($item) => is_array($item) && isset($item['id']))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'original_name' => $item['original_name'] ?? null,
                'type' => $item['type'] ?? null,
                'mime_type' => $item['mime_type'] ?? null,
                'url' => $item['url'] ?? null,
                'thumbnail_url' => $item['thumbnail_url'] ?? null,
                'alt_text' => $item['alt_text'] ?? null,
            ])
            ->values()
            ->all();
    }
}
