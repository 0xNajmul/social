import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, FileEdit, AlertTriangle, Share2, Clock3, Rss } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Card, StatCard, PageLoader, EmptyState, Badge, Button } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'
import { DATA_CHANGED_EVENT } from '../lib/appEvents'

const RANGES = [
  ['all', 'All time'],
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['last_7_days', 'Last 7 days'],
  ['last_30_days', 'Last 30 days'],
  ['this_month', 'This month'],
  ['last_month', 'Last month'],
  ['this_year', 'This year'],
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [posts, setPosts] = useState([])
  const [plans, setPlans] = useState([])
  const [range, setRange] = useState('all')
  const [activeTab, setActiveTab] = useState('recent_posts')

  const loadDashboard = useCallback(() => {
    Promise.allSettled([
      api.get('/dashboard', { params: { range } }),
      api.get('/posts', { params: { per_page: 100 } }),
      api.get('/planner-notes', { params: { limit: 100 } }),
    ]).then(([dashboardResult, postsResult, plansResult]) => {
      if (dashboardResult.status === 'fulfilled') setData(dashboardResult.value.data)
      else setData({ error: true })

      if (postsResult.status === 'fulfilled') setPosts(postsResult.value.data?.data || [])
      else setPosts([])

      if (plansResult.status === 'fulfilled') setPlans(plansResult.value.data?.data || [])
      else setPlans([])
    })
  }, [range])

  useEffect(() => {
    loadDashboard()
    const interval = window.setInterval(loadDashboard, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, loadDashboard)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, loadDashboard)
    }
  }, [loadDashboard])

  const openComposerModal = () => {
    window.dispatchEvent(new CustomEvent('postflow:quick-action', { detail: { type: 'composer' } }))
  }
  const openPostPopup = (post) => {
    window.dispatchEvent(new CustomEvent('postflow:open-post', { detail: { id: post.id, item: post } }))
  }
  const openActivity = (activity) => {
    if (isPostActivity(activity) && activity.subject_id) {
      window.dispatchEvent(new CustomEvent('postflow:open-post', { detail: { id: activity.subject_id } }))
      return
    }
    navigate(activityLink(activity))
  }

  if (!data) return <PageLoader />

  const { stats = {}, usage = {}, upcoming = [], recent_activity = [] } = data
  const latestFeed = loadDashboardFeedItems()
  const tabItems = [
    {
      key: 'recent_posts',
      label: 'Recent posts',
      to: '/app/posts',
      rows: posts.slice().sort(sortByNewestRecord).slice(0, 8),
      emptyTitle: 'No recent posts',
      emptyDescription: 'Create a draft, schedule a post, or publish now to see it here.',
    },
    {
      key: 'recent_plans',
      label: 'Recent plans',
      to: '/app/planner',
      rows: plans.slice().sort(sortByNewestRecord).slice(0, 8),
      emptyTitle: 'No recent plans',
      emptyDescription: 'Create a plan to start building your editorial pipeline.',
    },
    {
      key: 'upcoming_posts',
      label: 'Upcoming posts',
      to: '/app/organizer?view=calendar',
      rows: buildUpcomingRows(posts, upcoming).slice(0, 8),
      emptyTitle: 'Nothing scheduled',
      emptyDescription: 'Create and schedule your first post.',
    },
    {
      key: 'latest_feed',
      label: 'Latest feed',
      to: '/app/feed',
      rows: latestFeed.slice(0, 8),
      emptyTitle: 'No feed items',
      emptyDescription: 'Add a feed source to see the latest articles and ideas here.',
    },
  ]
  const activeContent = tabItems.find((tab) => tab.key === activeTab) || tabItems[0]
  const statCards = [
    { label: 'Scheduled', value: stats.scheduled, icon: CalendarClock, accent: 'brand', to: '/app/organizer?filter=progress' },
    { label: 'Published', value: stats.published_this_month, icon: CheckCircle2, accent: 'emerald', to: '/app/analytics' },
    { label: 'Drafts', value: stats.drafts, icon: FileEdit, accent: 'sky', to: '/app/organizer?filter=pending' },
    { label: 'Failed', value: stats.failed, icon: AlertTriangle, accent: 'rose', to: '/app/organizer?filter=completed' },
    { label: 'Accounts', value: stats.connected_accounts, icon: Share2, accent: 'brand', to: '/app/accounts' },
    { label: 'Awaiting approval', value: stats.pending_approval, icon: Clock3, accent: 'amber', to: '/app/organizer?filter=pending' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500">Here's what's happening across your channels.</p>
        </div>
        <label className="block w-full sm:w-64">
          <span className="sr-only">Dashboard date range</span>
          <select value={range} onChange={(event) => setRange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {RANGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <Link key={card.label} to={card.to} className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/25">
            <StatCard label={card.label} value={card.value} icon={card.icon} accent={card.accent} />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Content snapshot */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-brand-500/25',
                    activeContent.key === tab.key
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Link to={activeContent.to} className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              View details
            </Link>
          </div>
          <div className="p-3">
            {activeContent.rows.length === 0 ? (
              <EmptyState icon={activeContent.key === 'latest_feed' ? Rss : CalendarClock} title={activeContent.emptyTitle} description={activeContent.emptyDescription} action={activeContent.key === 'upcoming_posts' ? <Button type="button" size="sm" onClick={openComposerModal}>Compose</Button> : null} />
            ) : (
              <DashboardContentTable type={activeContent.key} rows={activeContent.rows} onOpenPost={openPostPopup} />
            )}
          </div>
        </Card>

        {/* Usage */}
        <Link to="/app/usage" className="group block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/25">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Plan usage</h2>
            <div className="space-y-4">
              {Object.entries(usage).map(([key, u]) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="capitalize text-slate-500">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {u.used}{u.limit === null ? ' / ∞' : ` / ${u.limit}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: u.limit === null ? '15%' : `${Math.min(100, (u.used / Math.max(1, u.limit)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <span className="mt-5 flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition group-hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700">Manage usage</span>
          </Card>
        </Link>
      </div>

      {/* Activity */}
      <Card>
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent activity</h2>
        </div>
        <ul className="divide-y divide-slate-100 p-3 dark:divide-slate-800">
          {recent_activity.length === 0 && <li className="px-2 py-4 text-sm text-slate-400">No activity yet.</li>}
          {recent_activity.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => openActivity(a)} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left text-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:hover:bg-slate-800/60">
              <span className="text-slate-700 dark:text-slate-200">
                <span className="font-medium">{a.user?.name || 'System'}</span> · {sanitizeActivityText(a.description || a.action)}
              </span>
              <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function DashboardContentTable({ type, rows, onOpenPost }) {
  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-slate-800">
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-900 dark:text-slate-500">
          <tr>
            <th className="px-3 py-2.5">Item</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <DashboardTableRow key={`${type}-${row.id || row.url || row.title}`} type={type} row={row} onOpenPost={onOpenPost} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DashboardTableRow({ type, row, onOpenPost }) {
  const isPost = ['recent_posts', 'upcoming_posts'].includes(type)
  const isPlan = type === 'recent_plans'
  const date = row.scheduled_at || row.published_at || row.updated_at || row.created_at || row.date
  const title = row.title || row.content || row.note || row.summary || row.description || 'Untitled'
  const statusLabel = row.status_label || row.status || row.type || (isPlan ? 'Plan' : 'Feed')
  const statusColor = row.status_color || (row.status === 'published' ? 'emerald' : row.status === 'failed' ? 'rose' : row.status === 'scheduled' ? 'indigo' : 'slate')

  const content = (
    <>
      <td className="min-w-0 px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {isPost && (
            <div className="flex shrink-0 -space-x-2">
              {(row.variants || []).slice(0, 3).map((variant) => <PlatformBadge key={variant.id || variant.platform} platform={variant.platform} size="sm" />)}
            </div>
          )}
          {type === 'latest_feed' && <Rss className="h-4 w-4 shrink-0 text-brand-500" />}
          <span className="line-clamp-2 min-w-0 break-words font-medium text-slate-700 dark:text-slate-200">{title}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3">
        <Badge color={statusColor}>{formatCompactLabel(statusLabel)}</Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDashboardDate(date)}</td>
    </>
  )

  if (isPost) {
    return (
      <tr
        role="button"
        tabIndex={0}
        onClick={() => onOpenPost(row)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpenPost(row)
          }
        }}
        className="cursor-pointer transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:hover:bg-slate-800/50"
      >
        {content}
      </tr>
    )
  }

  if (type === 'latest_feed' && row.url) {
    return (
      <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td className="min-w-0 px-3 py-3">
          <a href={row.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-lg text-left font-medium text-slate-700 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300">
            <Rss className="h-4 w-4 shrink-0 text-brand-500" />
            <span className="line-clamp-2 min-w-0 break-words">{title}</span>
          </a>
        </td>
        <td className="whitespace-nowrap px-3 py-3"><Badge color="amber">{formatCompactLabel(statusLabel)}</Badge></td>
        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDashboardDate(date)}</td>
      </tr>
    )
  }

  return <tr className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">{content}</tr>
}

function buildUpcomingRows(posts, fallbackUpcoming = []) {
  const scheduledPosts = (posts || [])
    .filter((post) => post.scheduled_at && ['scheduled', 'approved', 'pending_approval'].includes(String(post.status || '').toLowerCase()))
    .sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0))

  if (scheduledPosts.length) return scheduledPosts
  return (fallbackUpcoming || []).slice().sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0))
}

function sortByNewestRecord(a, b) {
  return new Date(b.updated_at || b.created_at || b.scheduled_at || 0) - new Date(a.updated_at || a.created_at || a.scheduled_at || 0)
}

function loadDashboardFeedItems() {
  if (typeof localStorage === 'undefined') return []
  try {
    const feeds = JSON.parse(localStorage.getItem('postflow_user_feeds') || '[]')
    if (!Array.isArray(feeds)) return []
    return feeds.slice().reverse().flatMap((feed) => {
      const items = Array.isArray(feed.items) && feed.items.length ? feed.items : [{
        id: `${feed.id || feed.name}-source`,
        title: feed.name,
        source: feed.name,
        category: feed.category,
        country: feed.country,
        url: feed.url,
        published_at: feed.updated_at || feed.created_at,
      }]
      return items.map((item) => ({
        ...item,
        source: item.source || feed.name,
        type: item.category || feed.category || 'Feed',
        date: item.published_at || item.created_at || feed.updated_at || feed.created_at,
      }))
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  } catch {
    return []
  }
}

function formatDashboardDate(value) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return date.toLocaleString()
}

function formatCompactLabel(value) {
  return String(value || 'Item').replace(/_/g, ' ')
}

function sanitizeActivityText(value) {
  return String(value || '')
    .replace(/https?:\/\/api\.telegram\.org\/bot[^\s)]+/gi, 'Telegram API endpoint')
    .replace(/bot\d{6,}:[A-Za-z0-9_-]{20,}/g, 'bot[hidden]')
    .replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, '[hidden-token]')
}

function isPostActivity(activity) {
  return String(activity.subject_type || '').toLowerCase().includes('post') || String(activity.action || '').startsWith('post.')
}

function activityLink(activity) {
  const text = `${activity.subject_type || ''} ${activity.type || ''} ${activity.action || ''} ${activity.description || ''}`.toLowerCase()
  if (text.includes('post') || text.includes('publish') || text.includes('approval')) return '/app/organizer'
  if (text.includes('planner') || text.includes('plan')) return '/app/planner'
  if (text.includes('media') || text.includes('upload')) return '/app/media'
  if (text.includes('account') || text.includes('token')) return '/app/accounts'
  if (text.includes('automation')) return '/app/automations'
  if (text.includes('billing') || text.includes('subscription') || text.includes('plan')) return '/app/billing'
  return '/app/notifications'
}
