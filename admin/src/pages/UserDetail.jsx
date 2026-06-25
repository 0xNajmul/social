import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LogIn, Mail, ShieldCheck, UserRound } from 'lucide-react'
import api from '../lib/api'
import { impersonationUrl } from '../lib/impersonation'
import { Badge, Button, Card, PageLoader } from '../components/ui'

export default function UserDetail() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/admin/users/${id}`).then(({ data }) => setUser(data.data))
  }, [id])

  const loginAsUser = async () => {
    const target = window.open('about:blank', '_blank')
    setBusy(true)
    try {
      const { data } = await api.post(`/admin/users/${id}/impersonate`)
      const url = impersonationUrl(data.token)
      if (target) target.location.href = url
      else window.location.assign(url)
    } catch {
      target?.close()
    } finally {
      setBusy(false)
    }
  }

  if (!user) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link to="/users" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300 hover:text-brand-200"><ArrowLeft className="h-4 w-4" /> Back to users</Link>
          <h1 className="mt-3 text-2xl font-bold text-white">{user.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{user.email}</p>
        </div>
        <Button onClick={loginAsUser} loading={busy}><LogIn className="h-4 w-4" /> Login as user</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><UserRound className="h-5 w-5 text-brand-300" /><p className="mt-3 text-sm text-slate-400">Account type</p><p className="mt-1 font-semibold text-white">{user.is_admin ? 'Administrator' : 'User'}</p></Card>
        <Card className="p-5"><ShieldCheck className="h-5 w-5 text-emerald-300" /><p className="mt-3 text-sm text-slate-400">Two factor</p><p className="mt-1 font-semibold text-white">{user.two_factor_enabled ? 'Enabled' : 'Not enabled'}</p></Card>
        <Card className="p-5"><Mail className="h-5 w-5 text-amber-300" /><p className="mt-3 text-sm text-slate-400">Last login</p><p className="mt-1 font-semibold text-white">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-white">Profile details</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Detail label="Name" value={user.name} />
          <Detail label="Email" value={user.email} />
          <Detail label="Timezone" value={user.timezone || '-'} />
          <Detail label="Locale" value={user.locale || '-'} />
          <Detail label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleString() : '-'} />
          <Detail label="Current workspace ID" value={user.current_workspace_id || '-'} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold text-white">Workspaces</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="p-4">Workspace</th><th className="p-4">Role</th><th className="p-4">Plan</th><th className="p-4">Timezone</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(user.workspaces || []).map((workspace) => (
                <tr key={workspace.id}>
                  <td className="p-4 text-white">{workspace.name}<p className="text-xs text-slate-500">{workspace.slug}</p></td>
                  <td className="p-4"><Badge>{workspace.role || '-'}</Badge></td>
                  <td className="p-4 text-slate-400">{workspace.subscription?.plan?.name || '-'}</td>
                  <td className="p-4 text-slate-400">{workspace.timezone || '-'}</td>
                </tr>
              ))}
              {(user.workspaces || []).length === 0 && <tr><td colSpan="4" className="p-10 text-center text-slate-500">No workspaces found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-800/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-100">{value}</p>
    </div>
  )
}
