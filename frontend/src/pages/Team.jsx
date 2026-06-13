import { useEffect, useState } from 'react'
import { UserPlus, Mail } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Input, Badge, PageLoader } from '../components/ui'

const ROLES = ['admin', 'manager', 'editor', 'viewer']

export default function Team() {
  const [data, setData] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/team').then(({ data }) => setData(data))
  useEffect(() => { load() }, [])

  const invite = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/team/invite', { email, role })
      setEmail('')
      load()
    } catch (err) {
      alert(err.response?.data?.message || 'Could not invite')
    } finally { setBusy(false) }
  }

  if (!data) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team</h1>
        <p className="text-sm text-slate-500">Invite teammates and manage roles &amp; approvals.</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Invite a teammate</h2>
        <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required /></div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm capitalize dark:border-slate-700 dark:bg-slate-800">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <Button type="submit" loading={busy}><UserPlus className="h-4 w-4" /> Invite</Button>
        </form>
      </Card>

      <Card>
        <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="font-semibold text-slate-900 dark:text-white">Members</h2></div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{m.name?.[0]}</span>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
              </div>
              <Badge color="indigo">{m.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {data.invitations.length > 0 && (
        <Card>
          <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="font-semibold text-slate-900 dark:text-white">Pending invitations</h2></div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between p-4 text-sm">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Mail className="h-4 w-4 text-slate-400" /> {i.email}</span>
                <Badge color="amber">{i.role} · pending</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
