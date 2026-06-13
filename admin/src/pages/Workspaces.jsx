import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Card, Badge, PageLoader } from '../components/ui'

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState(null)
  useEffect(() => { api.get('/admin/workspaces').then(({ data }) => setWorkspaces(data.data)) }, [])
  if (!workspaces) return <PageLoader />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Workspaces</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            <tr><th className="p-4">Name</th><th className="p-4">Members</th><th className="p-4">Accounts</th><th className="p-4">Posts</th><th className="p-4">Plan</th><th className="p-4">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {workspaces.map((w) => (
              <tr key={w.id} className="text-slate-300">
                <td className="p-4 font-medium text-white">{w.name}</td>
                <td className="p-4">{w.members_count}</td>
                <td className="p-4">{w.social_accounts_count}</td>
                <td className="p-4">{w.posts_count ?? '—'}</td>
                <td className="p-4">{w.subscription?.plan?.name || '—'}</td>
                <td className="p-4">{w.on_trial ? <Badge color="amber">Trial</Badge> : <Badge color="emerald">Active</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
