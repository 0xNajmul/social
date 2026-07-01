import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CalendarClock, ChevronDown, Eye, Heart, LayoutGrid, MessageCircle, RefreshCw, Search, Share2, Table2, TrendingDown, TrendingUp, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, StatCard, PageLoader } from '../components/ui'
import PlatformBadge, { AccountIcon } from '../components/PlatformBadge'
import { DATA_CHANGED_EVENT } from '../lib/appEvents'

const POST_TABS = [
  { key: 'top', label: 'Top performing', icon: TrendingUp },
  { key: 'latest', label: 'Latest posts', icon: CalendarClock },
  { key: 'worst', label: 'Worst performing', icon: TrendingDown },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarClock },
]

export default function Analytics() {
  const [data, setData] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [postTab, setPostTab] = useState('top')
  const [postView, setPostView] = useState('table')
  const [accountSearch, setAccountSearch] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [syncingAnalytics, setSyncingAnalytics] = useState(null)
  const [syncNotice, setSyncNotice] = useState(null)

  const loadAccounts = useCallback(() => {
    return api.get('/social/accounts')
      .then(({ data: response }) => setAccounts(response.data || []))
      .catch(() => setAccounts([]))
  }, [])

  const loadAnalytics = useCallback(() => {
    return api.get('/analytics/overview', { params: selectedAccount ? { account_id: selectedAccount } : {} })
      .then(({ data: response }) => setData(response))
      .catch(() => setData({
        summary: { likes: 0, comments: 0, shares: 0, impressions: 0, engagement_rate: 0 },
        by_platform: [],
        timeseries: [],
        top_posts: [],
        latest_posts: [],
        worst_posts: [],
        upcoming_posts: [],
      }))
  }, [selectedAccount])

  const syncAnalytics = useCallback(async (accountId = '') => {
    const syncKey = accountId ? String(accountId) : 'all'
    setSyncingAnalytics(syncKey)
    setSyncNotice(null)

    try {
      const { data: response } = await api.post('/analytics/sync', accountId ? { account_id: accountId } : {})
      setSyncNotice({ type: Number(response.failed || 0) > 0 ? 'error' : 'success', text: response.message || 'Analytics synced.' })
      await Promise.all([loadAccounts(), loadAnalytics()])
    } catch (error) {
      setSyncNotice({
        type: 'error',
        text: error.response?.data?.message || 'Analytics could not be synced right now.',
      })
    } finally {
      setSyncingAnalytics(null)
    }
  }, [loadAccounts, loadAnalytics])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    loadAnalytics()
    const interval = window.setInterval(loadAnalytics, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, loadAnalytics)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, loadAnalytics)
    }
  }, [loadAnalytics])

  const selectedAccountData = useMemo(
    () => accounts.find((account) => String(account.id) === String(selectedAccount)),
    [accounts, selectedAccount],
  )

  if (!data) return <PageLoader />
  const { summary, by_platform, timeseries } = data
  const byAccount = data.by_account || []
  const accountRows = accounts.map((account) => {
    const metrics = byAccount.find((row) => String(row.social_account_id) === String(account.id)) || {}
    const engagement = Number(metrics.engagement || 0)
    const impressions = Number(metrics.impressions || 0)
    return {
      account,
      metrics: {
        posts: Number(metrics.posts || 0),
        likes: Number(metrics.likes || 0),
        comments: Number(metrics.comments || 0),
        shares: Number(metrics.shares || 0),
        clicks: Number(metrics.clicks || 0),
        views: Number(metrics.views || 0),
        impressions,
        engagement,
        engagement_rate: impressions > 0 ? Number(metrics.engagement_rate || ((engagement / impressions) * 100).toFixed(2)) : 0,
      },
    }
  }).filter((row) => !selectedAccount || String(row.account.id) === String(selectedAccount))
  const postsByTab = {
    top: data.top_posts || [],
    latest: data.latest_posts || [],
    worst: data.worst_posts || [],
    upcoming: data.upcoming_posts || [],
  }
  const visiblePosts = postsByTab[postTab] || []
  const headerSyncKey = selectedAccount ? String(selectedAccount) : 'all'
  const headerSyncing = syncingAnalytics === headerSyncKey

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {selectedAccountData ? `Showing performance for ${selectedAccountData.name}.` : 'Showing performance across all connected accounts.'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => syncAnalytics(selectedAccount || '')}
            loading={headerSyncing}
            disabled={Boolean(syncingAnalytics && !headerSyncing)}
          >
            {!headerSyncing && <RefreshCw className="h-4 w-4" />}
            {headerSyncing ? 'Syncing...' : selectedAccountData ? 'Sync selected' : 'Sync analytics'}
          </Button>
          <AccountPicker
            accounts={accounts}
            value={selectedAccount}
            selectedAccount={selectedAccountData}
            search={accountSearch}
            open={accountOpen}
            onOpenChange={setAccountOpen}
            onSearch={setAccountSearch}
            onChange={(accountId) => {
              setSelectedAccount(accountId)
              setAccountOpen(false)
            }}
          />
        </div>
      </div>

      {syncNotice && (
        <div className={clsx(
          'rounded-xl border px-4 py-3 text-sm font-semibold',
          syncNotice.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
        )}>
          {syncNotice.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published" value={formatNumber(summary.published)} icon={CalendarClock} accent="emerald" />
        <StatCard label="Likes" value={formatNumber(summary.likes)} icon={Heart} accent="rose" />
        <StatCard label="Comments" value={formatNumber(summary.comments)} icon={MessageCircle} accent="sky" />
        <StatCard label="Impressions" value={formatNumber(summary.impressions)} icon={Eye} accent="brand" hint={`${summary.engagement_rate}% engagement`} />
      </div>

      <ChannelPerformance rows={accountRows} syncing={syncingAnalytics} onSync={syncAnalytics} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Engagement over time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="likes" stroke="#6366f1" fill="url(#g)" strokeWidth={2} />
              <Area type="monotone" dataKey="impressions" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">By platform</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={by_platform}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="platform" tick={{ fontSize: 10 }} tickFormatter={(p) => p?.slice(0, 4)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="engagement" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {POST_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPostTab(key)}
                className={clsx(
                  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  postTab === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { key: 'table', icon: Table2, label: 'Table' },
              { key: 'card', icon: LayoutGrid, label: 'Card' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPostView(key)}
                className={clsx(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  postView === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {postView === 'table' ? (
          <AnalyticsPostTable posts={visiblePosts} />
        ) : (
          <AnalyticsPostCards posts={visiblePosts} />
        )}
      </div>
    </div>
  )
}

function ChannelPerformance({ rows, syncing, onSync }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Connected channel analytics</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Real stored metrics by social account. Channels without captured metrics show zero instead of estimated data.</p>
        </div>
        <Badge color={rows.some((row) => row.metrics.posts > 0) ? 'emerald' : 'gray'}>{rows.length} connected</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Channel</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Posts</th>
              <th className="px-5 py-3 font-semibold">Engagement</th>
              <th className="px-5 py-3 font-semibold">Impressions</th>
              <th className="px-5 py-3 font-semibold">Clicks</th>
              <th className="px-5 py-3 font-semibold">Rate</th>
              <th className="px-5 py-3 font-semibold">Last sync</th>
              <th className="px-5 py-3 font-semibold">Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ account, metrics }) => {
              const rowSyncing = String(syncing) === String(account.id)

              return (
                <tr key={account.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{account.name}</p>
                        <p className="truncate text-xs text-slate-400">{account.username || account.platform_label || account.platform}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><Badge color={account.status === 'active' && !account.needs_reconnect ? 'emerald' : 'amber'}>{account.needs_reconnect ? 'Needs reconnect' : account.status}</Badge></td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatNumber(metrics.posts)}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatNumber(metrics.engagement)}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatNumber(metrics.impressions)}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatNumber(metrics.clicks)}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{metrics.engagement_rate}%</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(account.last_synced_at)}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onSync(account.id)}
                      disabled={Boolean(syncing)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <RefreshCw className={clsx('h-3.5 w-3.5', rowSyncing && 'animate-spin')} />
                      {rowSyncing ? 'Syncing' : 'Sync'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan="9" className="px-5 py-10 text-center text-slate-400">No connected channels match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function AccountPicker({ accounts, value, selectedAccount, search, open, onOpenChange, onSearch, onChange }) {
  const filteredAccounts = accounts.filter((account) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return `${account.name || ''} ${account.username || ''} ${account.platform_label || account.platform || ''}`.toLowerCase().includes(query)
  })

  return (
    <div className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{selectedAccount ? selectedAccount.name : 'All connected accounts'}</span>
          <span className="block truncate text-[11px] text-slate-400">{selectedAccount ? (selectedAccount.platform_label || selectedAccount.platform) : `${accounts.length} profiles available`}</span>
        </span>
        <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search account..."
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear account search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => onChange('')}
              className={clsx('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700', value === '' ? 'text-brand-600 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200')}
            >
              <span>
                <span className="block font-semibold">All connected accounts</span>
                <span className="block text-xs text-slate-400">Combined workspace analytics</span>
              </span>
              {value === '' && <Badge color="indigo">Active</Badge>}
            </button>
            {filteredAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onChange(account.id)}
                className={clsx('flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700', String(value) === String(account.id) ? 'text-brand-600 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200')}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{account.name}</span>
                  <span className="block truncate text-xs text-slate-400">{account.username || account.platform_label || account.platform}</span>
                </span>
                <PlatformBadge platform={account.platform} size="sm" />
              </button>
            ))}
            {filteredAccounts.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">No accounts match your search.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function AnalyticsPostTable({ posts }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Post</th>
            <th className="px-5 py-3 font-semibold">Platform</th>
            <th className="px-5 py-3 font-semibold">Engagement</th>
            <th className="px-5 py-3 font-semibold">Impressions</th>
            <th className="px-5 py-3 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {posts.map((post) => (
            <tr key={`${post.status}-${post.id}`} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className="px-5 py-4"><p className="max-w-xl truncate font-medium text-slate-800 dark:text-slate-100">{post.content || 'Untitled post'}</p></td>
              <td className="px-5 py-4"><PlatformBadge platform={post.platform} size="sm" /></td>
              <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatNumber(post.engagement || post.likes + post.comments + post.shares)}</td>
              <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatNumber(post.impressions)}</td>
              <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(post.published_at || post.scheduled_at)}</td>
            </tr>
          ))}
          {posts.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">No posts found for this view.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function AnalyticsPostCards({ posts }) {
  if (posts.length === 0) {
    return <div className="text-center text-sm text-slate-400">No posts found for this view.</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {posts.map((post) => (
        <article key={`${post.status}-${post.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center justify-between gap-3">
            <PlatformBadge platform={post.platform} size="sm" />
            <Badge color={post.status === 'published' ? 'emerald' : 'amber'}>{post.status === 'published' ? 'Published' : 'Upcoming'}</Badge>
          </div>
          <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-800 dark:text-slate-100">{post.content || 'Untitled post'}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric icon={Heart} label="Likes" value={post.likes} tone="rose" />
            <MiniMetric icon={MessageCircle} label="Comments" value={post.comments} tone="sky" />
            <MiniMetric icon={Share2} label="Shares" value={post.shares} tone="emerald" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>{formatDate(post.published_at || post.scheduled_at)}</span>
            <span>{formatNumber(post.impressions)} impressions</span>
          </div>
        </article>
      ))}
    </div>
  )
}

function MiniMetric({ icon: Icon, label, value, tone }) {
  const tones = {
    rose: 'text-rose-500',
    sky: 'text-sky-500',
    emerald: 'text-emerald-500',
  }

  return (
    <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
      <Icon className={clsx('h-4 w-4', tones[tone])} />
      <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{formatNumber(value)}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}
