import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, FileEdit, AlertTriangle, Share2, Clock3, PenSquare } from 'lucide-react'
import api from '../lib/api'
import { Card, StatCard, PageLoader, EmptyState, Badge, Button } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).catch(() => setData({ error: true }))
  }, [])

  if (!data) return <PageLoader />

  const { stats, usage, upcoming, recent_activity } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500">Here's what's happening across your channels.</p>
        </div>
        <Link to="/app/composer"><Button><PenSquare className="h-4 w-4" /> New post</Button></Link>
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
            <Link to="/app/calendar" className="text-sm font-medium text-brand-600">View calendar</Link>
          </div>
          <div className="p-3">
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing scheduled" description="Create and schedule your first post." action={<Link to="/app/composer"><Button size="sm">Compose</Button></Link>} />
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
