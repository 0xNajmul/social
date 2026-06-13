<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\PostVariant;
use App\Services\Scheduling\PostScheduler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CalendarController extends Controller
{
    public function __construct(protected PostScheduler $scheduler) {}

    /**
     * Posts within a date range for the calendar view.
     */
    public function index(Request $request): JsonResponse
    {
        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfMonth();

        $posts = workspace()->posts()
            ->with(['variants.socialAccount', 'media'])
            ->whereBetween('scheduled_at', [$from, $to])
            ->when($request->platform, fn ($q, $p) => $q->whereHas('variants', fn ($v) => $v->where('platform', $p)))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderBy('scheduled_at')
            ->get();

        return response()->json(['data' => PostResource::collection($posts)]);
    }

    /**
     * Drag-and-drop reschedule of a single variant (or whole post).
     */
    public function reschedule(Request $request, Post $post): JsonResponse
    {
        $this->authorize('publish', $post);

        $data = $request->validate([
            'scheduled_at' => ['required', 'date'],
            'variant_id' => ['nullable', 'integer'],
        ]);

        $when = Carbon::parse($data['scheduled_at']);

        if (! empty($data['variant_id'])) {
            $variant = PostVariant::where('post_id', $post->id)->findOrFail($data['variant_id']);
            $this->scheduler->reschedule($variant, $when);
        } else {
            $this->scheduler->schedule($post->load('variants'), $when);
        }

        return response()->json(['data' => new PostResource($post->fresh('variants.socialAccount'))]);
    }
}
