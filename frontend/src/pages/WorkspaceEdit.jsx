import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Bell, Bot, Building2, Clipboard, ImagePlus, Palette, Save, ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react'
import clsx from 'clsx'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, PageLoader, Textarea } from '../components/ui'
import { timezoneLabel, timezones } from '../lib/timezones'
import { HOLIDAY_COUNTRIES } from '../lib/holidays'
import { TeamWorkspacePanel } from './Team'
import { UsageWorkspacePanel } from './Usage'

const BRAND_CONTEXT_DEFAULTS = {
  name: '',
  description: '',
  products_services: '',
  tone_of_voice: '',
  brand_values: '',
  approved_terminology: '',
  audience: '',
}

const DEFAULT_WORKSPACE_SETTINGS = {
  approval_required: false,
  email_notifications: true,
  publishing_alerts: true,
  weekly_summary: true,
  website: '',
  workspace_country: 'US',
  audience_countries: [],
  brand_context: BRAND_CONTEXT_DEFAULTS,
  notification_permissions: {},
  role_permissions: {},
  invitation_link: { enabled: false, code: '', member_limit: 10, default_role: 'viewer' },
}

const TABS = [
  { key: 'general', label: 'General', icon: Building2 },
  { key: 'brand', label: 'Brand', icon: Palette },
  { key: 'permissions', label: 'Roles', icon: ShieldCheck },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'invitations', label: 'Invitations', icon: UsersRound },
  { key: 'team', label: 'Team', icon: UsersRound },
  { key: 'usage', label: 'Usage', icon: BarChart3 },
]

const WORKSPACE_TAB_KEYS = new Set(TABS.map((tab) => tab.key))

function normalizeWorkspaceTab(tab) {
  return WORKSPACE_TAB_KEYS.has(tab) ? tab : 'general'
}

const ROLE_MATRIX = [
  { role: 'owner', label: 'Owner', locked: true, permissions: ['Full workspace control', 'Manage billing package', 'Delete workspace', 'Manage every role'] },
  { role: 'admin', label: 'Admin', permissions: ['Manage members', 'Manage accounts', 'Approve and publish', 'Edit workspace settings'] },
  { role: 'manager', label: 'Manager', permissions: ['Approve content', 'Manage publishing queue', 'Review team activity'] },
  { role: 'editor', label: 'Editor', permissions: ['Create and edit content', 'Upload media', 'Publish approved posts'] },
  { role: 'viewer', label: 'Viewer', permissions: ['View workspace content', 'Review calendars', 'Read analytics'] },
  { role: 'client', label: 'Client', permissions: ['Review assigned campaigns', 'Comment on plans', 'View approved reports'] },
]

const PERMISSION_OPTIONS = [
  ['posts.create', 'Create posts'],
  ['posts.publish', 'Publish posts'],
  ['posts.approve', 'Approve posts'],
  ['planner.manage', 'Manage planner'],
  ['media.manage', 'Manage media'],
  ['accounts.manage', 'Manage accounts'],
  ['automations.manage', 'Manage automations'],
  ['analytics.view', 'View analytics'],
]

const NOTIFICATION_PERMISSIONS = [
  ['post_published', 'Post published'],
  ['post_failed', 'Post failed'],
  ['approval_needed', 'Approval needed'],
  ['account_health', 'Account health'],
  ['weekly_summary', 'Weekly summary'],
]

function buildWorkspaceForm(workspace) {
  const settings = workspace.settings || {}
  return {
    name: workspace.name || '',
    description: workspace.description || '',
    timezone: workspace.timezone || 'UTC',
    brand_color: workspace.brand_color || '#6366f1',
    settings: {
      ...DEFAULT_WORKSPACE_SETTINGS,
      ...settings,
      brand_context: { ...BRAND_CONTEXT_DEFAULTS, ...(settings.brand_context || settings.brand_ai || {}) },
      invitation_link: { ...DEFAULT_WORKSPACE_SETTINGS.invitation_link, ...(settings.invitation_link || {}) },
      notification_permissions: settings.notification_permissions || {},
      role_permissions: settings.role_permissions || {},
    },
  }
}

export default function WorkspaceEdit() {
  const { id } = useParams()
  const { workspaces } = useAuth()
  const workspace = workspaces.find((item) => [item.public_id, item.id, item.slug].some((value) => String(value) === String(id)))

  if (!workspace) return <PageLoader />

  return <WorkspaceEditForm key={workspace.id} workspace={workspace} />
}

