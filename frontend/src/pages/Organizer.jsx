import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Search,
  Table2,
  Timeline,
  UserRound,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import PlatformBadge from '../components/PlatformBadge'
import { Badge, Button, Card, EmptyState, PageLoader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import Calendar from './Calendar'
import DateTimeField from '../components/DateTimeField'
import PostDetailsModal from '../components/posts/PostDetailsModal'
import PlanEditorModal from '../components/planner/PlanEditorModal'
import { DATA_CHANGED_EVENT, broadcastDataChanged } from '../lib/appEvents'
import { HOLIDAY_COUNTRIES, HOLIDAY_SOURCE_GROUPS, normalizeHolidaySettings } from '../lib/holidays'
import useInfiniteList from '../hooks/useInfiniteList'
import usePageSize from '../hooks/usePageSize'

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
    label: 'Processing',
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
const GROUP_STATUS = { pending: 'draft', progress: 'approved', completed: 'published' }

export default function Organizer() {
  const { activeWorkspace } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const postPageSize = usePageSize('organizer_posts', 30)
  const plannerPageSize = usePageSize('planner_notes', 24)
  const [posts, setPosts] = useState(null)
  const [postMeta, setPostMeta] = useState(null)
  const [plannerNotes, setPlannerNotes] = useState([])
  const [plannerMeta, setPlannerMeta] = useState(null)
  const [loadingMoreOrganizer, setLoadingMoreOrganizer] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [filter, setFilter] = useState(() => validParam(searchParams.get('filter'), VALID_FILTERS, 'all'))
  const [selectedGroups, setSelectedGroups] = useState(() => {
    const fromUrl = validParam(searchParams.get('filter'), VALID_FILTERS, 'all')
    return fromUrl === 'all' || fromUrl === 'custom' ? ['all'] : [fromUrl]
  })
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
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('organizer_sort_order') || 'desc')
  const [approvalFilter, setApprovalFilter] = useState('both')
  const [selectedAccountIds, setSelectedAccountIds] = useState([])
  const [selectedCategories, setSelectedCategories] = useState([])
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [holidaySettings, setHolidaySettings] = useState(() => readHolidaySettings())
  const [error, setError] = useState('')
  const [reviewBusy, setReviewBusy] = useState('')
  const [dragBusy, setDragBusy] = useState('')

  const loadOrganizerData = useCallback((page = 1, append = false) => {
    let active = true
    if (append) setLoadingMoreOrganizer(true)
    Promise.allSettled([
      api.get('/posts', { params: { per_page: postPageSize, page } }),
      api.get('/planner-notes', { params: { per_page: plannerPageSize, page } }),
      api.get('/social/accounts'),
    ]).then(([postsResult, notesResult, accountsResult]) => {
      if (!active) return

      if (postsResult.status === 'fulfilled') {
        const nextPosts = postsResult.value.data.data || []
        setPosts((current) => append ? [...(current || []), ...nextPosts] : nextPosts)
        setPostMeta(postsResult.value.data.meta || null)
      } else {
        if (!append) {
          setPosts([])
          setPostMeta(null)
          setError('Could not load your posting plan.')
        }
      }

      if (notesResult.status === 'fulfilled') {
        const nextNotes = notesResult.value.data.data || []
        setPlannerNotes((current) => append ? [...(current || []), ...nextNotes] : nextNotes)
        setPlannerMeta(notesResult.value.data.meta || null)
      } else {
        if (!append) {
          setPlannerNotes([])
          setPlannerMeta(null)
        }
      }

      if (accountsResult.status === 'fulfilled') {
        setAccounts(accountsResult.value.data.data || [])
      } else {
        setAccounts([])
      }
    }).finally(() => {
      if (append && active) setLoadingMoreOrganizer(false)
    })
    return () => { active = false }
  }, [plannerPageSize, postPageSize])

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
    setSelectedGroups(nextFilter === 'all' || nextFilter === 'custom' ? ['all'] : [nextFilter])
    syncOrganizerUrl(view, nextFilter)
  }

  const changeGroups = (nextGroups) => {
    const normalized = nextGroups.length === 0 || nextGroups.includes('all') ? ['all'] : nextGroups.filter((key) => Object.keys(GROUPS).includes(key))
    setSelectedGroups(normalized)
    const nextFilter = normalized.length === 1 ? normalized[0] : 'custom'
    setFilter(nextFilter)
    syncOrganizerUrl(view, nextFilter)
  }

  const toggleAccountFilter = (id) => {
    setSelectedAccountIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
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
    let cancelInitial
    const initialTimer = window.setTimeout(() => {
      cancelInitial = loadOrganizerData()
    }, 0)
    const refresh = () => loadOrganizerData()
    const interval = window.setInterval(refresh, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, refresh)
    window.addEventListener('postflow:refresh-organizer', refresh)
    return () => {
      window.clearTimeout(initialTimer)
      cancelInitial?.()
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, refresh)
      window.removeEventListener('postflow:refresh-organizer', refresh)
    }
  }, [loadOrganizerData])

  useEffect(() => {
    const nextView = validParam(searchParams.get('view'), VALID_VIEWS, null)
    const nextFilter = validParam(searchParams.get('filter'), VALID_FILTERS, null)
    if ((!nextView || nextView === view || !visibleViews.includes(nextView)) && (!nextFilter || nextFilter === filter)) return undefined

    const timer = window.setTimeout(() => {
      if (nextView && nextView !== view && visibleViews.includes(nextView)) setView(nextView)
      if (nextFilter && nextFilter !== filter) {
        setFilter(nextFilter)
        if (nextFilter !== 'custom') setSelectedGroups(nextFilter === 'all' ? ['all'] : [nextFilter])
      }
    }, 0)

    return () => window.clearTimeout(timer)
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
  }, [filter, searchParams, setSearchParams, view])

  useEffect(() => {
    localStorage.setItem('organizer_visible_views', JSON.stringify(visibleViews))
    if (visibleViews.includes(view)) return undefined

    const nextView = visibleViews[0] || 'table'
    const timer = window.setTimeout(() => {
      setView(nextView)
      localStorage.setItem('organizer_view', nextView)
      const params = new URLSearchParams(searchParams)
      params.set('view', nextView)
      params.set('filter', filter)
      setSearchParams(params, { replace: true })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [filter, searchParams, setSearchParams, view, visibleViews])

  useEffect(() => {
    localStorage.setItem('organizer_show_planner_data', String(showPlannerData))
  }, [showPlannerData])

  useEffect(() => {
    localStorage.setItem('organizer_show_social_data', String(showSocialData))
  }, [showSocialData])

  useEffect(() => {
    localStorage.setItem('organizer_sort_order', sortOrder)
  }, [sortOrder])

  useEffect(() => {
    if (!activeWorkspace || localStorage.getItem('organizer_holiday_settings')) return undefined
    const timer = window.setTimeout(() => {
      setHolidaySettings(normalizeHolidaySettings({
        workspaceCountry: activeWorkspace.settings?.workspace_country,
        audienceCountries: activeWorkspace.settings?.audience_countries,
      }))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeWorkspace])

  useEffect(() => {
    localStorage.setItem('organizer_holiday_settings', JSON.stringify(holidaySettings))
  }, [holidaySettings])

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

  const availableCategories = useMemo(() => {
    const categories = new Set()
    organizerItems.forEach((item) => getItemCategories(item).forEach((category) => categories.add(category)))
    return [...categories].sort((a, b) => a.localeCompare(b))
  }, [organizerItems])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return organizerItems
      .filter((item) => selectedGroups.includes('all') || selectedGroups.includes(groupFor(item)))
      .filter((item) => approvalMatches(item, approvalFilter))
      .filter((item) => accountMatches(item, selectedAccountIds))
      .filter((item) => categoryMatches(item, selectedCategories))
      .filter((item) => dateRangeMatches(item, dateFilter))
      .filter((item) => !query || `${item.title || ''} ${item.content || ''} ${item.author?.name || ''} ${item.status_label || ''}`.toLowerCase().includes(query))
      .sort((a, b) => compareItems(a, b, sortOrder))
  }, [approvalFilter, dateFilter, organizerItems, search, selectedAccountIds, selectedCategories, selectedGroups, sortOrder])
  const hasServerMore = Boolean(
    (postMeta && postMeta.current_page < postMeta.last_page)
      || (plannerMeta && plannerMeta.current_page < plannerMeta.last_page),
  )
  const loadMoreOrganizer = useCallback(() => {
    if (!hasServerMore || loadingMoreOrganizer) return
    const nextPostPage = postMeta?.current_page || 1
    const nextPlannerPage = plannerMeta?.current_page || 1
    loadOrganizerData(Math.max(nextPostPage, nextPlannerPage) + 1, true)
  }, [hasServerMore, loadOrganizerData, loadingMoreOrganizer, plannerMeta, postMeta])
  const { hasMore, items: pagedItems, sentinelRef } = useInfiniteList(filteredItems, {
    pageSize: Math.max(postPageSize, plannerPageSize),
    hasExternalMore: hasServerMore,
    externalLoading: loadingMoreOrganizer,
    onEndReached: loadMoreOrganizer,
    resetKey: [
      search,
      filter,
      selectedGroups.join('|'),
      approvalFilter,
      selectedAccountIds.join('|'),
      selectedCategories.join('|'),
      dateFilter.from,
      dateFilter.to,
      sortOrder,
      showPlannerData,
      showSocialData,
    ].join('::'),
  })

  const reviewPost = async (post, decision) => {
    if (post.kind === 'planner') return

    setReviewBusy(`${decision}-${post.id}`)
    setError('')
    try {
      await api.post(`/posts/${post.id}/review`, { decision })
      const { data } = await api.get('/posts', { params: { per_page: postPageSize } })
      setPosts(data.data || [])
      setPostMeta(data.meta || null)
      broadcastDataChanged({ resource: 'posts', action: 'reviewed', item: post })
    } catch (reviewError) {
      setError(reviewError.response?.data?.message || 'Could not review this post.')
    } finally {
      setReviewBusy('')
    }
  }

  const upsertPost = (updated) => {
    setPosts((current) => (current || []).map((post) => post.id === updated.id ? updated : post))
  }

  const upsertPlanner = (updated) => {
    setPlannerNotes((current) => (current || []).map((note) => note.id === updated.id ? updated : note))
  }

  const removeItem = (item) => {
    if (item.kind === 'planner') {
      setPlannerNotes((current) => (current || []).filter((note) => note.id !== item.id))
    } else {
      setPosts((current) => (current || []).filter((post) => post.id !== item.id))
    }
  }

  const updateItemFromModal = (item) => {
    if (item.kind === 'planner') upsertPlanner(item.note || item)
    else upsertPost(item)
    setSelectedItem(item)
  }

  const moveItemStage = async (item, groupKey) => {
    if (!item || groupFor(item) === groupKey || !GROUP_STATUS[groupKey]) return
    setDragBusy(`${item.kind}-${item.id}`)
    try {
      if (item.kind === 'planner') {
        const { data } = await api.put(`/planner-notes/${item.id}`, {
          title: item.note?.title || item.title || 'Untitled plan',
              content_html: item.note?.content_html || `<p>${escapeHtml(item.content || '')}</p>`,
              ai_prompt: item.note?.meta?.ai_prompt || '',
              scheduled_at: item.scheduled_at || null,
              categories: item.note?.meta?.categories || [],
              tags: item.note?.meta?.tags || [],
              status: groupKey,
            })
        upsertPlanner(data.data)
        broadcastDataChanged({ resource: 'planner-notes', action: 'moved', item: data.data })
      } else {
        const { data } = await api.put(`/posts/${item.id}/status`, { status: GROUP_STATUS[groupKey], scheduled_at: item.scheduled_at || null })
        upsertPost(data.data)
        broadcastDataChanged({ resource: 'posts', action: 'moved', item: data.data })
      }
    } catch (moveError) {
      setError(moveError.response?.data?.message || 'Could not move this item.')
    } finally {
      setDragBusy('')
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
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search organizer..."
              className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear organizer search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {visibleViewOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => changeView(item.key)}
                className={clsx(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition xl:flex-none',
                  view === item.key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white xl:flex-none"
              onClick={() => setSettingsOpen(true)}
              aria-label="Filter"
              title="Filter"
            >
              <ListFilter className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Filter</span>
            </button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {error && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">{error}</div>}

        {view === 'calendar' ? (
          <div className="p-4">
            <Calendar
              embedded
              filter={filter}
              items={filteredItems}
              plannerNotes={plannerNotes}
              showPlannerData={showPlannerData}
              showSocialData={showSocialData}
              onOpenItem={setSelectedItem}
              onItemChanged={updateItemFromModal}
              holidaySettings={holidaySettings}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarClock}
              title="No organizer items found"
              description={search ? 'Try a different search or status filter.' : 'Use the top navigation New menu to create posts or planner notes.'}
            />
          </div>
        ) : (
          <>
            {view === 'table' && <TableView items={pagedItems} canApprove={canApprove} onOpen={setSelectedItem} onReview={reviewPost} reviewBusy={reviewBusy} />}
            {view === 'board' && <BoardView items={pagedItems} filter={filter} canApprove={canApprove} onOpen={setSelectedItem} onReview={reviewPost} reviewBusy={reviewBusy} onMoveStage={moveItemStage} dragBusy={dragBusy} />}
            {view === 'timeline' && <TimelineView items={pagedItems} canApprove={canApprove} onOpen={setSelectedItem} onReview={reviewPost} reviewBusy={reviewBusy} />}
            {hasMore && <div ref={sentinelRef} className="px-4 py-5 text-center text-xs font-semibold text-slate-400">Loading more organizer items...</div>}
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
        onFilterChange={changeFilter}
        selectedGroups={selectedGroups}
        onGroupsChange={changeGroups}
        counts={counts}
        approvalFilter={approvalFilter}
        onApprovalFilterChange={setApprovalFilter}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        accounts={accounts}
        selectedAccountIds={selectedAccountIds}
        onToggleAccount={toggleAccountFilter}
        availableCategories={availableCategories}
        selectedCategories={selectedCategories}
        onToggleCategory={(category) => setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}
        onClearCategories={() => setSelectedCategories([])}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        holidaySettings={holidaySettings}
        onHolidaySettingsChange={setHolidaySettings}
      />

      {selectedItem?.kind === 'planner' && (
        <PlanEditorModal
          key={`planner-${selectedItem.id}`}
          open
          note={selectedItem.note || selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={(savedNote) => {
            upsertPlanner(savedNote)
            setSelectedItem(null)
          }}
        />
      )}

      {selectedItem && selectedItem.kind !== 'planner' && selectedItem.kind !== 'holiday' && (
        <PostDetailsModal
          key={`post-${selectedItem.id}`}
          post={selectedItem}
          postId={selectedItem.id}
          open
          onClose={() => setSelectedItem(null)}
          onChanged={(updatedPost) => {
            const nextPost = { ...updatedPost, kind: 'post' }
            updateItemFromModal(nextPost)
          }}
          onDeleted={(deletedPost) => {
            removeItem({ ...deletedPost, kind: 'post' })
            setSelectedItem(null)
          }}
        />
      )}
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

function BoardView({ items, filter, canApprove, onOpen, onReview, reviewBusy, onMoveStage, dragBusy }) {
  const columns = filter === 'all' || filter === 'custom' ? Object.keys(GROUPS) : [filter]
  return (
    <div className={clsx('grid gap-4 overflow-x-auto p-4', columns.length === 3 ? 'lg:grid-cols-3' : 'grid-cols-1')}>
      {columns.map((key) => {
        const meta = GROUPS[key]
        const columnItems = items.filter((item) => groupFor(item) === key)
        return (
          <section
            key={key}
            className={clsx('min-w-0 rounded-2xl border p-3', meta.panel)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const payload = event.dataTransfer.getData('application/json')
              if (payload) onMoveStage(JSON.parse(payload), key)
            }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={clsx('h-2.5 w-2.5 rounded-full', meta.dot)} />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{meta.label}</h2>
              </div>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{columnItems.length}</span>
            </div>
            <div className="space-y-3">
              {columnItems.map((item) => <PlannerCard key={item.uid || item.id} post={item} canApprove={canApprove} onOpen={onOpen} onReview={onReview} reviewBusy={reviewBusy} draggable dragBusy={dragBusy === `${item.kind}-${item.id}`} />)}
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

function PlannerCard({ post, compact = false, canApprove, onOpen, onReview, reviewBusy, draggable = false, dragBusy = false }) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable && !dragBusy}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('application/json', JSON.stringify(post))
      }}
      onClick={() => onOpen(post)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(post)
      }}
      className={clsx(
        'cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-800',
        compact ? 'p-4' : 'p-3.5',
        draggable && 'cursor-grab active:cursor-grabbing',
        dragBusy && 'opacity-50',
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
  onFilterChange,
  selectedGroups = ['all'],
  onGroupsChange,
  counts = {},
  approvalFilter,
  onApprovalFilterChange,
  sortOrder,
  onSortOrderChange,
  accounts = [],
  selectedAccountIds = [],
  onToggleAccount,
  availableCategories = [],
  selectedCategories = [],
  onToggleCategory,
  onClearCategories,
  dateFilter = { from: '', to: '' },
  onDateFilterChange,
  holidaySettings,
  onHolidaySettingsChange,
}) {
  const [activeTab, setActiveTab] = useState('display')
  const [openSections, setOpenSections] = useState(() => ({
    views: true,
    sources: true,
    holidays: true,
    status: true,
    list: true,
    accounts: true,
    categories: true,
  }))

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  const updateHolidaySettings = (patch) => onHolidaySettingsChange(normalizeHolidaySettings({ ...holidaySettings, ...patch }))
  const updateHolidayGroup = (groupKey) => {
    const groups = holidaySettings.groups || []
    const nextGroups = groups.includes(groupKey) ? groups.filter((key) => key !== groupKey) : [...groups, groupKey]
    updateHolidaySettings({ groups: nextGroups })
  }
  const updateAudienceCountry = (countryCode) => {
    const countries = holidaySettings.audienceCountries || []
    const nextCountries = countries.includes(countryCode) ? countries.filter((code) => code !== countryCode) : [...countries, countryCode]
    updateHolidaySettings({ audienceCountries: nextCountries })
  }
  const addCustomHoliday = () => {
    const date = new Date().toISOString().slice(0, 10)
    updateHolidaySettings({
      customEvents: [
        ...(holidaySettings.customEvents || []),
        { name: 'Custom campaign day', date, notes: '' },
      ],
    })
  }
  const updateCustomHoliday = (index, patch) => {
    const nextEvents = [...(holidaySettings.customEvents || [])]
    nextEvents[index] = { ...nextEvents[index], ...patch }
    updateHolidaySettings({ customEvents: nextEvents })
  }
  const removeCustomHoliday = (index) => {
    updateHolidaySettings({ customEvents: (holidaySettings.customEvents || []).filter((_, itemIndex) => itemIndex !== index) })
  }
  const toggleSection = (key) => setOpenSections((current) => ({ ...current, [key]: !current[key] }))

  return (
    <div className={clsx('fixed inset-0 z-[220] transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Organizer filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Filter views, data sources, status, dates, accounts, and calendar holidays.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[
              ['display', 'Display'],
              ['filters', 'Filters'],
              ['calendar', 'Calendar'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={clsx(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition',
                  activeTab === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {activeTab === 'display' && (
          <OrganizerFilterAccordion title="Visible view tabs" description="Show or hide the organizer view tabs." icon={Table2} open={openSections.views} onToggle={() => toggleSection('views')}>
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
          </OrganizerFilterAccordion>
          )}

          {activeTab === 'display' && (
          <OrganizerFilterAccordion title="Data sources" description="Choose which item types appear." icon={FileText} open={openSections.sources} onToggle={() => toggleSection('sources')}>
            <div className="space-y-3">
            <SwitchRow label="Show planner data" description="Include saved plans and notes in every organizer view." checked={showPlannerData} onChange={onTogglePlannerData} />
            <SwitchRow label="Show social posting data" description="Include posts from composer, queues, and publishing workflows." checked={showSocialData} onChange={onToggleSocialData} />
            </div>
          </OrganizerFilterAccordion>
          )}

          {activeTab === 'calendar' && (
          <OrganizerFilterAccordion title="Calendar holidays" description="Country, audience, marketing, religious, and custom calendars." icon={CalendarDays} open={openSections.holidays} onToggle={() => toggleSection('holidays')}>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Show country, audience, marketing, global, religious, and custom workspace calendars without flooding the calendar.</p>
            <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <SwitchRow
                label="Show holidays"
                description="Display selected holiday calendars in the visible calendar date range."
                checked={Boolean(holidaySettings.enabled)}
                onChange={() => updateHolidaySettings({ enabled: !holidaySettings.enabled })}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace country</span>
                <select
                  value={holidaySettings.workspaceCountry}
                  onChange={(event) => updateHolidaySettings({ workspaceCountry: event.target.value })}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {HOLIDAY_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </label>
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Audience countries</span>
                <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {HOLIDAY_COUNTRIES.filter((country) => country.code !== holidaySettings.workspaceCountry).map((country) => {
                    const checked = (holidaySettings.audienceCountries || []).includes(country.code)
                    return (
                      <label key={country.code} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        <span className="truncate">{country.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => updateAudienceCountry(country.code)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Holiday calendars</span>
                <div className="grid gap-2">
                  {HOLIDAY_SOURCE_GROUPS.map((group) => {
                    const checked = (holidaySettings.groups || []).includes(group.key)
                    return (
                      <label key={group.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        <span>
                          <span className="block">{group.label}</span>
                          {group.key === 'islamic' && <span className="mt-0.5 block text-[11px] font-normal text-slate-400">Date may vary by country/moon sighting.</span>}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => updateHolidayGroup(group.key)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Custom workspace events</span>
                  <Button type="button" size="sm" variant="secondary" onClick={addCustomHoliday}>Add</Button>
                </div>
                <div className="space-y-2">
                  {(holidaySettings.customEvents || []).map((event, index) => (
                    <div key={`${event.date}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                      <input
                        value={event.name || ''}
                        onChange={(inputEvent) => updateCustomHoliday(index, { name: inputEvent.target.value })}
                        placeholder="Campaign or custom holiday"
                        className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          type="date"
                          value={event.date || ''}
                          onChange={(inputEvent) => updateCustomHoliday(index, { date: inputEvent.target.value })}
                          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <Button type="button" size="sm" variant="ghost" className="text-rose-500" onClick={() => removeCustomHoliday(index)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                  {(holidaySettings.customEvents || []).length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400 dark:border-slate-800">No custom events yet.</p>}
                </div>
              </div>
            </div>
          </OrganizerFilterAccordion>
          )}

          {activeTab === 'filters' && (
          <OrganizerFilterAccordion title="Status filter" description="Choose one or multiple status groups." icon={ListFilter} open={openSections.status} onToggle={() => toggleSection('status')}>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose one or multiple status groups to show in every view.</p>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {DRAWER_FILTERS.map(({ key, label, icon: Icon }) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{label}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{counts[key] ?? 0}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(key)}
                    onChange={() => {
                      if (key === 'custom') return onFilterChange('custom')
                      if (key === 'all') return onGroupsChange(['all'])
                      const withoutAll = selectedGroups.filter((item) => item !== 'all' && item !== 'custom')
                      const next = withoutAll.includes(key) ? withoutAll.filter((item) => item !== key) : [...withoutAll, key]
                      onGroupsChange(next.length ? next : ['all'])
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              ))}
            </div>
          </OrganizerFilterAccordion>
          )}

          {activeTab === 'filters' && (
          <OrganizerFilterAccordion title="List filters" description="Approval, date range, and sort order." icon={ListFilter} open={openSections.list} onToggle={() => toggleSection('list')}>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Refine approval state and ordering for the organizer views.</p>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Approval</span>
                <select value={approvalFilter} onChange={(event) => onApprovalFilterChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="both">Approval: all</option>
                  <option value="pending">Pending approval only</option>
                  <option value="approved">Approved only</option>
                  <option value="hide_pending">Hide pending approval</option>
                </select>
              </label>
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Date range</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateTimeField label="From" type="date" value={dateFilter.from} onChange={(event) => onDateFilterChange({ ...dateFilter, from: event.target.value })} />
                  <DateTimeField label="To" type="date" value={dateFilter.to} onChange={(event) => onDateFilterChange({ ...dateFilter, to: event.target.value })} />
                </div>
                {(dateFilter.from || dateFilter.to) && (
                  <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => onDateFilterChange({ from: '', to: '' })}>Clear date filter</Button>
                )}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Sort</span>
                <select value={sortOrder} onChange={(event) => onSortOrderChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </label>
            </div>
          </OrganizerFilterAccordion>
          )}

          {activeTab === 'filters' && (
          <OrganizerFilterAccordion title="Social profiles" description="Filter by connected profiles." icon={UserRound} open={openSections.accounts} onToggle={() => toggleSection('accounts')}>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select one or more connected profiles to show in Organizer.</p>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {accounts.map((account) => (
                <label key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <span className="min-w-0 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span className="block truncate">{account.name}</span>
                    <span className="block truncate text-xs text-slate-400">{account.platform_label || account.platform}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.includes(account.id)}
                    onChange={() => onToggleAccount(account.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              ))}
              {accounts.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400 dark:border-slate-800">No connected accounts.</p>}
            </div>
            {selectedAccountIds.length > 0 && <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => selectedAccountIds.forEach((id) => onToggleAccount(id))}>Clear profile filters</Button>}
          </OrganizerFilterAccordion>
          )}

          {activeTab === 'filters' && (
          <OrganizerFilterAccordion title="Categories" description="Filter posts and planner notes by category." icon={ListFilter} open={openSections.categories} onToggle={() => toggleSection('categories')}>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Filter posts and planner notes by saved categories.</p>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {availableCategories.map((category) => (
                <label key={category} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{category}</span>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => onToggleCategory(category)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              ))}
              {availableCategories.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400 dark:border-slate-800">No categories yet.</p>}
            </div>
            {selectedCategories.length > 0 && <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={onClearCategories}>Clear category filters</Button>}
          </OrganizerFilterAccordion>
          )}
        </div>
      </aside>
    </div>
  )
}

function OrganizerFilterAccordion({ title, description, icon: Icon, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{description}</span>
          </span>
        </span>
        <X className={clsx('h-4 w-4 shrink-0 text-slate-400 transition', open ? 'rotate-45' : 'rotate-0')} />
      </button>
      {open && <div className="border-t border-slate-100 p-4 dark:border-slate-800">{children}</div>}
    </section>
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

function noteToOrganizerItem(note) {
  return {
    uid: `planner-${note.id}`,
    id: note.id,
    kind: 'planner',
    title: note.title,
    content: note.excerpt || note.content_text || '',
    status: note.status || 'note',
    status_label: plannerStatusLabel(note.status),
    status_color: 'indigo',
    author: note.author,
    scheduled_at: note.meta?.scheduled_at || null,
    created_at: note.created_at,
    updated_at: note.updated_at,
    variants: [],
    note,
  }
}

function plannerStatusLabel(status) {
  if (status === 'progress') return 'Planner progress'
  if (status === 'completed') return 'Planner completed'
  return 'Planner note'
}

function groupFor(post) {
  if (post.kind === 'planner') {
    if (post.status === 'progress') return 'progress'
    if (post.status === 'completed') return 'completed'
    return 'pending'
  }
  return Object.keys(GROUPS).find((key) => GROUPS[key].statuses.includes(post.status)) || 'pending'
}

function compareItems(a, b, sortOrder = 'desc') {
  const aDate = new Date(a.scheduled_at || a.published_at || a.updated_at || a.created_at).getTime()
  const bDate = new Date(b.scheduled_at || b.published_at || b.updated_at || b.created_at).getTime()
  return sortOrder === 'asc' ? aDate - bDate : bDate - aDate
}

function approvalMatches(item, approvalFilter) {
  if (item.kind === 'planner') return true
  if (approvalFilter === 'pending') return item.status === 'pending_approval'
  if (approvalFilter === 'approved') return item.status === 'approved'
  if (approvalFilter === 'hide_pending') return item.status !== 'pending_approval'
  return true
}

function accountMatches(item, selectedAccountIds) {
  if (!selectedAccountIds.length || item.kind === 'planner') return true
  return (item.variants || []).some((variant) => selectedAccountIds.includes(variant.social_account?.id || variant.social_account_id))
}

function getItemCategories(item) {
  if (item.kind === 'planner') return item.note?.meta?.categories || []
  return item.options?.categories || []
}

function categoryMatches(item, selectedCategories) {
  if (!selectedCategories.length) return true
  const categories = getItemCategories(item)
  return categories.some((category) => selectedCategories.includes(category))
}

function dateRangeMatches(item, dateFilter) {
  const from = dateFilter?.from
  const to = dateFilter?.to
  if (!from && !to) return true

  const itemDate = itemDateTime(item)
  if (itemDate === null) return false

  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime()
    if (!Number.isNaN(fromTime) && itemDate < fromTime) return false
  }

  if (to) {
    const toTime = new Date(`${to}T23:59:59.999`).getTime()
    if (!Number.isNaN(toTime) && itemDate > toTime) return false
  }

  return true
}

function itemDateTime(item) {
  const value = item.scheduled_at || item.published_at || item.updated_at || item.created_at
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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

function readHolidaySettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem('organizer_holiday_settings') || '{}')
    return normalizeHolidaySettings(parsed)
  } catch {
    return normalizeHolidaySettings()
  }
}
