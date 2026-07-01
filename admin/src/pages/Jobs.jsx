import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Badge, PageLoader } from '../components/ui'

const TABS = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'pendingJobs', label: 'Pending queue' },
  { key: 'failedPosts', label: 'Failed posts' },
  { key: 'failedJobs', label: 'Failed queue jobs' },
]

export default function Jobs() {
  const [scheduled, setScheduled] = useState(null)
  const [pendingJobs, setPendingJobs] = useState([])
  const [failedPosts, setFailedPosts] = useState([])
  const [failedJobs, setFailedJobs] = useState([])
  const [tab, setTab] = useState('scheduled')

  const load = () => {
    api.get('/admin/jobs/scheduled').then(({ data }) => setScheduled(data.data))
    api.get('/admin/jobs/pending').then(({ data }) => setPendingJobs(data.data))
    api.get('/admin/jobs/failed-posts').then(({ data }) => setFailedPosts(data.data))
    api.get('/admin/jobs/failed').then(({ data }) => setFailedJobs(data.data))
  }
  useEffect(load, [])

  const retry = async () => { await api.post('/admin/jobs/retry-failed'); alert('Failed jobs re-queued.'); load() }

  if (!scheduled) return <PageLoader />

  const counts = { scheduled: scheduled.length, pendingJobs: pendingJobs.length, failedPosts: failedPosts.length, failedJobs: failedJobs.length }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs &amp; Queue</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor scheduled posts, failed publishing attempts and failed queue jobs.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${tab === item.key ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
              >
                {item.label} <span className="ml-1 opacity-70">{counts[item.key]}</span>
              </button>
            ))}
          </div>
          <Button variant="secondary" onClick={retry}><RefreshCw className="h-4 w-4" /> Retry</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {tab === 'scheduled' && <ScheduledTable rows={scheduled} />}
        {tab === 'pendingJobs' && <PendingJobsTable rows={pendingJobs} />}
        {tab === 'failedPosts' && <FailedPostsTable rows={failedPosts} />}
        {tab === 'failedJobs' && <FailedJobsTable rows={failedJobs} />}
      </Card>
    </div>
  )
}

function PendingJobsTable({ rows }) {
  return (
    <Table columns={['Job', 'Queue', 'Attempts', 'Available at', 'Created']}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-slate-800">
          <td className="px-3 py-2"><p className="max-w-lg truncate text-white">{row.display_name || 'Queued job'}</p></td>
          <td className="px-3 py-2 text-slate-400">{row.queue || '-'}</td>
          <td className="px-3 py-2 text-slate-400">{row.attempts ?? 0}</td>
          <td className="px-3 py-2 text-slate-400">{row.available_at ? new Date(row.available_at).toLocaleString() : '-'}</td>
          <td className="px-3 py-2 text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
        </tr>
      ))}
      {rows.length === 0 && <EmptyRow colSpan={5} text="No pending queue jobs." />}
    </Table>
  )
}

function ScheduledTable({ rows }) {
  return (
    <Table columns={['Post', 'Variant', 'Scheduled at', 'Status']}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-slate-800">
          <td className="px-3 py-2"><p className="max-w-md truncate text-white">{row.variant?.post?.content || 'Post'}</p></td>
          <td className="px-3 py-2 text-slate-400">#{row.post_variant_id}</td>
          <td className="px-3 py-2 text-slate-400">{row.scheduled_at ? new Date(row.scheduled_at).toLocaleString() : '-'}</td>
          <td className="px-3 py-2"><Badge>{row.status}</Badge></td>
        </tr>
      ))}
      {rows.length === 0 && <EmptyRow colSpan={4} text="No scheduled posts." />}
    </Table>
  )
}

function FailedPostsTable({ rows }) {
  return (
    <Table columns={['Platform', 'Post', 'Error', 'Created']}>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-slate-800">
          <td className="px-3 py-2"><Badge color="rose">{row.platform}</Badge></td>
          <td className="px-3 py-2"><p className="max-w-sm truncate text-slate-300">{row.variant?.post?.content || 'Post'}</p></td>
          <td className="px-3 py-2"><p className="max-w-md truncate text-rose-300">{row.error_message || '-'}</p></td>
          <td className="px-3 py-2 text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
        </tr>
      ))}
      {rows.length === 0 && <EmptyRow colSpan={4} text="No failed posts." />}
    </Table>
  )
}

function FailedJobsTable({ rows }) {
  return (
    <Table columns={['UUID', 'Queue', 'Exception', 'Failed at']}>
      {rows.map((row) => (
        <tr key={row.id || row.uuid} className="border-t border-slate-800">
          <td className="px-3 py-2"><code className="text-xs text-slate-400">{row.uuid || row.id}</code></td>
          <td className="px-3 py-2 text-slate-400">{row.queue || '-'}</td>
          <td className="px-3 py-2"><p className="max-w-xl truncate text-rose-300">{row.exception?.split('\n')[0] || '-'}</p></td>
          <td className="px-3 py-2 text-slate-500">{row.failed_at ? new Date(row.failed_at).toLocaleString() : '-'}</td>
        </tr>
      ))}
      {rows.length === 0 && <EmptyRow colSpan={4} text="No failed queue jobs." />}
    </Table>
  )
}

function Table({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-slate-800/40 uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th key={column} className="px-3 py-2 font-semibold">{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function EmptyRow({ colSpan, text }) {
  return <tr><td colSpan={colSpan} className="px-3 py-10 text-center text-slate-500">{text}</td></tr>
}
