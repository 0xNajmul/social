import { useState } from 'react'
import { Building2, Check, Crown, LogOut, Plus, Settings2, Sparkles, Trash2, Users } from 'lucide-react'
import clsx from 'clsx'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input } from '../components/ui'
import { currentTimezone, timezones } from '../lib/timezones'

export default function Workspaces() {
  const { workspaces, activeWorkspace, switchWorkspace, reload } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', timezone: currentTimezone() })
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [confirmAction, setConfirmAction] = useState('')

  const createWorkspace = async (event) => {
    event.preventDefault()
    setBusy('create')
    setMessage('')
    try {
      const { data } = await api.post('/workspaces', form)
      await reload()
      await switchWorkspace(data.data.slug)
      window.location.assign('/app/workspaces')
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not create the workspace.')
    } finally {
      setBusy('')
    }
  }

  const activate = async (workspace) => {
    setBusy(`switch-${workspace.id}`)
    await switchWorkspace(workspace.slug)
    window.location.reload()
  }

  const removeAccess = async (type) => {
    setBusy(type)
    setMessage('')
    try {
      if (type === 'delete') await api.delete('/workspace')
      else await api.post('/workspace/leave')
      workspaceStore.clear()
      await reload()
      window.location.assign('/app/workspaces')
    } catch (error) {
      setMessage(error.response?.data?.message || `Could not ${type} this workspace.`)
    } finally {
      setBusy('')
      setConfirmAction('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspaces</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize brands, teams, channels, and billing in separate spaces.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New workspace</Button>
      </div>

      {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {workspaces.map((workspace) => {
          const active = workspace.slug === activeWorkspace?.slug
          const owner = workspace.role === 'owner'
          return (
            <Card key={workspace.id} className={clsx('relative overflow-hidden p-5 transition', active && 'border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-500')}>
              {active && <div className="absolute right-0 top-0 rounded-bl-xl bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Active</div>}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: workspace.brand_color || '#4f46e5' }}>
                  {workspace.name?.[0]?.toUpperCase() || 'W'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 pr-14">
                    <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">{workspace.name}</h2>
                    <Badge color={owner ? 'amber' : 'indigo'}>{owner ? 'Owner' : workspace.role}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{workspace.slug} · {workspace.timezone}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <Metric icon={Users} label="Members" value={workspace.members_count ?? 0} />
                <Metric icon={Building2} label="Accounts" value={workspace.social_accounts_count ?? 0} />
                <Metric icon={Crown} label="Plan" value={workspace.subscription?.plan?.name || 'Trial'} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {!active ? (
                  <Button size="sm" onClick={() => activate(workspace)} loading={busy === `switch-${workspace.id}`}><Check className="h-4 w-4" /> Switch</Button>
                ) : (
                  <a href="/app/settings"><Button size="sm" variant="secondary"><Settings2 className="h-4 w-4" /> Settings</Button></a>
                )}
                {active && (
                  <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" onClick={() => setConfirmAction(owner ? 'delete' : 'leave')}>
                    {owner ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                    {owner ? 'Delete' : 'Leave'}
                  </Button>
                )}
              </div>

              {active && confirmAction && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                    {confirmAction === 'delete' ? 'Delete this workspace and all of its content?' : 'Leave this workspace and lose access to its content?'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="danger" loading={busy === confirmAction} onClick={() => removeAccess(confirmAction)}>Confirm</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmAction('')}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && setShowCreate(false)}>
          <Card className="w-full max-w-2xl overflow-hidden">
            <div className="border-b border-slate-200 bg-brand-50/60 px-5 py-4 dark:border-slate-800 dark:bg-brand-950/20">
              <h2 className="font-semibold text-slate-900 dark:text-white">Create another workspace</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A separate workspace gets its own members, accounts, posts, and plan usage.</p>
            </div>
            <form onSubmit={createWorkspace} className="grid gap-4 p-5 sm:grid-cols-2">
              <Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Northstar Studio" required />
              <TimezoneSelect value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} />
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" loading={busy === 'create'}><Sparkles className="h-4 w-4" /> Create workspace</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <Icon className="h-4 w-4 text-slate-400" />
      <p className="mt-2 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function TimezoneSelect({ value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        required
      >
        {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
      </select>
    </label>
  )
}
