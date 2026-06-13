import { useEffect, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { Card, Input, Badge, Button, PageLoader } from '../components/ui'

export default function Users() {
  const [users, setUsers] = useState(null)
  const [search, setSearch] = useState('')

  const load = (q = '') => api.get('/admin/users', { params: { search: q } }).then(({ data }) => setUsers(data.data))
  useEffect(() => { load() }, [])

  const toggleAdmin = async (u) => {
    await api.put(`/admin/users/${u.id}`, { is_admin: !u.is_admin })
    load(search)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Users</h1>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="pl-9" onKeyDown={(e) => e.key === 'Enter' && load(search)} />
        </div>
        <Button variant="secondary" onClick={() => load(search)}>Search</Button>
      </div>

      {!users ? <PageLoader /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Workspaces</th><th className="p-4">Role</th><th className="p-4">Joined</th><th className="p-4"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="text-slate-300">
                  <td className="p-4 font-medium text-white">{u.name}</td>
                  <td className="p-4 text-slate-400">{u.email}</td>
                  <td className="p-4">{u.workspaces_count ?? '—'}</td>
                  <td className="p-4">{u.is_admin ? <Badge color="rose">Admin</Badge> : <Badge>User</Badge>}</td>
                  <td className="p-4 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <Button size="sm" variant="secondary" onClick={() => toggleAdmin(u)}>
                      <ShieldCheck className="h-3.5 w-3.5" /> {u.is_admin ? 'Revoke admin' : 'Make admin'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
