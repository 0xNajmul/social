import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit3, Eye, LogIn, Plus, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, Modal, PageLoader } from '../components/ui'

const EMPTY = { name: '', email: '', password: '', timezone: 'UTC', locale: 'en', is_admin: false }

export default function Users() {
  const { admin } = useAuth()
  const [users, setUsers] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [message, setMessage] = useState(null)

  const load = (query = search) => api.get('/admin/users', { params: { search: query || undefined, per_page: 100 } }).then(({ data }) => setUsers(data.data))
  useEffect(() => { api.get('/admin/users', { params: { per_page: 100 } }).then(({ data }) => setUsers(data.data)) }, [])

  const openCreate = () => { setEditing('new'); setForm(EMPTY); setErrors({}) }
  const openEdit = (user) => { setEditing(user); setForm({ name: user.name, email: user.email, password: '', timezone: user.timezone || 'UTC', locale: user.locale || 'en', is_admin: user.is_admin }); setErrors({}) }
  const close = () => { setEditing(null); setErrors({}) }

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const payload = { ...form }
      if (editing !== 'new' && !payload.password) delete payload.password
      if (editing === 'new') await api.post('/admin/users', payload)
      else await api.put(`/admin/users/${editing.id}`, payload)
      setMessage({ type: 'success', text: editing === 'new' ? 'User created.' : 'User updated.' })
      close()
      await load()
    } catch (error) {
      setErrors(error.response?.data?.errors || {})
      if (!error.response?.data?.errors) setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save the user.' })
    } finally { setBusy(false) }
  }

  const remove = async (user) => {
    setBusy(true)
    try {
      await api.delete(`/admin/users/${user.id}`)
      setMessage({ type: 'success', text: 'User deleted.' })
      setConfirmDelete(null)
      await load()
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete the user.' })
    } finally { setBusy(false) }
  }

  const loginAsUser = async (user) => {
    const target = window.open('about:blank', '_blank')
    setBusy(true)
    try {
      const { data } = await api.post(`/admin/users/${user.id}/impersonate`)
      const frontend = window.location.origin.replace('5174', '5173')
      if (target) target.location.href = `${frontend}/impersonate?token=${encodeURIComponent(data.token)}`
      else window.location.assign(`${frontend}/impersonate?token=${encodeURIComponent(data.token)}`)
    } catch (error) {
      target?.close()
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not login as this user.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="mt-1 text-sm text-slate-400">Create accounts, update access, and manage user records.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." className="pl-9" onKeyDown={(event) => event.key === 'Enter' && load()} />
          </div>
          <Button variant="secondary" onClick={() => load()}>Search</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add user</Button>
        </div>
      </div>
      {message && <Notice message={message} />}

      {!users ? <PageLoader /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-slate-800 bg-slate-800/30 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">User</th><th className="p-4">Workspaces</th><th className="p-4">Access</th><th className="p-4">Last login</th><th className="p-4">Joined</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{users.map((user) => <tr key={user.id} className="text-slate-300 transition hover:bg-slate-800/35"><td className="p-4"><div className="flex items-center gap-3">{user.avatar_url ? <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600/20 text-brand-300"><UserRound className="h-4 w-4" /></span>}<div><p className="font-medium text-white">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></div></div></td><td className="p-4">{user.workspaces_count ?? 0}</td><td className="p-4">{user.is_admin ? <Badge color="rose">Administrator</Badge> : <Badge>User</Badge>}</td><td className="p-4 text-slate-500">{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</td><td className="p-4 text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td><td className="p-4"><div className="flex justify-end gap-2"><Link to={`/users/${user.id}`}><ActionIcon tone="view" label={`View ${user.name}`} title="View user"><Eye className="h-4 w-4" /></ActionIcon></Link><ActionIcon tone="edit" label={`Edit ${user.name}`} title="Edit user" onClick={() => openEdit(user)}><Edit3 className="h-4 w-4" /></ActionIcon><ActionIcon tone="login" label={`Login as ${user.name}`} title="Login as user" onClick={() => loginAsUser(user)} disabled={busy}><LogIn className="h-4 w-4" /></ActionIcon><ActionIcon tone="delete" label={`Delete ${user.name}`} title="Delete user" disabled={user.id === admin?.id || user.is_admin} onClick={() => setConfirmDelete(user)}><Trash2 className="h-4 w-4" /></ActionIcon></div></td></tr>)}</tbody></table></div></Card>}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Create user' : 'Edit user'} description="Manage identity and administrator access." onClose={close}>
        <form onSubmit={save} className="grid gap-5 p-5 sm:grid-cols-2"><Input label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name?.[0]} required /><Input label="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} error={errors.email?.[0]} required /><Input label={editing === 'new' ? 'Password' : 'New password (optional)'} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} error={errors.password?.[0]} required={editing === 'new'} /><Input label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} error={errors.timezone?.[0]} required /><Input label="Locale" value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })} error={errors.locale?.[0]} required /><label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 sm:self-end"><input type="checkbox" checked={form.is_admin} onChange={(event) => setForm({ ...form, is_admin: event.target.checked })} disabled={editing?.id === admin?.id} className="h-4 w-4 rounded border-slate-600 text-brand-600" /><div><p className="text-sm font-medium text-slate-200">Administrator access</p><p className="text-xs text-slate-500">Access the admin console.</p></div></label><div className="flex justify-end gap-2 border-t border-slate-800 pt-4 sm:col-span-2"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" loading={busy}><ShieldCheck className="h-4 w-4" /> Save user</Button></div></form>
      </Modal>

      <Modal open={Boolean(confirmDelete)} title="Delete user" description="This action cannot be undone." onClose={() => setConfirmDelete(null)} size="md"><div className="p-5"><p className="text-sm text-slate-300">Delete <strong className="text-white">{confirmDelete?.name}</strong>? Users who own workspaces must transfer or delete them first.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => remove(confirmDelete)}>Delete user</Button></div></div></Modal>
    </div>
  )
}

function Notice({ message }) { return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div> }

function ActionIcon({ tone, label, title, children, ...props }) {
  const tones = {
    view: 'border-sky-800/60 bg-sky-950/50 text-sky-300 hover:bg-sky-900/70',
    edit: 'border-amber-800/60 bg-amber-950/50 text-amber-300 hover:bg-amber-900/70',
    login: 'border-emerald-800/60 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/70',
    delete: 'border-rose-800/60 bg-rose-950/50 text-rose-300 hover:bg-rose-900/70 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600',
  }

  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
      aria-label={label}
      title={title}
      {...props}
    >
      {children}
    </button>
  )
}