function WorkspaceEditForm({ workspace }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeWorkspace, switchWorkspace, reload } = useAuth()
  const [form, setForm] = useState(() => buildWorkspaceForm(workspace))
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(workspace.logo_url || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [copied, setCopied] = useState(false)

  const active = workspace.slug === activeWorkspace?.slug
  const canUpdate = ['owner', 'admin'].includes(workspace.role)
  const invitationLink = buildInvitationLink(workspace, form.settings.invitation_link)
  const activeTab = normalizeWorkspaceTab(searchParams.get('tab'))

  const selectTab = (tab) => {
    const nextTab = normalizeWorkspaceTab(tab)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', nextTab)
      return next
    }, { replace: true })
  }

  const updateSetting = (key, value) => {
    setForm((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  }

  const updateBrandContext = (key, value) => {
    updateSetting('brand_context', { ...form.settings.brand_context, [key]: value })
  }

  const toggleAudienceCountry = (countryCode) => {
    const countries = form.settings.audience_countries || []
    const nextCountries = countries.includes(countryCode)
      ? countries.filter((code) => code !== countryCode)
      : [...countries, countryCode]
    updateSetting('audience_countries', nextCountries.filter((code) => code !== form.settings.workspace_country))
  }

  const togglePermission = (role, permission) => {
    const rolePermissions = form.settings.role_permissions?.[role] || []
    const next = rolePermissions.includes(permission)
      ? rolePermissions.filter((item) => item !== permission)
      : [...rolePermissions, permission]
    updateSetting('role_permissions', { ...form.settings.role_permissions, [role]: next })
  }

  const toggleNotificationPermission = (role, permission) => {
    const rolePermissions = form.settings.notification_permissions?.[role] || []
    const next = rolePermissions.includes(permission)
      ? rolePermissions.filter((item) => item !== permission)
      : [...rolePermissions, permission]
    updateSetting('notification_permissions', { ...form.settings.notification_permissions, [role]: next })
  }

  const updateInvitationLink = (patch) => {
    updateSetting('invitation_link', { ...form.settings.invitation_link, ...patch })
  }

  const copyInvitationLink = async () => {
    await navigator.clipboard?.writeText(invitationLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
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
      if (logoFile) {
        const payload = new FormData()
        payload.append('name', form.name)
        payload.append('description', form.description || '')
        payload.append('timezone', form.timezone)
        payload.append('brand_color', form.brand_color || '')
        payload.append('settings', JSON.stringify(form.settings || {}))
        payload.append('logo', logoFile)
        await api.post('/workspace', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        await api.put('/workspace', form)
      }
      await reload()
      setMessage({ type: 'success', text: 'Workspace updated.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not update workspace.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Link to="/app/workspaces" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"><ArrowLeft className="h-4 w-4" /> Back to workspaces</Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit workspace {workspace.public_id || `#${workspace.id}`}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Configure workspace identity, brand context, roles, invitations, and alerts.</p>
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

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden p-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition',
                  activeTab === key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </Card>
        </aside>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-white" style={{ backgroundColor: form.brand_color }}>
              {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">{TABS.find((tab) => tab.key === activeTab)?.label} settings</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Workspace ID: {workspace.public_id || workspace.id} · {workspace.slug}</p>
            </div>
          </div>

          {activeTab === 'general' && (
            <SettingsPanel icon={Building2} title="General settings" description="Basic workspace identity and local timezone.">
              <WorkspaceImageField
                color={form.brand_color}
                disabled={!canUpdate}
                logoPreview={logoPreview}
                name={form.name}
                onChange={(file) => {
                  setLogoFile(file)
                  setLogoPreview(file ? URL.createObjectURL(file) : workspace.logo_url || '')
                }}
              />
              <Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!canUpdate} required />
              <TimezoneSelect value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} disabled={!canUpdate} />
              <Input label="Website" value={form.settings.website || ''} onChange={(event) => updateSetting('website', event.target.value)} disabled={!canUpdate} placeholder="https://example.com" />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Workspace country</span>
                <select
                  value={form.settings.workspace_country || 'US'}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      workspace_country: event.target.value,
                      audience_countries: (current.settings.audience_countries || []).filter((code) => code !== event.target.value),
                    },
                  }))}
                  disabled={!canUpdate}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {HOLIDAY_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                </select>
              </label>
              <Textarea label="Description" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={!canUpdate} className="sm:col-span-2" />
              <SwitchField
                label="Require approval before publishing"
                description="New posts in this workspace enter review before scheduling or publishing."
                checked={Boolean(form.settings.approval_required)}
                onChange={(checked) => updateSetting('approval_required', checked)}
                disabled={!canUpdate}
              />
            </SettingsPanel>
          )}

          {activeTab === 'team' && (
            <section className="p-6">
              <TeamWorkspacePanel embedded />
            </section>
          )}

          {activeTab === 'usage' && (
            <section className="p-6">
              <UsageWorkspacePanel embedded />
            </section>
          )}

          {activeTab === 'brand' && (
            <SettingsPanel icon={Bot} title="Brand and AI context" description="Give the AI assistant the voice, terminology, values, and audience for this workspace.">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Brand color</span>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} disabled={!canUpdate} className="h-11 w-16 cursor-pointer rounded-xl border border-slate-300 bg-white p-1 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800" />
                  <Input value={form.brand_color} onChange={(event) => setForm({ ...form, brand_color: event.target.value })} disabled={!canUpdate} className="max-w-40" />
                </div>
              </label>
              <BrandContextFields context={form.settings.brand_context} disabled={!canUpdate} onChange={updateBrandContext} />
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Audience countries</p>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-2 lg:grid-cols-3">
                  {HOLIDAY_COUNTRIES.filter((country) => country.code !== form.settings.workspace_country).map((country) => (
                    <label key={country.code} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={(form.settings.audience_countries || []).includes(country.code)}
                        disabled={!canUpdate}
                        onChange={() => toggleAudienceCountry(country.code)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-60"
                      />
                      <span className="truncate">{country.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </SettingsPanel>
          )}

          {activeTab === 'permissions' && (
            <SettingsPanel icon={UserRoundCog} title="Role permissions" description="Adjust the permissions stored for this workspace role editor.">
              <div className="grid gap-4 sm:col-span-2">
                {ROLE_MATRIX.map((item) => (
                  <div key={item.role} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge color={item.role === 'owner' ? 'amber' : item.role === 'admin' ? 'indigo' : 'slate'}>{item.label}</Badge>
                      {workspace.role === item.role && <span className="text-xs font-semibold text-brand-600 dark:text-brand-300">Your role</span>}
                      {item.locked && <span className="text-xs font-medium text-slate-400">Locked</span>}
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {item.permissions.map((permission) => (
                        <span key={permission} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{permission}</span>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {PERMISSION_OPTIONS.map(([key, label]) => (
                        <label key={`${item.role}-${key}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.locked || Boolean(form.settings.role_permissions?.[item.role]?.includes(key))}
                            disabled={!canUpdate || item.locked}
                            onChange={() => togglePermission(item.role, key)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-60"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SettingsPanel>
          )}

          {activeTab === 'notifications' && (
            <SettingsPanel icon={Bell} title="Notification permissions" description="Set workspace alerts and role-level notification access.">
              <SwitchField label="Email notifications" description="Send workspace events by email." checked={Boolean(form.settings.email_notifications)} onChange={(checked) => updateSetting('email_notifications', checked)} disabled={!canUpdate} />
              <SwitchField label="Publishing alerts" description="Notify members when posts publish or fail." checked={Boolean(form.settings.publishing_alerts)} onChange={(checked) => updateSetting('publishing_alerts', checked)} disabled={!canUpdate} />
              <SwitchField label="Weekly summary" description="Send a weekly digest for this workspace." checked={Boolean(form.settings.weekly_summary)} onChange={(checked) => updateSetting('weekly_summary', checked)} disabled={!canUpdate} />
              <div className="grid gap-4 sm:col-span-2">
                {ROLE_MATRIX.filter((role) => role.role !== 'owner').map((role) => (
                  <div key={role.role} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <Badge color="slate">{role.label}</Badge>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {NOTIFICATION_PERMISSIONS.map(([key, label]) => (
                        <label key={`${role.role}-${key}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(form.settings.notification_permissions?.[role.role]?.includes(key))}
                            disabled={!canUpdate}
                            onChange={() => toggleNotificationPermission(role.role, key)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-60"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SettingsPanel>
          )}

          {activeTab === 'invitations' && (
            <SettingsPanel icon={UsersRound} title="Invitation link" description="Create a copyable workspace invitation link with role and member-limit settings.">
              <SwitchField
                label="Enable invitation link"
                description="Let teammates join from a shared workspace invite link."
                checked={Boolean(form.settings.invitation_link.enabled)}
                onChange={(checked) => updateInvitationLink({ enabled: checked, code: form.settings.invitation_link.code || makeInviteCode(workspace) })}
                disabled={!canUpdate}
              />
              <Input label="Invite code" value={form.settings.invitation_link.code || ''} onChange={(event) => updateInvitationLink({ code: event.target.value })} disabled={!canUpdate} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Default role</span>
                <select value={form.settings.invitation_link.default_role} onChange={(event) => updateInvitationLink({ default_role: event.target.value })} disabled={!canUpdate} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {ROLE_MATRIX.filter((item) => !['owner', 'admin'].includes(item.role)).map((role) => <option key={role.role} value={role.role}>{role.label}</option>)}
                </select>
              </label>
              <Input label="Member limit" type="number" min="1" value={form.settings.invitation_link.member_limit || 1} onChange={(event) => updateInvitationLink({ member_limit: Number(event.target.value) })} disabled={!canUpdate} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Copy link</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={invitationLink} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" />
                  <Button type="button" variant="secondary" onClick={copyInvitationLink} disabled={!form.settings.invitation_link.enabled}><Clipboard className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}</Button>
                </div>
              </div>
            </SettingsPanel>
          )}

          <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <Button type="button" variant="ghost" onClick={() => navigate('/app/workspaces')}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!canUpdate}><Save className="h-4 w-4" /> Save workspace</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}

function SettingsPanel({ icon: Icon, title, description, children }) {
  return (
    <section className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-300">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function BrandContextFields({ context, disabled, onChange }) {
  return (
    <>
      <Input label="Brand name" value={context.name} onChange={(event) => onChange('name', event.target.value)} disabled={disabled} />
      <Input label="Audience" value={context.audience} onChange={(event) => onChange('audience', event.target.value)} disabled={disabled} />
      <Textarea label="Brand description" rows={3} value={context.description} onChange={(event) => onChange('description', event.target.value)} disabled={disabled} className="sm:col-span-2" />
      <Textarea label="Products or services" rows={3} value={context.products_services} onChange={(event) => onChange('products_services', event.target.value)} disabled={disabled} />
      <Textarea label="Tone of voice" rows={3} value={context.tone_of_voice} onChange={(event) => onChange('tone_of_voice', event.target.value)} disabled={disabled} />
      <Textarea label="Brand values" rows={3} value={context.brand_values} onChange={(event) => onChange('brand_values', event.target.value)} disabled={disabled} />
      <Textarea label="Approved terminology" rows={3} value={context.approved_terminology} onChange={(event) => onChange('approved_terminology', event.target.value)} disabled={disabled} />
    </>
  )
}

function WorkspaceImageField({ color, disabled, logoPreview, name, onChange }) {
  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Workspace image</p>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold text-white shadow-sm" style={{ backgroundColor: color || '#6366f1' }}>
          {logoPreview ? <img src={logoPreview} alt="" className="h-full w-full object-cover" /> : name?.[0]?.toUpperCase() || 'W'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">Upload a square logo or brand image</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">This image appears anywhere the workspace identity is shown.</p>
        </div>
        <label className={clsx('inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800', disabled && 'pointer-events-none opacity-60')}>
          <ImagePlus className="h-4 w-4" />
          Upload image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            disabled={disabled}
            onChange={(event) => onChange(event.target.files?.[0] || null)}
          />
        </label>
      </div>
    </div>
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
        {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezoneLabel(timezone).replace('UTC', 'GMT')}</option>)}
      </select>
    </label>
  )
}

function buildInvitationLink(workspace, invitationLink = {}) {
  const code = invitationLink.code || makeInviteCode(workspace)
  if (typeof window === 'undefined') return `/invitations/join/${workspace.slug}?code=${code}`
  return `${window.location.origin}/invitations/join/${workspace.slug}?code=${encodeURIComponent(code)}`
}

function makeInviteCode(workspace) {
  return `${workspace.slug || 'workspace'}-${workspace.id || 'invite'}`
}

function formatRole(role) {
  if (!role) return 'No role'
  return role.charAt(0).toUpperCase() + role.slice(1)
}
