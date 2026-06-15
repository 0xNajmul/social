import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Columns3,
  FileText,
  ListFilter,
  Plus,
  Search,
  Settings2,
  Table2,
  Timeline,
  UserRound,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import PlatformBadge from '../components/PlatformBadge'
import { Badge, Button, Card, EmptyState, Modal, PageLoader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import Calendar from './Calendar'

const GROUPS = {
  pending: {
    label: 'Pending',
    statuses: ['draft', 'pending_approval', 'note'],
    color: 'amber',
    icon: CircleDashed,
    dot: 'bg-amber-500',
    panel: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20',
  },
  progress: {
    label: 'Progress',
    statuses: ['approved', 'scheduled', 'publishing'],
    color: 'indigo',
    icon: Clock3,
    dot: 'bg-indigo-500',
    panel: 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/60 dark:bg-indigo-950/20',
  },
  completed: {
    label: 'Completed',
    statuses: ['published', 'failed', 'cancelled'],
    color: 'emerald',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    panel: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20',
  },
}

const FILTERS = [
  { key: 'all', label: 'All', icon: ListFilter, color: 'brand' },
  ...Object.entries(GROUPS).map(([key, value]) => ({ key, label: value.label, icon: value.icon, color: value.color })),
]
const DRAWER_FILTERS = [...FILTERS, { key: 'custom', label: 'Custom', icon: ListFilter, color: 'brand' }]
const VIEWS = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'board', label: 'Kanban', icon: Columns3 },
  { key: 'timeline', label: 'Timeline', icon: Timeline },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
]
const VALID_VIEWS = VIEWS.map((view) => view.key)
const VALID_FILTERS = DRAWER_FILTERS.map((filter) => filter.key)
const DEFAULT_VISIBLE_VIEWS = [...VALID_VIEWS]

