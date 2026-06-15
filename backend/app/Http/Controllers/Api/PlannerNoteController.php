<?php

namespace App\Http\Controllers\Api;

use App\Enums\WorkspaceRole;
use App\Http\Controllers\Controller;
use App\Models\PlannerNote;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlannerNoteController extends Controller
{
    public function __construct(protected ActivityLogger $activity) {}

    public function index(Request $request): JsonResponse
    {
        $notes = workspace()->plannerNotes()
            ->with('author')
            ->when($request->search, function ($query, string $search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('content_text', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->limit($request->integer('limit', 12))
            ->get();

        return response()->json(['data' => $notes->map(fn (PlannerNote $note) => $this->serialize($note))->values()]);
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
        ]);

        $contentText = trim(html_entity_decode(strip_tags($data['content_html'])));

        $note = PlannerNote::create([
            'workspace_id' => $workspace->id,
            'created_by' => $request->user()->id,
            'title' => $data['title'],
            'content_html' => $data['content_html'],
            'content_text' => Str::limit($contentText, 12000, ''),
            'status' => 'note',
            'meta' => array_filter([
                'ai_prompt' => $data['ai_prompt'] ?? null,
                'scheduled_at' => $data['scheduled_at'] ?? null,
            ]),
        ]);

        $this->activity->log($workspace->id, 'planner_note.created', $note, "Created planner note: {$note->title}");

        return response()->json(['data' => $this->serialize($note->load('author'))], 201);
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
}
