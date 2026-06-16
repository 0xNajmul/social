import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, FileEdit, AlertTriangle, Share2, Clock3, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Card, StatCard, PageLoader, EmptyState, Badge, Button } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'
import DateTimeField from '../components/DateTimeField'

const RANGES = [
  ['today', 'Today'],
  ['month', 'Monthly'],
  ['custom', 'Custom'],
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [range, setRange] = useState('month')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [draftCustom, setDraftCustom] = useState({ from: '', to: '' })
  const [customOpen, setCustomOpen] = useState(false)

  useEffect(() => {
    setData(null)
    api.get('/dashboard', {
      params: {
        range,
        from: range === 'custom' ? custom.from || undefined : undefined,
        to: range === 'custom' ? custom.to || undefined : undefined,
      },
    }).then(({ data }) => setData(data)).catch(() => setData({ error: true }))
  }, [custom.from, custom.to, range])

  const openComposerModal = () => {
    window.dispatchEvent(new CustomEvent('postflow:quick-action', { detail: { type: 'composer' } }))
  }

  if (!data) return <PageLoader />

  const { stats, usage, upcoming, recent_activity } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500">Here's what's happening across your channels.</p>
        </div>
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {RANGES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'custom') {
                    setDraftCustom(custom)
                    setCustomOpen((value) => !value)
                    return
                  }
                  setRange(key)
                  setCustomOpen(false)
                }}
                className={clsx(
                  'whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition',
                  range === key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {range === 'custom' && customOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <CalendarDays className="h-4 w-4 text-brand-500" /> Choose custom dates
              </div>
              <div className="grid gap-3">
                <DateTimeField label="From" type="date" value={draftCustom.from} onChange={(event) => setDraftCustom({ ...draftCustom, from: event.target.value })} />
                <DateTimeField label="To" type="date" value={draftCustom.to} onChange={(event) => setDraftCustom({ ...draftCustom, to: event.target.value })} />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCustom(draftCustom)
                    setRange('custom')
                    setCustomOpen(false)
                  }}
                >
                  Apply dates
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Scheduled" value={stats.scheduled} icon={CalendarClock} accent="brand" />
        <StatCard label="Published (mo)" value={stats.published_this_month} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Drafts" value={stats.drafts} icon={FileEdit} accent="sky" />
        <StatCard label="Failed" value={stats.failed} icon={AlertTriangle} accent="rose" />
        <StatCard label="Accounts" value={stats.connected_accounts} icon={Share2} accent="brand" />
        <StatCard label="Awaiting approval" value={stats.pending_approval} icon={Clock3} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Upcoming posts</h2>
            <Link to="/app/organizer" className="text-sm font-medium text-brand-600">View organizer</Link>
          </div>
          <div className="p-3">
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing scheduled" description="Create and schedule your first post." action={<Button type="button" size="sm" onClick={openComposerModal}>Compose</Button>} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcoming.map((post) => (
                  <li key={post.id} className="flex items-center gap-3 px-2 py-3">
                    <div className="flex -space-x-2">
                      {post.variants.slice(0, 4).map((v) => <PlatformBadge key={v.id} platform={v.platform} size="sm" />)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700 dark:text-slate-200">{post.content || 'Untitled'}</p>
                      <p className="text-xs text-slate-400">{new Date(post.scheduled_at).toLocaleString()}</p>
                    </div>
                    <Badge color={post.status_color}>{post.status_label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Usage */}
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
          <Link to="/app/billing" className="mt-5 block"><Button variant="secondary" className="w-full">Manage plan</Button></Link>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent activity</h2>
        </div>
        <ul className="divide-y divide-slate-100 p-3 dark:divide-slate-800">
          {recent_activity.length === 0 && <li className="px-2 py-4 text-sm text-slate-400">No activity yet.</li>}
          {recent_activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-2 py-3 text-sm">
              <span className="text-slate-700 dark:text-slate-200">
                <span className="font-medium">{a.user?.name || 'System'}</span> · {a.description || a.action}
              </span>
              <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
