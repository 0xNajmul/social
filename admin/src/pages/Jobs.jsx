import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Badge, PageLoader } from '../components/ui'

export default function Jobs() {
  const [scheduled, setScheduled] = useState(null)
  const [failedPosts, setFailedPosts] = useState([])
  const [failedJobs, setFailedJobs] = useState([])

  const load = () => {
    api.get('/admin/jobs/scheduled').then(({ data }) => setScheduled(data.data))
    api.get('/admin/jobs/failed-posts').then(({ data }) => setFailedPosts(data.data))
    api.get('/admin/jobs/failed').then(({ data }) => setFailedJobs(data.data))
  }
  useEffect(load, [])

  const retry = async () => { await api.post('/admin/jobs/retry-failed'); alert('Failed jobs re-queued.'); load() }

  if (!scheduled) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Jobs &amp; Queue</h1>
        <Button variant="secondary" onClick={retry}><RefreshCw className="h-4 w-4" /> Retry all failed jobs</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-white">Scheduled <Badge>{scheduled.length}</Badge></h2>
          <ul className="space-y-2 text-sm text-slate-400">
            {scheduled.slice(0, 10).map((s) => (
              <li key={s.id} className="flex justify-between"><span className="truncate">{s.variant?.post?.content || 'Post'}</span><span className="text-xs">{new Date(s.scheduled_at).toLocaleString()}</span></li>
            ))}
            {scheduled.length === 0 && <li className="text-slate-600">None</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-white">Failed posts <Badge color="rose">{failedPosts.length}</Badge></h2>
          <ul className="space-y-2 text-sm text-slate-400">
            {failedPosts.slice(0, 10).map((f) => (
              <li key={f.id}><p className="truncate text-slate-300">{f.platform}</p><p className="truncate text-xs text-rose-400">{f.error_message}</p></li>
            ))}
            {failedPosts.length === 0 && <li className="text-slate-600">None</li>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-white">Failed queue jobs <Badge color="rose">{failedJobs.length}</Badge></h2>
          <ul className="space-y-2 text-sm text-slate-400">
            {failedJobs.slice(0, 10).map((j) => (
              <li key={j.id} className="truncate text-xs">{j.exception?.split('\n')[0] || j.uuid}</li>
            ))}
            {failedJobs.length === 0 && <li className="text-slate-600">None</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