export default function Organizer() {
  const { activeWorkspace } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState(null)
  const [plannerNotes, setPlannerNotes] = useState([])
  const [filter, setFilter] = useState(() => validParam(searchParams.get('filter'), VALID_FILTERS, 'all'))
  const [view, setView] = useState(() => {
    const fromUrl = validParam(searchParams.get('view'), VALID_VIEWS, null)
    const saved = validParam(localStorage.getItem('organizer_view'), VALID_VIEWS, 'table')
    return fromUrl || saved
  })
  const [visibleViews, setVisibleViews] = useState(() => readVisibleViews())
  const [showPlannerData, setShowPlannerData] = useState(() => localStorage.getItem('organizer_show_planner_data') !== 'false')
  const [showSocialData, setShowSocialData] = useState(() => localStorage.getItem('organizer_show_social_data') !== 'false')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [reviewBusy, setReviewBusy] = useState('')

  const syncOrganizerUrl = (nextView, nextFilter) => {
    const params = new URLSearchParams(searchParams)
    params.set('view', nextView)
    params.set('filter', nextFilter)
    setSearchParams(params, { replace: true })
  }

  const changeView = (nextView) => {
    if (!VALID_VIEWS.includes(nextView)) return
    setView(nextView)
    localStorage.setItem('organizer_view', nextView)
    syncOrganizerUrl(nextView, filter)
  }

  const changeFilter = (nextFilter) => {
    if (!VALID_FILTERS.includes(nextFilter)) return
    setFilter(nextFilter)
    syncOrganizerUrl(view, nextFilter)
  }

  const openComposerModal = () => {
    window.dispatchEvent(new CustomEvent('postflow:quick-action', { detail: { type: 'composer' } }))
  }

  const toggleVisibleView = (viewKey) => {
    setVisibleViews((current) => {
      if (current.includes(viewKey) && current.length === 1) return current
      const next = current.includes(viewKey)
        ? current.filter((item) => item !== viewKey)
        : [...current, viewKey]
      return VIEWS.filter((item) => next.includes(item.key)).map((item) => item.key)
    })
  }

  useEffect(() => {
    let active = true
    Promise.allSettled([
      api.get('/posts', { params: { per_page: 100 } }),
      api.get('/planner-notes', { params: { limit: 100 } }),
    ]).then(([postsResult, notesResult]) => {
      if (!active) return

      if (postsResult.status === 'fulfilled') {
        setPosts(postsResult.value.data.data || [])
      } else {
        setPosts([])
        setError('Could not load your posting plan.')
      }

      if (notesResult.status === 'fulfilled') {
        setPlannerNotes(notesResult.value.data.data || [])
      } else {
        setPlannerNotes([])
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const nextView = validParam(searchParams.get('view'), VALID_VIEWS, null)
    const nextFilter = validParam(searchParams.get('filter'), VALID_FILTERS, null)

    if (nextView && nextView !== view && visibleViews.includes(nextView)) setView(nextView)
    if (nextFilter && nextFilter !== filter) setFilter(nextFilter)
  }, [filter, searchParams, view, visibleViews])

  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    let changed = false

    if (!validParam(params.get('view'), VALID_VIEWS, null)) {
      params.set('view', view)
      changed = true
    }
    if (!validParam(params.get('filter'), VALID_FILTERS, null)) {
      params.set('filter', filter)
      changed = true
    }

    if (changed) setSearchParams(params, { replace: true })
  }, [])

  useEffect(() => {
    localStorage.setItem('organizer_visible_views', JSON.stringify(visibleViews))
    if (!visibleViews.includes(view)) {
      changeView(visibleViews[0] || 'table')
    }
  }, [visibleViews])

  useEffect(() => {
    localStorage.setItem('organizer_show_planner_data', String(showPlannerData))
  }, [showPlannerData])

  useEffect(() => {
    localStorage.setItem('organizer_show_social_data', String(showSocialData))
  }, [showSocialData])

  const organizerItems = useMemo(() => {
    const socialItems = (posts || []).map((post) => ({ ...post, kind: 'post' }))
    const planItems = plannerNotes.map(noteToOrganizerItem)

    return [
      ...(showSocialData ? socialItems : []),
      ...(showPlannerData ? planItems : []),
    ]
  }, [plannerNotes, posts, showPlannerData, showSocialData])

  const counts = useMemo(() => ({
    all: organizerItems.length,
    ...Object.fromEntries(Object.keys(GROUPS).map((key) => [key, organizerItems.filter((item) => groupFor(item) === key).length])),
  }), [organizerItems])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return organizerItems
      .filter((item) => filter === 'all' || filter === 'custom' || groupFor(item) === filter)
      .filter((item) => !query || `${item.title || ''} ${item.content || ''} ${item.author?.name || ''} ${item.status_label || ''}`.toLowerCase().includes(query))
      .sort(compareItems)
  }, [filter, organizerItems, search])

  const reviewPost = async (post, decision) => {
    if (post.kind === 'planner') return

    setReviewBusy(`${decision}-${post.id}`)
    setError('')
    try {
      await api.post(`/posts/${post.id}/review`, { decision })
      const { data } = await api.get('/posts', { params: { per_page: 100 } })
      setPosts(data.data || [])
    } catch (reviewError) {
      setError(reviewError.response?.data?.message || 'Could not review this post.')
    } finally {
      setReviewBusy('')
    }
  }

  const canApprove = ['owner', 'admin', 'manager'].includes(activeWorkspace?.role)
  const visibleViewOptions = VIEWS.filter((item) => visibleViews.includes(item.key))

  if (!posts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Organizer</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track posts and planner notes in table, Kanban, timeline, and calendar views.</p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <div className="flex flex-wrap rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {FILTERS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => changeFilter(item.key)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                    filter === item.key
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  <span className={clsx('rounded-full px-2 py-0.5 text-xs', filter === item.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{counts[item.key]}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={openComposerModal}><Plus className="h-4 w-4" /> Create post</Button>
            <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)} aria-label="Open organizer settings">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts, notes, or authors..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {visibleViewOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => changeView(item.key)}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition lg:flex-none',
                  view === item.key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">{error}</div>}

        {view === 'calendar' ? (
          <div className="p-4">
            <Calendar
              embedded
              filter={filter}
              plannerNotes={plannerNotes}
              showPlannerData={showPlannerData}
              showSocialData={showSocialData}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarClock}
              title="No organizer items found"
              description={search ? 'Try a different search or status filter.' : 'Create a post or planner note to start filling the organizer.'}
              action={!search && <Button type="button" size="sm" onClick={openComposerModal}><Plus className="h-4 w-4" /> Create post</Button>}
            />
          </div>
        ) : (
          <>
            {view === 'table' && <TableView items={filteredItems} canApprove={canApprove} onOpen={setSelectedItem} onReview={reviewPost} reviewBusy={reviewBusy} />}
            {view === 'board' && <BoardView items={filteredItems} filter={filter} canApprove={canApprove} onOpen={setSelectedItem} onReview={reviewPost} reviewBusy={reviewBusy} />}
            {view === 'timeline' && <TimelineView items={filteredItems} canApprove={canApprove} onOpen={setSelectedItem} onReview={reviewPost} reviewBusy={reviewBusy} />}
          </>
        )}
      </Card>

      <OrganizerSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        visibleViews={visibleViews}
        onToggleView={toggleVisibleView}
        showPlannerData={showPlannerData}
        showSocialData={showSocialData}
        onTogglePlannerData={() => setShowPlannerData((current) => !current)}
        onToggleSocialData={() => setShowSocialData((current) => !current)}
        filter={filter}
        onFilterChange={changeFilter}
      />

      <OrganizerItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  )
}

