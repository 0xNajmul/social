import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  FileText,
  GripVertical,
  List,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import api from '../lib/api'
import { Button, Card, PageLoader } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'

const VIEWS = [
  { id: 'day', label: 'Day', icon: List },
  { id: 'week', label: 'Week', icon: Columns3 },
  { id: 'month', label: 'Month', icon: CalendarDays },
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const LOCKED_STATUSES = ['published', 'publishing']

export default function Calendar({
  embedded = false,
  filter = 'all',
  plannerNotes = [],
  showPlannerData = false,
  showSocialData = true,
}) {
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState('month')
  const [calendarData, setCalendarData] = useState({ key: null, posts: [] })
  const [createdPlannerNotes, setCreatedPlannerNotes] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [busyPostId, setBusyPostId] = useState(null)
  const [plannerBusyDate, setPlannerBusyDate] = useState(null)
  const [modalAction, setModalAction] = useState(null)

  const range = useMemo(() => getRange(cursor, view), [cursor, view])
  const from = fmt(range.start)
  const to = fmt(range.end)
  const rangeKey = `${view}:${from}:${to}`
  const posts = calendarData.key === rangeKey ? calendarData.posts : null
  const allPlannerNotes = useMemo(() => [...createdPlannerNotes, ...(plannerNotes || [])], [createdPlannerNotes, plannerNotes])
  const calendarItems = useMemo(() => {
    const socialItems = showSocialData ? (posts || []).map((post) => ({ ...post, kind: post.kind || 'post' })) : []
    const planItems = showPlannerData
      ? allPlannerNotes.map(noteToCalendarItem).filter((item) => Boolean(item.scheduled_at))
      : []

    return [...socialItems, ...planItems]
      .filter((item) => filter === 'all' || filter === 'custom' || calendarGroupFor(item) === filter)
      .sort(comparePosts)
  }, [allPlannerNotes, filter, posts, showPlannerData, showSocialData])

  useEffect(() => {
    let active = true
    api.get('/calendar', { params: { from, to } })
      .then(({ data }) => {
        if (active) setCalendarData({ key: rangeKey, posts: data.data })
      })
      .catch(() => {
        if (active) setCalendarData({ key: rangeKey, posts: [] })
      })
    return () => { active = false }
  }, [from, rangeKey, to])

  const byDay = useMemo(() => {
    const map = {}
    ;(calendarItems || []).forEach((post) => {
      if (!post.scheduled_at) return
      const key = fmt(new Date(post.scheduled_at))
      ;(map[key] ||= []).push(post)
    })
    Object.values(map).forEach((items) => items.sort(comparePosts))
    return map
  }, [calendarItems])

  const replacePost = (updatedPost) => {
    setCalendarData((current) => ({
      ...current,
      posts: current.posts.map((post) => post.id === updatedPost.id ? updatedPost : post),
    }))
    setSelectedPost((current) => current?.id === updatedPost.id ? updatedPost : current)
  }

  const reschedulePost = async (post, nextDate) => {
    if (!post || !canReschedule(post)) return false

    const original = post
    const optimistic = {
      ...post,
      scheduled_at: nextDate.toISOString(),
      status: 'scheduled',
      status_label: 'Scheduled',
    }

    setBusyPostId(post.id)
    replacePost(optimistic)

    try {
      const { data } = await api.post(`/calendar/${post.id}/reschedule`, {
        scheduled_at: nextDate.toISOString(),
      })
      replacePost(data.data)
      return true
    } catch (error) {
      replacePost(original)
      window.alert(error.response?.data?.message || 'Could not reschedule this post.')
      return false
    } finally {
      setBusyPostId(null)
    }
  }

  const movePost = (postId, targetDay, hour = null) => {
    const post = posts?.find((item) => item.id === postId)
    if (!post || !canReschedule(post)) return

    const current = new Date(post.scheduled_at)
    const next = new Date(targetDay)
    next.setHours(hour ?? current.getHours(), current.getMinutes(), 0, 0)

    if (next.getTime() !== current.getTime()) reschedulePost(post, next)
  }

  const deletePost = async (post) => {
    if (post.kind === 'planner') return false

    setModalAction('delete')
    setBusyPostId(post.id)
    try {
      await api.delete(`/posts/${post.id}`)
      setCalendarData((current) => ({
        ...current,
        posts: current.posts.filter((item) => item.id !== post.id),
      }))
      setSelectedPost(null)
      return true
    } catch (error) {
      window.alert(error.response?.data?.message || 'Could not delete this post.')
      return false
    } finally {
      setModalAction(null)
      setBusyPostId(null)
    }
  }

  const saveModalDate = async (date) => {
    if (!selectedPost) return
    setModalAction('save')
    const saved = await reschedulePost(selectedPost, date)
    setModalAction(null)
    if (saved) setSelectedPost(null)
  }

  const move = (direction) => {
    setCursor((current) => {
      if (view === 'day') return addDays(current, direction)
      if (view === 'week') return addDays(current, direction * 7)
      return new Date(current.getFullYear(), current.getMonth() + direction, 1)
    })
  }

  const createPostAt = (date) => {
    if (embedded) {
      window.dispatchEvent(new CustomEvent('postflow:quick-action', { detail: { type: 'composer', scheduledAt: date.toISOString() } }))
      return
    }
    navigate(`/app/composer?scheduled_at=${encodeURIComponent(date.toISOString())}`)
  }

  const createPlannerAt = async (date) => {
    const key = date.toISOString()
    setPlannerBusyDate(key)
    try {
      const label = date.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      const { data } = await api.post('/planner-notes', {
        title: `Plan for ${label}`,
        content_html: `<p>Planner note scheduled for ${escapeHtml(label)}.</p>`,
        scheduled_at: key,
      })
      setCreatedPlannerNotes((current) => [data.data, ...current])
      setSelectedPost(noteToCalendarItem(data.data))
    } catch (error) {
      window.alert(error.response?.data?.message || 'Could not create a planner note for this time.')
    } finally {
      setPlannerBusyDate(null)
    }
  }

  const sharedViewProps = {
    onOpen: setSelectedPost,
    onMove: movePost,
    onDragOver: setDropTarget,
    onDragEnd: () => setDropTarget(null),
    onCreatePost: createPostAt,
    onCreatePlanner: createPlannerAt,
    dropTarget,
    busyPostId,
    plannerBusyDate,
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calendar</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Drag posts to move them, or click one to view details and edit its schedule.
            </p>
          </div>
          <Button onClick={() => navigate('/app/composer')}>
            <Plus className="h-4 w-4" /> Create post
          </Button>
        </div>
      )}

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
              <button
                onClick={() => move(-1)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={`Previous ${view}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(1)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={`Next ${view}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h2 className="min-w-0 text-base font-semibold text-slate-800 dark:text-slate-100 sm:text-lg">
              {range.label}
            </h2>
          </div>

          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  view === id
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {posts === null ? (
        <PageLoader />
      ) : (
        <>
          {view === 'day' && <DayView day={startOfDay(cursor)} posts={byDay[fmt(cursor)] || []} {...sharedViewProps} />}
          {view === 'week' && <WeekView start={range.start} postsByDay={byDay} {...sharedViewProps} />}
          {view === 'month' && <MonthView cursor={cursor} start={range.start} postsByDay={byDay} {...sharedViewProps} />}
        </>
      )}

      {selectedPost && (
        <PostDetailsModal
          post={selectedPost}
          action={modalAction}
          onClose={() => setSelectedPost(null)}
          onSave={saveModalDate}
          onDelete={() => deletePost(selectedPost)}
        />
      )}
    </div>
  )
}

function DayView({ day, posts, onOpen, onMove, onDragOver, onDragEnd, onCreatePost, onCreatePlanner, dropTarget, busyPostId, plannerBusyDate }) {
  const postsByHour = groupByHour(posts)

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {day.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-xs text-slate-500">{postCountLabel(posts.length)}</p>
        </div>
        {isSameDay(day, new Date()) && (
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            Today
          </span>
        )}
      </div>

      <div className="max-h-[680px] overflow-y-auto">
        {HOURS.map((hour) => {
          const targetKey = `day:${fmt(day)}:${hour}`
          return (
            <div key={hour} className="grid min-h-16 grid-cols-[72px_1fr] border-b border-slate-100 last:border-b-0 dark:border-slate-800">
              <div className="border-r border-slate-100 px-3 py-3 text-right text-xs font-medium text-slate-400 dark:border-slate-800">
                {formatHour(hour)}
              </div>
              <DropArea
                targetKey={targetKey}
                createDate={dateWithHour(day, hour)}
                active={dropTarget === targetKey}
                onDragOver={onDragOver}
                onDrop={(postId) => onMove(postId, day, hour)}
                onCreatePost={onCreatePost}
                onCreatePlanner={onCreatePlanner}
                plannerBusyDate={plannerBusyDate}
                className="space-y-2 p-2"
              >
                {(postsByHour[hour] || []).map((post) => (
                  <PostCard key={post.id} post={post} detailed onOpen={onOpen} onDragEnd={onDragEnd} busy={busyPostId === post.id} />
                ))}
              </DropArea>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function WeekView({ start, postsByDay, onOpen, onMove, onDragOver, onDragEnd, onCreatePost, onCreatePlanner, dropTarget, busyPostId, plannerBusyDate }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-7 divide-x divide-slate-200 dark:divide-slate-800">
          {days.map((day) => {
            const dayKey = fmt(day)
            const targetKey = `week:${dayKey}`
            const posts = postsByDay[dayKey] || []
            const today = isSameDay(day, new Date())
            return (
              <section key={dayKey} className="min-h-[520px] bg-white dark:bg-slate-900">
                <div className={`border-b border-slate-200 px-3 py-3 text-center dark:border-slate-800 ${today ? 'bg-brand-50/70 dark:bg-brand-900/20' : 'bg-slate-50/70 dark:bg-slate-900'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}`}>
                    {WEEKDAYS[day.getDay()]}
                  </p>
                  <p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${today ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                    {day.getDate()}
                  </p>
                </div>
                <DropArea
                  targetKey={targetKey}
                  createDate={dateWithHour(day, 9)}
                  active={dropTarget === targetKey}
                  onDragOver={onDragOver}
                  onDrop={(postId) => onMove(postId, day)}
                  onCreatePost={onCreatePost}
                  onCreatePlanner={onCreatePlanner}
                  plannerBusyDate={plannerBusyDate}
                  className="min-h-[444px] space-y-2 p-2"
                >
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} onOpen={onOpen} onDragEnd={onDragEnd} busy={busyPostId === post.id} />
                  ))}
                  {posts.length === 0 && (
                    <p className="pointer-events-none px-1 py-4 text-center text-xs text-slate-400">Drop posts here</p>
                  )}
                </DropArea>
              </section>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function MonthView({ cursor, start, postsByDay, onOpen, onMove, onDragOver, onDragEnd, onCreatePost, onCreatePlanner, dropTarget, busyPostId, plannerBusyDate }) {
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index))

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            {WEEKDAYS.map((day) => <div key={day} className="py-3">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = fmt(day)
              const targetKey = `month:${key}`
              const items = postsByDay[key] || []
              const inMonth = day.getMonth() === cursor.getMonth()
              const today = isSameDay(day, new Date())
              return (
                <DropArea
                  key={key}
                  targetKey={targetKey}
                  createDate={dateWithHour(day, 9)}
                  active={dropTarget === targetKey}
                  onDragOver={onDragOver}
                  onDrop={(postId) => onMove(postId, day)}
                  onCreatePost={onCreatePost}
                  onCreatePlanner={onCreatePlanner}
                  plannerBusyDate={plannerBusyDate}
                  className={`min-h-32 border-b border-r border-slate-100 p-2 last:border-r-0 dark:border-slate-800 ${
                    inMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-950/50'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400">{items.length > 0 ? postCountLabel(items.length) : ''}</span>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      today
                        ? 'bg-brand-600 text-white'
                        : inMonth ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'
                    }`}>
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {items.slice(0, 3).map((post) => (
                      <PostCard key={post.id} post={post} compact onOpen={onOpen} onDragEnd={onDragEnd} busy={busyPostId === post.id} />
                    ))}
                    {items.length > 3 && (
                      <button
                        type="button"
                        onClick={() => onOpen(items[3])}
                        className="px-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                      >
                        +{items.length - 3} more
                      </button>
                    )}
                  </div>
                </DropArea>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function DropArea({ targetKey, createDate, active, onDragOver, onDrop, onCreatePost, onCreatePlanner, plannerBusyDate, className, children }) {
  const createKey = createDate?.toISOString()

  return (
    <div
      className={`${className} group relative transition ${active ? 'bg-brand-100/70 ring-2 ring-inset ring-brand-400 dark:bg-brand-900/30' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOver(targetKey)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(Number(event.dataTransfer.getData('application/x-post-id')))
        onDragOver(null)
      }}
    >
      {createDate && (
        <div className="absolute right-2 top-2 z-10 flex translate-y-1 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onCreatePlanner(createDate)
            }}
            disabled={plannerBusyDate === createKey}
            className="rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:text-brand-300"
          >
            Create planner
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onCreatePost(createDate)
            }}
            className="rounded-full bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Create post
          </button>
        </div>
      )}
      {children}
    </div>
  )
}

function PostCard({ post, compact = false, detailed = false, onOpen, onDragEnd, busy = false }) {
  const content = post.title || post.content || 'Untitled post'
  const variants = post.variants || []
  const draggable = canReschedule(post) && !busy
  const didDrag = useRef(false)
  const planner = post.kind === 'planner'

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        didDrag.current = true
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/x-post-id', String(post.id))
      }}
      onDragEnd={() => {
        onDragEnd()
        window.setTimeout(() => { didDrag.current = false }, 0)
      }}
      onClick={() => {
        if (!didDrag.current) onOpen(post)
      }}
      className={`w-full rounded-lg border text-left text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-slate-200 ${
        planner
          ? 'border-indigo-100 bg-indigo-50/80 hover:border-indigo-300 hover:bg-indigo-100/80 dark:border-indigo-900/60 dark:bg-indigo-900/20 dark:hover:border-indigo-700'
          : 'border-brand-100 bg-brand-50/80 hover:border-brand-300 hover:bg-brand-100/80 dark:border-brand-900/60 dark:bg-brand-900/20 dark:hover:border-brand-700'
      } ${
        detailed ? 'flex items-center gap-3 px-3 py-2.5' : compact ? 'px-2 py-1.5' : 'p-2.5'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${busy ? 'opacity-50' : ''}`}
      title={draggable ? 'Click for details. Drag to reschedule.' : 'Click for details.'}
    >
      {!compact && (
        <GripVertical className={`h-4 w-4 shrink-0 text-brand-300 ${detailed ? '' : 'float-right ml-1'} ${draggable ? '' : 'opacity-0'}`} />
      )}
      <div className={detailed ? 'w-16 shrink-0' : 'flex items-center justify-between gap-1'}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-300">
          <Clock3 className="h-3 w-3" /> {formatTime(post.scheduled_at)}
        </span>
        {!detailed && <StatusBadge post={post} compact />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${compact ? 'text-[11px]' : 'text-xs'}`}>{content}</p>
        {!compact && (
          <div className="mt-1.5 flex items-center gap-1">
            {planner ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
                <FileText className="h-3 w-3" /> Planner
              </span>
            ) : (
              <>
                {variants.slice(0, 3).map((variant) => (
                  <PlatformBadge key={variant.id} platform={variant.platform} size="xs" />
                ))}
                {variants.length > 3 && <span className="text-[10px] text-slate-400">+{variants.length - 3}</span>}
              </>
            )}
            {detailed && post.status_label && (
              <span className="ml-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {post.status_label}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}

function PostDetailsModal({ post, action, onClose, onSave, onDelete }) {
  const [scheduledAt, setScheduledAt] = useState(() => post.scheduled_at ? toLocalDateTimeInput(post.scheduled_at) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editable = canReschedule(post)
  const planner = post.kind === 'planner'
  const deletable = !planner && post.status !== 'publishing'

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !action) onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [action, onClose])

  const submit = (event) => {
    event.preventDefault()
    const date = new Date(scheduledAt)
    if (!Number.isNaN(date.getTime())) onSave(date)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !action && onClose()}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="dialog" aria-modal="true" aria-labelledby="post-details-title">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <h2 id="post-details-title" className="truncate text-lg font-bold text-slate-900 dark:text-white">
                {post.title || (planner ? 'Planner details' : 'Post details')}
              </h2>
              <StatusBadge post={post} />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{planner ? 'Planner note' : `Post #${post.id}`}</p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(action)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close details">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Content</p>
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
              {post.content || 'No text content.'}
            </p>
          </div>

          {planner && (
            <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
              <FileText className="h-4 w-4" /> Planner note
            </div>
          )}

          {!planner && (post.variants || []).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Platforms</p>
              <div className="flex flex-wrap gap-2">
                {post.variants.map((variant) => (
                  <div key={variant.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <PlatformBadge platform={variant.platform} size="xs" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {variant.social_account?.name || variant.platform}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(post.media || []).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Media</p>
              <div className="grid grid-cols-3 gap-2">
                {post.media.slice(0, 3).map((item) => (
                  <img key={item.id} src={item.thumbnail_url || item.url} alt={item.original_name || 'Post media'} className="h-24 w-full rounded-xl bg-slate-100 object-cover dark:bg-slate-800" />
                ))}
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <CalendarClock className="h-4 w-4" /> Scheduled date and time
              </span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                disabled={!editable || Boolean(action)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            {!editable && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {planner ? 'Planner notes are shown on the calendar from their saved planner date.' : 'Published or currently publishing posts cannot be rescheduled.'}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {!deletable ? null : !confirmDelete ? (
                  <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" onClick={() => setConfirmDelete(true)} disabled={!deletable || Boolean(action)}>
                    <Trash2 className="h-4 w-4" /> Delete post
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Delete permanently?</span>
                    <Button type="button" variant="danger" size="sm" loading={action === 'delete'} onClick={onDelete}>Delete</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={Boolean(action)}>Cancel</Button>
                  </div>
                )}
              </div>
              <Button type="submit" loading={action === 'save'} disabled={!editable || Boolean(action)}>
                Save date and time
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ post, compact = false }) {
  const colors = {
    draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    note: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    approved: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    scheduled: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    publishing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  }

  return (
    <span
      className={`shrink-0 rounded-full font-semibold ${
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
      } ${colors[post.status] || colors.draft}`}
    >
      {post.status_label || post.status}
    </span>
  )
}

function canReschedule(post) {
  return post.kind !== 'planner' && Boolean(post.scheduled_at) && !LOCKED_STATUSES.includes(post.status)
}

function getRange(cursor, view) {
  if (view === 'day') {
    const day = startOfDay(cursor)
    return {
      start: day,
      end: day,
      label: day.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    }
  }

  if (view === 'week') {
    const start = startOfWeek(cursor)
    const end = addDays(start, 6)
    return { start, end, label: formatWeekLabel(start, end) }
  }

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = startOfWeek(monthStart)
  return {
    start,
    end: addDays(start, 41),
    label: cursor.toLocaleDateString('default', { month: 'long', year: 'numeric' }),
  }
}

function groupByHour(posts) {
  return posts.reduce((grouped, post) => {
    if (!post.scheduled_at) return grouped
    const hour = new Date(post.scheduled_at).getHours()
    ;(grouped[hour] ||= []).push(post)
    return grouped
  }, {})
}

function formatWeekLabel(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${start.toLocaleDateString('default', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${start.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatHour(hour) {
  return new Date(2000, 0, 1, hour).toLocaleTimeString('default', { hour: 'numeric' })
}

function formatTime(value) {
  if (!value) return 'No time'
  return new Date(value).toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })
}

function toLocalDateTimeInput(value) {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function postCountLabel(count) {
  return `${count} item${count === 1 ? '' : 's'}`
}

function comparePosts(a, b) {
  const aDate = new Date(a.scheduled_at || a.updated_at || a.created_at).getTime()
  const bDate = new Date(b.scheduled_at || b.updated_at || b.created_at).getTime()
  return aDate - bDate
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date) {
  const day = startOfDay(date)
  day.setDate(day.getDate() - day.getDay())
  return day
}

function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function dateWithHour(date, hour) {
  const next = new Date(date)
  next.setHours(hour, 0, 0, 0)
  return next
}

function isSameDay(a, b) {
  return fmt(a) === fmt(b)
}

function fmt(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function noteToCalendarItem(note) {
  return {
    uid: `planner-${note.id}`,
    id: note.id,
    kind: 'planner',
    title: note.title,
    content: note.excerpt || note.content_text || '',
    status: 'note',
    status_label: 'Planner note',
    scheduled_at: note.meta?.scheduled_at || null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    variants: [],
    media: [],
  }
}

function calendarGroupFor(item) {
  if (item.kind === 'planner') return 'pending'
  if (['draft', 'pending_approval'].includes(item.status)) return 'pending'
  if (['approved', 'scheduled', 'publishing'].includes(item.status)) return 'progress'
  if (['published', 'failed', 'cancelled'].includes(item.status)) return 'completed'
  return 'pending'
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
