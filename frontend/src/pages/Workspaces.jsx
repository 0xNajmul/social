import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, Edit3, LayoutGrid, LogOut, Plus, Search, Table2, Trash2, Users, X } from 'lucide-react'
import clsx from 'clsx'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, ConfirmDialog } from '../components/ui'
import WorkspaceCreateModal from '../components/workspaces/WorkspaceCreateModal'
import useInfiniteList from '../hooks/useInfiniteList'

export default function Workspaces() {
  const { workspaces, activeWorkspace, switchWorkspace, reload } = useAuth()
  const [view, setView] = useState(() => localStorage.getItem('workspace_view') || 'card')
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const ownedWorkspaceCount = workspaces.filter((workspace) => workspace.role === 'owner').length
  const activeCount = activeWorkspace ? 1 : 0
  const totalMembers = workspaces.reduce((sum, workspace) => sum + Number(workspace.members_count || 0), 0)
  const totalAccounts = workspaces.reduce((sum, workspace) => sum + Number(workspace.social_accounts_count || 0), 0)
  const filteredWorkspaces = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return workspaces
    return workspaces.filter((workspace) => [
      workspace.name,
      workspace.description,
      workspace.slug,
      workspace.public_id,
      workspace.id,
      workspace.role,
    ].filter(Boolean).join(' ').toLowerCase().includes(query))
  }, [search, workspaces])
  const { hasMore, items: pagedWorkspaces, sentinelRef } = useInfiniteList(filteredWorkspaces)

  const changeView = (nextView) => {
    setView(nextView)
    localStorage.setItem('workspace_view', nextView)
  }

  const activate = async (workspace) => {
    setBusy(`switch-${workspace.id}`)
    await switchWorkspace(workspace.slug)
    window.location.reload()
  }

  const removeAccess = async () => {
    const type = confirmAction?.type
    if (!type) return
    if (type === 'delete' && ownedWorkspaceCount <= 1) {
      setMessage('You need to keep at least one workspace on your account.')
      setConfirmAction(null)
      return
    }
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
      setConfirmAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspaces</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Organize brands, teams, channels, and billing in separate spaces.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New workspace</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceSummary icon={Building2} label="Total workspaces" value={workspaces.length} />
        <WorkspaceSummary icon={Check} label="Active workspace" value={activeCount} />
        <WorkspaceSummary icon={Users} label="Team members" value={totalMembers} />
        <WorkspaceSummary icon={Building2} label="Connected accounts" value={totalAccounts} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workspaces, roles, IDs..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear workspace search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50 lg:self-auto">
            {[
              { key: 'table', label: 'Table', icon: Table2 },
              { key: 'card', label: 'Card', icon: LayoutGrid },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                className={clsx(
                  'inline-flex h-9 w-9 items-center justify-center rounded-lg transition',
                  view === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
                title={label}
                aria-label={`${label} view`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {message && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}

        {filteredWorkspaces.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-slate-800 dark:text-slate-100">No workspaces found</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try another name, slug, role, or workspace ID.</p>
          </div>
        ) : view === 'table' ? (
          <WorkspaceTable workspaces={pagedWorkspaces} activeWorkspace={activeWorkspace} busy={busy} activate={activate} ownedWorkspaceCount={ownedWorkspaceCount} setConfirmAction={setConfirmAction} />
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedWorkspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} activeWorkspace={activeWorkspace} busy={busy} activate={activate} ownedWorkspaceCount={ownedWorkspaceCount} setConfirmAction={setConfirmAction} />
            ))}
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="px-4 pb-5 text-center text-xs font-semibold text-slate-400">Loading more workspaces...</div>}
      </Card>

      <WorkspaceCreateModal
        open={showCreate}
        title="Create another workspace"
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.assign('/app/workspaces')}
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Delete workspace' : 'Leave workspace'}
        description={confirmAction?.type === 'delete' ? 'Delete this workspace and all of its content?' : 'Leave this workspace and lose access to its content?'}
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete workspace' : 'Leave workspace'}
        loading={busy === confirmAction?.type}
        onClose={() => setConfirmAction(null)}
        onConfirm={removeAccess}
      />
    </div>
  )
}