function TableView({ items, canApprove, onOpen, onReview, reviewBusy }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Item</th>
            <th className="px-5 py-3 font-semibold">Stage</th>
            <th className="px-5 py-3 font-semibold">Source</th>
            <th className="px-5 py-3 font-semibold">Owner</th>
            <th className="px-5 py-3 font-semibold">Schedule</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <tr
              key={item.uid || item.id}
              onClick={() => onOpen(item)}
              className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              <td className="max-w-md px-5 py-4"><PostTitle post={item} /></td>
              <td className="px-5 py-4"><StageBadges post={item} /><ReviewActions post={item} canApprove={canApprove} onReview={onReview} reviewBusy={reviewBusy} /></td>
              <td className="px-5 py-4"><Platforms post={item} /></td>
              <td className="px-5 py-4"><Owner post={item} /></td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{planDate(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BoardView({ items, filter, canApprove, onOpen, onReview, reviewBusy }) {
  const columns = filter === 'all' || filter === 'custom' ? Object.keys(GROUPS) : [filter]
  return (
    <div className={clsx('grid gap-4 overflow-x-auto p-4', columns.length === 3 ? 'lg:grid-cols-3' : 'grid-cols-1')}>
      {columns.map((key) => {
        const meta = GROUPS[key]
        const columnItems = items.filter((item) => groupFor(item) === key)
        return (
          <section key={key} className={clsx('min-w-0 rounded-2xl border p-3', meta.panel)}>
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={clsx('h-2.5 w-2.5 rounded-full', meta.dot)} />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{meta.label}</h2>
              </div>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{columnItems.length}</span>
            </div>
            <div className="space-y-3">
              {columnItems.map((item) => <PlannerCard key={item.uid || item.id} post={item} canApprove={canApprove} onOpen={onOpen} onReview={onReview} reviewBusy={reviewBusy} />)}
              {columnItems.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700">No items in this stage</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TimelineView({ items, canApprove, onOpen, onReview, reviewBusy }) {
  return (
    <div className="p-5 sm:p-6">
      <div className="relative ml-3 border-l-2 border-slate-200 pl-7 dark:border-slate-700">
        {items.map((item) => {
          const meta = GROUPS[groupFor(item)]
          return (
            <div key={item.uid || item.id} className="relative pb-7 last:pb-0">
              <span className={clsx('absolute -left-[36px] top-1.5 h-4 w-4 rounded-full border-4 border-white dark:border-slate-900', meta.dot)} />
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{planDate(item)}</p>
              <PlannerCard post={item} compact canApprove={canApprove} onOpen={onOpen} onReview={onReview} reviewBusy={reviewBusy} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlannerCard({ post, compact = false, canApprove, onOpen, onReview, reviewBusy }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(post)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(post)
      }}
      className={clsx(
        'cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-800',
        compact ? 'p-4' : 'p-3.5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <PostTitle post={post} />
        <StageBadges post={post} showGroup={false} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Platforms post={post} />
        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-400"><CalendarClock className="h-3.5 w-3.5" /> {planDate(post, true)}</span>
      </div>
      <ReviewActions post={post} canApprove={canApprove} onReview={onReview} reviewBusy={reviewBusy} />
    </div>
  )
}

function ReviewActions({ post, canApprove, onReview, reviewBusy }) {
  if (post.kind === 'planner' || !canApprove || post.status !== 'pending_approval') return null
  return (
    <div className="mt-3 flex gap-2" onClick={(event) => event.stopPropagation()}>
      <Button size="sm" loading={reviewBusy === `approved-${post.id}`} disabled={Boolean(reviewBusy)} onClick={() => onReview(post, 'approved')}><Check className="h-3.5 w-3.5" /> Approve</Button>
      <Button size="sm" variant="secondary" loading={reviewBusy === `rejected-${post.id}`} disabled={Boolean(reviewBusy)} onClick={() => onReview(post, 'rejected')}><X className="h-3.5 w-3.5" /> Reject</Button>
    </div>
  )
}

function PostTitle({ post }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-slate-900 dark:text-white">{post.title || contentTitle(post.content)}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{post.content || 'No content yet.'}</p>
    </div>
  )
}

function StageBadges({ post, showGroup = true }) {
  const group = GROUPS[groupFor(post)]
  return (
    <div className="flex flex-wrap gap-1.5">
      {showGroup && <Badge color={group.color}>{group.label}</Badge>}
      <Badge color={post.status_color || group.color}>{post.status_label || post.status}</Badge>
    </div>
  )
}

function Platforms({ post }) {
  if (post.kind === 'planner') {
    return <Badge color="indigo"><FileText className="mr-1 h-3 w-3" /> Planner</Badge>
  }

  const variants = post.variants || []
  if (!variants.length) return <span className="text-xs text-slate-400">No channels</span>
  return (
    <div className="flex items-center -space-x-1.5">
      {variants.slice(0, 4).map((variant) => <PlatformBadge key={variant.id} platform={variant.platform} size="xs" className="ring-2 ring-white dark:ring-slate-900" />)}
      {variants.length > 4 && <span className="ml-2 text-xs font-medium text-slate-500">+{variants.length - 4}</span>}
    </div>
  )
}

function Owner({ post }) {
  return (
    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      {post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><UserRound className="h-3.5 w-3.5" /></span>}
      <span className="max-w-32 truncate text-xs font-medium">{post.author?.name || 'Unknown'}</span>
    </div>
  )
}

function OrganizerSettingsDrawer({
  open,
  onClose,
  visibleViews,
  onToggleView,
  showPlannerData,
  showSocialData,
  onTogglePlannerData,
  onToggleSocialData,
  filter,
  onFilterChange,
}) {
  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  return (
    <div className={clsx('fixed inset-0 z-50 transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button
        type="button"
        className={clsx('absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        aria-label="Close organizer settings"
      />
      <aside className={clsx(
        'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Organizer settings</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose visible views and which data appears on this page.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Visible view tabs</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hide or show Table, Kanban, Timeline, and Calendar tabs.</p>
            <div className="mt-3 grid gap-2">
              {VIEWS.map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <Icon className="h-4 w-4 text-slate-400" /> {label}
                  </span>
                  <input
                    type="checkbox"
                    checked={visibleViews.includes(key)}
                    onChange={() => onToggleView(key)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Data sources</h3>
            <SwitchRow label="Show planner data" description="Include saved plans and notes in every organizer view." checked={showPlannerData} onChange={onTogglePlannerData} />
            <SwitchRow label="Show social posting data" description="Include posts from composer, queues, and publishing workflows." checked={showSocialData} onChange={onToggleSocialData} />
          </section>

          <section>
            <label className="block">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Status filter</span>
              <select
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {DRAWER_FILTERS.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">This filter is reflected across table, Kanban, timeline, and calendar views.</p>
          </section>
        </div>
      </aside>
    </div>
  )
}

function SwitchRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700')}
      >
        <span className={clsx('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  )
}

function OrganizerItemModal({ item, onClose }) {
  if (!item) return null

  const isPlanner = item.kind === 'planner'

  return (
    <Modal
      open={Boolean(item)}
      title={item.title || (isPlanner ? 'Planner details' : 'Post details')}
      description={`${isPlanner ? 'Planner note' : 'Post'} details and schedule information.`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <StageBadges post={item} />
          <Platforms post={item} />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Content</p>
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
            {item.content || 'No content yet.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailBox label="Owner" value={item.author?.name || 'Unknown'} />
          <DetailBox label="Date" value={planDate(item)} />
          <DetailBox label="Source" value={isPlanner ? 'Planner' : 'Social post'} />
          <DetailBox label="Status" value={item.status_label || item.status || 'Unknown'} />
        </div>

        {!isPlanner && (item.variants || []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Platforms</p>
            <div className="flex flex-wrap gap-2">
              {item.variants.map((variant) => (
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
      </div>
    </Modal>
  )
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  )
}

function noteToOrganizerItem(note) {
  return {
    uid: `planner-${note.id}`,
    id: note.id,
    kind: 'planner',
    title: note.title,
    content: note.excerpt || note.content_text || '',
    status: 'note',
    status_label: 'Planner note',
    status_color: 'indigo',
    author: note.author,
    scheduled_at: note.meta?.scheduled_at || null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    variants: [],
    note,
  }
}

function groupFor(post) {
  if (post.kind === 'planner') return 'pending'
  return Object.keys(GROUPS).find((key) => GROUPS[key].statuses.includes(post.status)) || 'pending'
}

function compareItems(a, b) {
  const aDate = new Date(a.scheduled_at || a.published_at || a.updated_at || a.created_at).getTime()
  const bDate = new Date(b.scheduled_at || b.published_at || b.updated_at || b.created_at).getTime()
  return aDate - bDate
}

function planDate(post, short = false) {
  const value = post.scheduled_at || post.published_at || post.updated_at || post.created_at
  if (!value) return 'No date'
  return new Date(value).toLocaleString('default', short
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function contentTitle(content = '') {
  const clean = String(content ?? '').trim()
  return clean ? `${clean.slice(0, 54)}${clean.length > 54 ? '...' : ''}` : 'Untitled post'
}

function validParam(value, validValues, fallback) {
  return validValues.includes(value) ? value : fallback
}

function readVisibleViews() {
  try {
    const parsed = JSON.parse(localStorage.getItem('organizer_visible_views') || '[]')
    const visible = Array.isArray(parsed) ? parsed.filter((key) => VALID_VIEWS.includes(key)) : []
    return visible.length ? visible : DEFAULT_VISIBLE_VIEWS
  } catch {
    return DEFAULT_VISIBLE_VIEWS
  }
}
