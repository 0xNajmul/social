import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Bell, Building2, Save, ShieldCheck, UsersRound } from 'lucide-react'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, PageLoader, Textarea } from '../components/ui'
import { timezones } from '../lib/timezones'

const DEFAULT_WORKSPACE_SETTINGS = {
  approval_required: false,
  email_notifications: true,
  publishing_alerts: true,
  weekly_summary: true,
}

const ROLE_MATRIX = [
  { role: 'owner', label: 'Owner', permissions: ['Full workspace control', 'Manage billing package', 'Delete workspace', 'Manage every role'] },
  { role: 'admin', label: 'Admin', permissions: ['Manage members', 'Manage accounts', 'Approve and publish', 'Edit workspace settings'] },
  { role: 'manager', label: 'Manager', permissions: ['Approve content', 'Manage publishing queue', 'Review team activity'] },
  { role: 'editor', label: 'Editor', permissions: ['Create and edit content', 'Upload media', 'Publish approved posts'] },
  { role: 'viewer', label: 'Viewer', permissions: ['View workspace content', 'Review calendars', 'Read analytics'] },
]

function buildWorkspaceForm(workspace) {
  return {
    name: workspace.name || '',
    description: workspace.description || '',
    timezone: workspace.timezone || 'UTC',
    brand_color: workspace.brand_color || '#6366f1',
    settings: { ...DEFAULT_WORKSPACE_SETTINGS, ...(workspace.settings || {}) },
  }
}

export default function WorkspaceEdit() {
  const { id } = useParams()
  const { workspaces } = useAuth()
  const workspace = workspaces.find((item) => String(item.id) === String(id))

  if (!workspace) return <PageLoader />

  return <WorkspaceEditForm key={workspace.id} workspace={workspace} />
}

function WorkspaceEditForm({ workspace }) {
  const navigate = useNavigate()
  const { activeWorkspace, switchWorkspace, reload } = useAuth()
  const [form, setForm] = useState(() => buildWorkspaceForm(workspace))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const active = workspace.slug === activeWorkspace?.slug
  const canUpdate = ['owner', 'admin'].includes(workspace.role)

  const updateSetting = (key, value) => {
    setForm((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  }

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link to="/app/workspaces" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"><ArrowLeft className="h-4 w-4" /> Back to workspaces</Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit workspace #{workspace.id}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Configure workspace identity, brand, role access, and workspace alerts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={workspace.role === 'owner' ? 'amber' : 'indigo'}>{formatRole(workspace.role)}</Badge>
          <Badge color={active ? 'indigo' : 'slate'}>{active ? 'Active workspace' : 'Will switch on save'}</Badge>
        </div>
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
            <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={!canUpdate} className="sm:col-span-2" />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Brand color</span>
              <div className="flex items-center gap-3">
                <input type="color" value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} disabled={!canUpdate} className="h-11 w-16 cursor-pointer rounded-xl border border-slate-300 bg-white p-1 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800" />
                <Input value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} disabled={!canUpdate} className="max-w-40" />
              </div>
            </label>
          </div>

          <WorkspaceSection
            icon={UsersRound}
            title="Role permissions"
            description="Workspace roles control what members can do inside this workspace."
          >
            <div className="grid gap-3 sm:col-span-2">
              {ROLE_MATRIX.map((item) => (
                <div key={item.role} className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[140px_1fr]">
                  <div className="flex items-center gap-2">
                    <Badge color={item.role === 'owner' ? 'amber' : item.role === 'admin' ? 'indigo' : 'slate'}>{item.label}</Badge>
                    {workspace.role === item.role && <span className="text-xs font-semibold text-brand-600 dark:text-brand-300">Your role</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.permissions.map((permission) => (
                      <span key={permission} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{permission}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection
            icon={ShieldCheck}
            title="Approval workflow"
            description="Workspace-specific review gates used by planner and publishing workflows."
          >
            <SwitchField
              label="Require approval before publishing"
              description="New posts in this workspace enter review before scheduling or publishing."
              checked={Boolean(form.settings.approval_required)}
              onChange={(checked) => updateSetting('approval_required', checked)}
              disabled={!canUpdate}
            />
          </WorkspaceSection>

          <WorkspaceSection
            icon={Bell}
            title="Workspace notifications"
            description="These alerts apply to this workspace only."
          >
            <SwitchField label="Email notifications" description="Send workspace events by email." checked={Boolean(form.settings.email_notifications)} onChange={(checked) => updateSetting('email_notifications', checked)} disabled={!canUpdate} />
            <SwitchField label="Publishing alerts" description="Notify members when posts publish or fail." checked={Boolean(form.settings.publishing_alerts)} onChange={(checked) => updateSetting('publishing_alerts', checked)} disabled={!canUpdate} />
            <SwitchField label="Weekly summary" description="Send a weekly digest for this workspace." checked={Boolean(form.settings.weekly_summary)} onChange={(checked) => updateSetting('weekly_summary', checked)} disabled={!canUpdate} />
          </WorkspaceSection>

          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => navigate('/app/workspaces')}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!canUpdate}><Save className="h-4 w-4" /> Save workspace</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}

function WorkspaceSection({ icon: Icon, title, description, children }) {
  return (
    <section className="border-t border-slate-100 px-6 py-5 dark:border-slate-800">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function SwitchField({ label, description, checked, onChange, disabled }) {
  return (
    <label className="flex min-h-[4.5rem] items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
      <span>
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-60"
      />
    </label>
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

function formatRole(role) {
  if (!role) return 'No role'
  return role.charAt(0).toUpperCase() + role.slice(1)
}