function WorkspaceCard({ workspace, activeWorkspace, busy, activate, ownedWorkspaceCount, setConfirmAction }) {
  const active = workspace.slug === activeWorkspace?.slug
  const owner = workspace.role === 'owner'
  const canDelete = owner && ownedWorkspaceCount > 1

  return (
    <Card className={clsx('relative overflow-hidden rounded-xl p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:hover:border-brand-800', active && 'border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-500')}>
      {active && <div className="absolute right-0 top-0 rounded-bl-xl bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Active</div>}
      <WorkspaceIdentity workspace={workspace} active={active} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric icon={Users} label="Members" value={workspace.members_count ?? 0} />
        <Metric icon={Building2} label="Accounts" value={workspace.social_accounts_count ?? 0} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {!active && <Button size="sm" onClick={() => activate(workspace)} loading={busy === `switch-${workspace.id}`}><Check className="h-4 w-4" /> Switch</Button>}
        <Link to={`/app/workspaces/${workspace.public_id || workspace.id}`}><Button size="sm" variant="secondary"><Edit3 className="h-4 w-4" /> Edit</Button></Link>
        {active && (
          <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:bg-rose-50 disabled:text-slate-400 dark:text-rose-400 dark:hover:bg-rose-950/30" disabled={owner && !canDelete} title={owner && !canDelete ? 'You need to keep at least one workspace.' : undefined} onClick={() => setConfirmAction({ type: owner ? 'delete' : 'leave', workspace })}>
            {owner ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {owner ? 'Delete' : 'Leave'}
          </Button>
        )}
      </div>
    </Card>
  )
}

function WorkspaceTable({ workspaces, activeWorkspace, busy, activate, ownedWorkspaceCount, setConfirmAction }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
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
                <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.subscription?.plan?.name || 'Free'}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    {!active && <Button size="sm" onClick={() => activate(workspace)} loading={busy === `switch-${workspace.id}`}><Check className="h-4 w-4" /> Switch</Button>}
                    <Link to={`/app/workspaces/${workspace.public_id || workspace.id}`}><Button size="sm" variant="secondary"><Edit3 className="h-4 w-4" /> Edit</Button></Link>
                    {active && (
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 disabled:text-slate-400 dark:text-rose-400 dark:hover:bg-rose-950/30" disabled={workspace.role === 'owner' && ownedWorkspaceCount <= 1} title={workspace.role === 'owner' && ownedWorkspaceCount <= 1 ? 'You need to keep at least one workspace.' : undefined} onClick={() => setConfirmAction({ type: workspace.role === 'owner' ? 'delete' : 'leave', workspace })}>
                        {workspace.role === 'owner' ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                        {workspace.role === 'owner' ? 'Delete' : 'Leave'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WorkspaceIdentity({ workspace, compact = false, active = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className={clsx('flex shrink-0 items-center justify-center overflow-hidden rounded-2xl font-bold text-white', compact ? 'h-10 w-10 text-base' : 'h-11 w-11 text-lg')} style={{ backgroundColor: workspace.brand_color || '#4f46e5' }}>
        {workspace.logo_url ? <img src={workspace.logo_url} alt="" className="h-full w-full object-cover" /> : workspace.name?.[0]?.toUpperCase() || 'W'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={clsx('truncate font-bold text-slate-900 dark:text-white', compact ? 'text-base' : 'text-lg')}>{workspace.name}</h2>
          {active && <Badge color="indigo">Active</Badge>}
          {!compact && <Badge color={workspace.role === 'owner' ? 'amber' : 'indigo'}>{workspace.role === 'owner' ? 'Owner' : workspace.role}</Badge>}
        </div>
        {workspace.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{workspace.description}</p>}
        <p className="mt-1 truncate text-xs text-slate-400">ID {workspace.public_id || `#${workspace.id}`} · {workspace.slug}</p>
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

function WorkspaceSummary({ icon: Icon, label, value }) {
  return (
    <Card className="rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{Number(value || 0).toLocaleString()}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  )
}
