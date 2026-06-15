import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock, Check, CheckCircle2, CircleDashed, Clock3, Columns3, ListFilter,
  Plus, Search, Table2, Timeline, UserRound, X,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import PlatformBadge from '../components/PlatformBadge'
import { Badge, Button, Card, EmptyState, PageLoader } from '../components/ui'
import { useAuth } from '../context/AuthContext'

const GROUPS = {
  pending: {
    label: 'Pending',
    statuses: ['draft', 'pending_approval'],
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

const FILTERS = [{ key: 'all', label: 'All' }, ...Object.entries(GROUPS).map(([key, value]) => ({ key, label: value.label }))]
const VIEWS = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'board', label: 'Kanban', icon: Columns3 },
  { key: 'timeline', label: 'Timeline', icon: Timeline },
]

export default function Planner() {
  const { activeWorkspace } = useAuth()
  const [posts, setPosts] = useState(null)
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState(() => localStorage.getItem('planner_view') || 'table')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [reviewBusy, setReviewBusy] = useState('')

  useEffect(() => {
    api.get('/posts', { params: { per_page: 100 } })
      .then(({ data }) => setPosts(data.data || []))
      .catch(() => {
        setPosts([])
        setError('Could not load your posting plan.')
      })
  }, [])

  const counts = useMemo(() => {
    const items = posts || []
    return {
      all: items.length,
      ...Object.fromEntries(Object.keys(GROUPS).map((key) => [key, items.filter((post) => groupFor(post) === key).length])),
    }
  }, [posts])

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (posts || [])
      .filter((post) => filter === 'all' || groupFor(post) === filter)
      .filter((post) => !query || `${post.title || ''} ${post.content || ''} ${post.author?.name || ''}`.toLowerCase().includes(query))
      .sort(comparePosts)
  }, [filter, posts, search])

  const changeView = (nextView) => {
    setView(nextView)
    localStorage.setItem('planner_view', nextView)
  }

  const reviewPost = async (post, decision) => {
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

  if (!posts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planner</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track every post from first draft to completed publishing.</p>
        </div>
        <Link to="/app/composer"><Button><Plus className="h-4 w-4" /> Create post</Button></Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FILTERS.map((item) => {
          const meta = item.key === 'all' ? { icon: ListFilter, color: 'brand' } : GROUPS[item.key]
          const Icon = meta.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={clsx(
                'flex items-center justify-between rounded-2xl border bg-white p-4 text-left shadow-sm transition dark:bg-slate-900',
                filter === item.key
                  ? 'border-brand-500 ring-2 ring-brand-500/20 dark:border-brand-400'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
              )}
            >
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{counts[item.key]}</p>
              </div>
              <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', iconTone(meta.color))}>
                <Icon className="h-5 w-5" />
              </span>
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts or authors..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {VIEWS.map((item) => (
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

        {filteredPosts.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CalendarClock}
              title="No posts found"
              description={search ? 'Try a different search or status filter.' : 'Create your first post to start filling the planner.'}
              action={!search && <Link to="/app/composer"><Button size="sm"><Plus className="h-4 w-4" /> Create post</Button></Link>}
            />
          </div>
        ) : (
          <>
            {view === 'table' && <TableView posts={filteredPosts} canApprove={canApprove} onReview={reviewPost} reviewBusy={reviewBusy} />}
            {view === 'board' && <BoardView posts={filteredPosts} filter={filter} canApprove={canApprove} onReview={reviewPost} reviewBusy={reviewBusy} />}
            {view === 'timeline' && <TimelineView posts={filteredPosts} canApprove={canApprove} onReview={reviewPost} reviewBusy={reviewBusy} />}
          </>
        )}
      </Card>
    </div>
  )
}

function TableView({ posts, canApprove, onReview, reviewBusy }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Post</th>
            <th className="px-5 py-3 font-semibold">Stage</th>
            <th className="px-5 py-3 font-semibold">Platforms</th>
            <th className="px-5 py-3 font-semibold">Owner</th>
            <th className="px-5 py-3 font-semibold">Schedule</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {posts.map((post) => (
            <tr key={post.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className="max-w-md px-5 py-4"><PostTitle post={post} /></td>
              <td className="px-5 py-4"><StageBadges post={post} /><ReviewActions post={post} canApprove={canApprove} onReview={onReview} reviewBusy={reviewBusy} /></td>
              <td className="px-5 py-4"><Platforms post={post} /></td>
              <td className="px-5 py-4"><Owner post={post} /></td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{planDate(post)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BoardView({ posts, filter, canApprove, onReview, reviewBusy }) {
  const columns = filter === 'all' ? Object.keys(GROUPS) : [filter]
  return (
    <div className={clsx('grid gap-4 overflow-x-auto p-4', columns.length === 3 ? 'lg:grid-cols-3' : 'grid-cols-1')}>
      {columns.map((key) => {
        const meta = GROUPS[key]
        const columnPosts = posts.filter((post) => groupFor(post) === key)
        return (
          <section key={key} className={clsx('min-w-0 rounded-2xl border p-3', meta.panel)}>
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={clsx('h-2.5 w-2.5 rounded-full', meta.dot)} />
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{meta.label}</h2>
              </div>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{columnPosts.length}</span>
            </div>
            <div className="space-y-3">
              {columnPosts.map((post) => <PlannerCard key={post.id} post={post} canApprove={canApprove} onReview={onReview} reviewBusy={reviewBusy} />)}
              {columnPosts.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700">No posts in this stage</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function TimelineView({ posts, canApprove, onReview, reviewBusy }) {
  return (
    <div className="p-5 sm:p-6">
      <div className="relative ml-3 border-l-2 border-slate-200 pl-7 dark:border-slate-700">
        {posts.map((post) => {
          const meta = GROUPS[groupFor(post)]
          return (
            <div key={post.id} className="relative pb-7 last:pb-0">
              <span className={clsx('absolute -left-[36px] top-1.5 h-4 w-4 rounded-full border-4 border-white dark:border-slate-900', meta.dot)} />
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{planDate(post)}</p>
              <PlannerCard post={post} compact canApprove={canApprove} onReview={onReview} reviewBusy={reviewBusy} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlannerCard({ post, compact = false, canApprove, onReview, reviewBusy }) {
  return (
    <div className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900', compact ? 'p-4' : 'p-3.5')}>
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
  if (!canApprove || post.status !== 'pending_approval') return null
  return (
    <div className="mt-3 flex gap-2">
      <Button size="sm" loading={reviewBusy === `approved-${post.id}`} disabled={Boolean(reviewBusy)} onClick={() => onReview(post, 'approved')}><Check className="h-3.5 w-3.5" /> Approve</Button>
      <Button size="sm" variant="secondary" loading={reviewBusy === `rejected-${post.id}`} disabled={Boolean(reviewBusy)} onClick={() => onReview(post, 'rejected')}><X className="h-3.5 w-3.5" /> Reject</Button>
    </div>
  )
}

function PostTitle({ post }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-slate-900 dark:text-white">{post.title || contentTitle(post.content)}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{post.content || 'No post content yet.'}</p>
    </div>
  )
}

function StageBadges({ post, showGroup = true }) {
  const group = GROUPS[groupFor(post)]
  return (
    <div className="flex flex-wrap gap-1.5">
      {showGroup && <Badge color={group.color}>{group.label}</Badge>}
      <Badge color={post.status_color}>{post.status_label || post.status}</Badge>
    </div>
  )
}

function Platforms({ post }) {
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

function groupFor(post) {
  return Object.keys(GROUPS).find((key) => GROUPS[key].statuses.includes(post.status)) || 'pending'
}

function comparePosts(a, b) {
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
  const clean = content.trim()
  return clean ? `${clean.slice(0, 54)}${clean.length > 54 ? '...' : ''}` : 'Untitled post'
}

function iconTone(color) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
  }
  return tones[color] || tones.brand
}
