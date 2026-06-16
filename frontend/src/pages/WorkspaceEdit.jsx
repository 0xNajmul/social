import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Save } from 'lucide-react'
import api from '../lib/api'
import { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, PageLoader } from '../components/ui'
import { timezones } from '../lib/timezones'

export default function WorkspaceEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { workspaces, activeWorkspace, switchWorkspace, reload } = useAuth()
  const workspace = workspaces.find((item) => String(item.id) === String(id))
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!workspace) return
    setForm({
      name: workspace.name || '',
      timezone: workspace.timezone || 'UTC',
      brand_color: workspace.brand_color || '#6366f1',
      settings: workspace.settings || {},
    })
  }, [workspace])

  if (!workspace || !form) return <PageLoader />

  const active = workspace.slug === activeWorkspace?.slug
  const canUpdate = ['owner', 'admin'].includes(workspace.role)

  const save = async (event) => {
    event.preventDefault()
    if (!canUpdate) return

    setBusy(true)
    setMessage(null)
    try {
      if (!active) {
        workspaceStore.set(workspace.slug)
        await switchWorkspace(workspace.slug)
      }
      await api.put('/workspace', form)
      await reload()
      setMessage({ type: 'success', text: 'Workspace updated.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not update workspace.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link to="/app/workspaces" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"><ArrowLeft className="h-4 w-4" /> Back to workspaces</Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit workspace #{workspace.id}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Configure workspace identity, timezone, and brand defaults.</p>
        </div>
        <Badge color={active ? 'indigo' : 'slate'}>{active ? 'Active workspace' : 'Will switch on save'}</Badge>
      </div>

      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'}`}>{message.text}</div>}

      {!canUpdate && (
        <Card className="p-5">
          <p className="font-semibold text-slate-900 dark:text-white">Read-only access</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Only workspace owners and admins can edit this workspace.</p>
        </Card>
      )}

      <form onSubmit={save}>
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: form.brand_color }}><Building2 className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Workspace details</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Workspace slug: {workspace.slug}</p>
            </div>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!canUpdate} required />
            <TimezoneSelect value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} disabled={!canUpdate} />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Brand color</span>
              <div className="flex items-center gap-3">
                <input type="color" value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} disabled={!canUpdate} className="h-11 w-16 cursor-pointer rounded-xl border border-slate-300 bg-white p-1 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800" />
                <Input value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} disabled={!canUpdate} className="max-w-40" />
              </div>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => navigate('/app/workspaces')}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!canUpdate}><Save className="h-4 w-4" /> Save workspace</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}

function TimezoneSelect({ value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" required>
        {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
      </select>
    </label>
  )
}
