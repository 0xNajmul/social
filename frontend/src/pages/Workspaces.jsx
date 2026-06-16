import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, Crown, Edit3, LayoutGrid, LogOut, Plus, Sparkles, Table2, Trash2, Users } from 'lucide-react'
import clsx from 'clsx'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, Modal } from '../components/ui'
import { currentTimezone, timezones } from '../lib/timezones'

export default function Workspaces() {
  const { workspaces, activeWorkspace, switchWorkspace, reload } = useAuth()
  const [view, setView] = useState(() => localStorage.getItem('workspace_view') || 'card')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', timezone: currentTimezone() })
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [confirmAction, setConfirmAction] = useState('')

  const changeView = (nextView) => {
    setView(nextView)
    localStorage.setItem('workspace_view', nextView)
  }

  const createWorkspace = async (event) => {
    event.preventDefault()
    setBusy('create')
    setMessage('')
    try {
      const { data } = await api.post('/workspaces', form)
      workspaceStore.set(data.data.slug)
      await api.post(`/workspaces/${data.data.slug}/switch`)
      await reload()
      setShowCreate(false)
      setForm({ name: '', timezone: currentTimezone() })
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
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspaces</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize brands, teams, channels, and billing in separate spaces.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { key: 'table', label: 'Table', icon: Table2 },
              { key: 'card', label: 'Card', icon: LayoutGrid },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                className={clsx(
                  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  view === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New workspace</Button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}

      {view === 'table' ? (
        <WorkspaceTable workspaces={workspaces} activeWorkspace={activeWorkspace} busy={busy} activate={activate} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {workspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} activeWorkspace={activeWorkspace} busy={busy} activate={activate} confirmAction={confirmAction} setConfirmAction={setConfirmAction} removeAccess={removeAccess} />
          ))}
        </div>
      )}

      <Modal open={showCreate} title="Create another workspace" description="A separate workspace gets its own members, accounts, posts, and plan usage." onClose={() => setShowCreate(false)} size="lg">
        <form onSubmit={createWorkspace} className="space-y-4 p-5">
          <Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Northstar Studio" required />
          <TimezoneSelect value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={busy === 'create'}><Sparkles className="h-4 w-4" /> Create workspace</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function WorkspaceCard({ workspace, activeWorkspace, busy, activate, confirmAction, setConfirmAction, removeAccess }) {
  const active = workspace.slug === activeWorkspace?.slug
  const owner = workspace.role === 'owner'

  return (
    <Card className={clsx('relative overflow-hidden p-5 transition', active && 'border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-500')}>
      {active && <div className="absolute right-0 top-0 rounded-bl-xl bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Active</div>}
      <WorkspaceIdentity workspace={workspace} active={active} />

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric icon={Users} label="Members" value={workspace.members_count ?? 0} />
        <Metric icon={Building2} label="Accounts" value={workspace.social_accounts_count ?? 0} />
        <Metric icon={Crown} label="Plan" value={workspace.subscription?.plan?.name || 'Trial'} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {!active && <Button size="sm" onClick={() => activate(workspace)} loading={busy === `switch-${workspace.id}`}><Check className="h-4 w-4" /> Switch</Button>}
        <Link to={`/app/workspaces/${workspace.id}`}><Button size="sm" variant="secondary"><Edit3 className="h-4 w-4" /> Edit</Button></Link>
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
}

function WorkspaceTable({ workspaces, activeWorkspace, busy, activate }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr><th className="px-5 py-3">Workspace</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Members</th><th className="px-5 py-3">Accounts</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {workspaces.map((workspace) => {
              const active = workspace.slug === activeWorkspace?.slug
              return (
                <tr key={workspace.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-4"><WorkspaceIdentity workspace={workspace} compact active={active} /></td>
                  <td className="px-5 py-4"><Badge color={workspace.role === 'owner' ? 'amber' : 'indigo'}>{workspace.role === 'owner' ? 'Owner' : workspace.role}</Badge></td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.members_count ?? 0}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.social_accounts_count ?? 0}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.subscription?.plan?.name || 'Trial'}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      {!active && <Button size="sm" onClick={() => activate(workspace)} loading={busy === `switch-${workspace.id}`}><Check className="h-4 w-4" /> Switch</Button>}
                      <Link to={`/app/workspaces/${workspace.id}`}><Button size="sm" variant="secondary"><Edit3 className="h-4 w-4" /> Edit</Button></Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function WorkspaceIdentity({ workspace, compact = false, active = false }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ backgroundColor: workspace.brand_color || '#4f46e5' }}>
        {workspace.name?.[0]?.toUpperCase() || 'W'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={clsx('truncate font-bold text-slate-900 dark:text-white', compact ? 'text-base' : 'text-lg')}>{workspace.name}</h2>
          {active && <Badge color="indigo">Active</Badge>}
          {!compact && <Badge color={workspace.role === 'owner' ? 'amber' : 'indigo'}>{workspace.role === 'owner' ? 'Owner' : workspace.role}</Badge>}
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">ID #{workspace.id} · {workspace.slug} · {workspace.timezone}</p>
      </div>
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" required>
        {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
      </select>
    </label>
  )
}
