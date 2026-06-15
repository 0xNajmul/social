import { useEffect, useState } from 'react'
import { AlertTriangle, Building2, Edit3, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader } from '../components/ui'

const EMPTY = { name: '', owner_id: '', timezone: 'UTC', plan_id: '', trial_days: 14, brand_color: '#6366f1', trial_ends_at: '' }

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState(null)
  const [users, setUsers] = useState([])
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [message, setMessage] = useState(null)
  const [loadError, setLoadError] = useState('')

  const load = async (query = search) => {
    setLoadError('')
    try {
      const { data } = await api.get('/admin/workspaces', { params: { search: query || undefined, per_page: 100 } })
      setWorkspaces(data.data)
    } catch (error) {
      setWorkspaces([])
      setLoadError(error.response?.data?.message || 'Could not load workspaces. Check the API server and try again.')
    }
  }
  useEffect(() => {
    api.get('/admin/workspaces', { params: { per_page: 100 } })
      .then(({ data }) => setWorkspaces(data.data))
      .catch((error) => {
        setWorkspaces([])
        setLoadError(error.response?.data?.message || 'Could not load workspaces. Check the API server and try again.')
      })
    api.get('/admin/users', { params: { per_page: 100 } }).then(({ data }) => setUsers(data.data)).catch(() => setUsers([]))
    api.get('/admin/plans').then(({ data }) => setPlans(data.data)).catch(() => setPlans([]))
  }, [])

  const openCreate = () => { setEditing('new'); setForm({ ...EMPTY, owner_id: users[0]?.id || '', plan_id: plans.find((plan) => plan.is_active)?.id || plans[0]?.id || '' }); setErrors({}) }
  const openEdit = (workspace) => { setEditing(workspace); setForm({ name: workspace.name, owner_id: workspace.owner?.id || '', timezone: workspace.timezone, plan_id: workspace.subscription?.plan?.id || '', trial_days: 14, brand_color: workspace.brand_color || '#6366f1', trial_ends_at: toDateTimeInput(workspace.trial_ends_at) }); setErrors({}) }

  const save = async (event) => {
    event.preventDefault(); setBusy(true); setErrors({})
    try {
      if (editing === 'new') {
        await api.post('/admin/workspaces', { name: form.name, owner_id: Number(form.owner_id), timezone: form.timezone, plan_id: form.plan_id ? Number(form.plan_id) : null, trial_days: Number(form.trial_days) })
      } else {
        await api.put(`/admin/workspaces/${editing.slug}`, { name: form.name, owner_id: Number(form.owner_id), timezone: form.timezone, plan_id: Number(form.plan_id), brand_color: form.brand_color, trial_ends_at: form.trial_ends_at ? new Date(form.trial_ends_at).toISOString() : null })
      }
      setMessage({ type: 'success', text: editing === 'new' ? 'Workspace created.' : 'Workspace updated.' }); setEditing(null); await load()
    } catch (error) { setErrors(error.response?.data?.errors || {}); if (!error.response?.data?.errors) setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save the workspace.' }) }
    finally { setBusy(false) }
  }

  const remove = async (workspace) => {
    setBusy(true)
    try { await api.delete(`/admin/workspaces/${workspace.slug}`); setMessage({ type: 'success', text: 'Workspace deleted.' }); setConfirmDelete(null); await load() }
    catch (error) { setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete the workspace.' }) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workspaces</h1>
          <p className="mt-1 text-sm text-slate-400">Manage ownership, plans, trials, and workspace lifecycle.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} className="pl-9" placeholder="Search workspaces..." />
          </div>
          <Button variant="secondary" onClick={() => load()}>Search</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add workspace</Button>
        </div>
      </div>
      {message && <Notice message={message} />}
      {loadError && <div className="flex flex-col gap-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300 sm:flex-row sm:items-center"><AlertTriangle className="h-5 w-5 shrink-0" /><span className="flex-1">{loadError}</span><Button size="sm" variant="secondary" onClick={() => load()}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button></div>}

      {!workspaces ? <PageLoader /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead className="border-b border-slate-800 bg-slate-800/30 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Workspace</th><th className="p-4">Owner</th><th className="p-4">Members</th><th className="p-4">Accounts</th><th className="p-4">Posts</th><th className="p-4">Plan</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{workspaces.map((workspace) => <tr key={workspace.id} className="text-slate-300 transition hover:bg-slate-800/35"><td className="p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white" style={{ backgroundColor: workspace.brand_color || '#4f46e5' }}>{workspace.name?.[0]}</span><div><p className="font-medium text-white">{workspace.name}</p><p className="text-xs text-slate-500">{workspace.slug}</p></div></div></td><td className="p-4"><p className="text-slate-200">{workspace.owner?.name || 'Unknown'}</p><p className="text-xs text-slate-500">{workspace.owner?.email}</p></td><td className="p-4">{workspace.members_count}</td><td className="p-4">{workspace.social_accounts_count}</td><td className="p-4">{workspace.posts_count ?? 0}</td><td className="p-4">{workspace.subscription?.plan?.name || '—'}</td><td className="p-4">{workspace.on_trial ? <Badge color="amber">Trial</Badge> : <Badge color="emerald">Active</Badge>}</td><td className="p-4"><div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => openEdit(workspace)}><Edit3 className="h-3.5 w-3.5" /> Edit</Button><Button size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-950/30" onClick={() => setConfirmDelete(workspace)}><Trash2 className="h-3.5 w-3.5" /></Button></div></td></tr>)}</tbody></table></div></Card>}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Create workspace' : `Edit ${editing?.name || 'workspace'}`} description="Assign ownership, plan access, and workspace defaults." onClose={() => setEditing(null)}><form onSubmit={save} className="grid gap-5 p-5 sm:grid-cols-2"><Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name?.[0]} required /><Input label="Timezone" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} error={errors.timezone?.[0]} required /><Select label="Owner" value={form.owner_id} onChange={(value) => setForm({ ...form, owner_id: value })} options={users.map((user) => [user.id, `${user.name} (${user.email})`])} error={errors.owner_id?.[0]} required /><Select label="Plan" value={form.plan_id} onChange={(value) => setForm({ ...form, plan_id: value })} options={plans.map((plan) => [plan.id, plan.name])} error={errors.plan_id?.[0]} required />{editing === 'new' ? <Input label="Trial days" type="number" min="0" max="365" value={form.trial_days} onChange={(event) => setForm({ ...form, trial_days: event.target.value })} error={errors.trial_days?.[0]} /> : <><Input label="Trial ends at" type="datetime-local" value={form.trial_ends_at} onChange={(event) => setForm({ ...form, trial_ends_at: event.target.value })} error={errors.trial_ends_at?.[0]} /><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-300">Brand color</span><div className="flex gap-3"><input type="color" value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} className="h-11 w-16 rounded-xl border border-slate-700 bg-slate-800 p-1" /><Input value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} /></div></label></>}<div className="flex justify-end gap-2 border-t border-slate-800 pt-4 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}><Building2 className="h-4 w-4" /> Save workspace</Button></div></form></Modal>

      <Modal open={Boolean(confirmDelete)} title="Delete workspace" description="The workspace and its content will no longer be available." onClose={() => setConfirmDelete(null)} size="md"><div className="p-5"><div className="flex gap-3 rounded-xl border border-rose-900/50 bg-rose-950/30 p-4"><Trash2 className="h-5 w-5 shrink-0 text-rose-400" /><p className="text-sm text-rose-200">Delete <strong>{confirmDelete?.name}</strong>? This is a destructive administrative action.</p></div><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => remove(confirmDelete)}>Delete workspace</Button></div></div></Modal>
    </div>
  )
}

function Select({ label, value, onChange, options, error, ...props }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" {...props}><option value="">Select...</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>{error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}</label> }
function Notice({ message }) { return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div> }
function toDateTimeInput(value) { if (!value) return ''; const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16) }
