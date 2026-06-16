import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bell, Clock3, CreditCard, Maximize2, Moon, Palette, Save, Settings2, ShieldCheck, Sun, UserRound, PlugZap } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, PageLoader } from '../components/ui'
import { useTheme } from '../context/ThemeContext'

const TABS = [
  { key: 'general', label: 'General', icon: Settings2 },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'billing', label: 'Billing & credit', icon: CreditCard },
  { key: 'integration', label: 'Integration', icon: PlugZap },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: ShieldCheck },
]

export default function Settings() {
  const { user, reload } = useAuth()
  const { theme, setTheme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [workspace, setWorkspace] = useState(null)
  const [usage, setUsage] = useState({})
  const [permissions, setPermissions] = useState({})
  const [role, setRole] = useState('')
  const [tab, setTab] = useState(() => TABS.some((item) => item.key === searchParams.get('tab')) ? searchParams.get('tab') : 'general')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    api.get('/workspace').then(({ data }) => {
      const item = data.data
      setWorkspace({
        name: item.name,
        timezone: item.timezone,
        brand_color: item.brand_color || '#6366f1',
        settings: {
          approval_required: Boolean(item.settings?.approval_required),
          week_starts_on: item.settings?.week_starts_on || 'sunday',
          default_post_time: item.settings?.default_post_time || '09:00',
          language: item.settings?.language || user?.locale || 'en',
          email_notifications: item.settings?.email_notifications ?? true,
          publishing_alerts: item.settings?.publishing_alerts ?? true,
          weekly_summary: item.settings?.weekly_summary ?? false,
          content_width: item.settings?.content_width || 'contained',
          popup_default_stage: item.settings?.popup_default_stage ?? localStorage.getItem('postflow_popup_default_stage') ?? '0',
        },
        subscription: item.subscription,
      })
      setUsage(data.usage || {})
      setPermissions(data.permissions || {})
      setRole(data.current_role || '')
    })
  }, [user?.locale])

  const update = (field, value) => {
    setWorkspace((current) => ({ ...current, [field]: value }))
    setMessage(null)
  }

  const updateSetting = (field, value) => {
    setWorkspace((current) => ({ ...current, settings: { ...current.settings, [field]: value } }))
    if (field === 'popup_default_stage') localStorage.setItem('postflow_popup_default_stage', value)
    setMessage(null)
  }

  const changeTab = (nextTab) => {
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }

  const save = async (event) => {
    event?.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await api.put('/workspace', {
        name: workspace.name,
        timezone: workspace.timezone,
        brand_color: workspace.brand_color,
        settings: workspace.settings,
      })
      await reload()
      setMessage({ type: 'success', text: 'Settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save settings.' })
    } finally {
      setSaving(false)
    }
  }

  if (!workspace) return <PageLoader />
  const canUpdate = Boolean(permissions.can_update)
  const planName = workspace.subscription?.plan?.name || 'Workspace plan'

  return (
    <div className="max-w-7xl space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage workspace defaults, billing, integrations, alerts, and security.</p>
          </div>
          <Badge color={canUpdate ? 'indigo' : 'slate'}>{role || 'member'} access</Badge>
        </div>

        <div className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => changeTab(key)}
              className={`inline-flex whitespace-nowrap items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'}`}>{message.text}</div>}

      {!canUpdate && <Card className="flex gap-3 bg-slate-50/70 p-4 dark:bg-slate-900"><ShieldCheck className="h-5 w-5 text-slate-400" /><div><p className="font-medium text-slate-800 dark:text-slate-100">These settings are read-only</p><p className="text-sm text-slate-500 dark:text-slate-400">Only workspace owners and administrators can make changes.</p></div></Card>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><UserRound className="h-7 w-7" /></span>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
              <Info label="Workspace" value={workspace.name} />
              <Info label="Plan" value={planName} />
              <Info label="Status" value={workspace.subscription?.status_label || 'Active'} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-slate-900 dark:text-white">Usage snapshot</h2>
            <div className="mt-4 space-y-4">{Object.entries(usage).slice(0, 4).map(([key, metric]) => <Usage key={key} label={key.replace(/_/g, ' ')} metric={metric} />)}</div>
          </Card>
        </aside>

        <form onSubmit={save} className="space-y-6">
          {tab === 'general' && (
            <>
              <SettingsCard icon={Palette} title="General" description="Control personal language and planning defaults for this workspace.">
                <Select label="Language" value={workspace.settings.language} onChange={(value) => updateSetting('language', value)} disabled={!canUpdate} options={[['en', 'English'], ['bn', 'Bangla'], ['es', 'Spanish'], ['fr', 'French']]} />
                <HelpCard title="Workspace identity moved" text="Workspace name, timezone, and theme color now live on the workspace edit page so brand settings stay in one place." />
              </SettingsCard>
              <SettingsCard icon={Clock3} title="Planning defaults" description="These defaults are used by calendars and new scheduled posts.">
                <Select label="Week starts on" value={workspace.settings.week_starts_on} onChange={(value) => updateSetting('week_starts_on', value)} disabled={!canUpdate} options={[['sunday', 'Sunday'], ['monday', 'Monday']]} />
                <Input label="Default posting time" type="time" value={workspace.settings.default_post_time} onChange={(event) => updateSetting('default_post_time', event.target.value)} disabled={!canUpdate} />
              </SettingsCard>
            </>
          )}

          {tab === 'appearance' && (
            <SettingsCard icon={Maximize2} title="Appearance" description="Choose how much horizontal space the user panel content can use.">
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Theme</span>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/40">
                  {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTheme(key)}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${theme === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <Select
                label="User panel content width"
                value={workspace.settings.content_width}
                onChange={(value) => updateSetting('content_width', value)}
                disabled={!canUpdate}
                options={[
                  ['contained', 'Current width'],
                  ['full', 'Full width'],
                ]}
              />
              <Select
                label="Default popup size"
                value={String(workspace.settings.popup_default_stage)}
                onChange={(value) => updateSetting('popup_default_stage', value)}
                disabled={!canUpdate}
                options={[
                  ['0', 'Small popup'],
                  ['1', 'Content screen'],
                  ['2', 'Full screen'],
                ]}
              />
              <HelpCard title="Layout behavior" text="Current width keeps pages inside the polished centered container. Full width lets dashboard, organizer, media, and settings content stretch across the available app area." />
            </SettingsCard>
          )}

          {tab === 'billing' && (
            <SettingsCard icon={CreditCard} title="Billing & credit" description="Review your current plan and usage credits.">
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Billing & credit</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Upgrade your package when you need more capacity.</p>
                </div>
                <Link to="/app/pricing-plan"><Button type="button" size="sm">Upgrade</Button></Link>
              </div>
              <PlanBox label="Current plan" value={planName} />
              <PlanBox label="Subscription status" value={workspace.subscription?.status_label || 'Active'} />
              <PlanBox label="Period end" value={workspace.subscription?.current_period_end ? new Date(workspace.subscription.current_period_end).toLocaleDateString() : 'Not available'} />
            </SettingsCard>
          )}

          {tab === 'integration' && (
            <SettingsCard icon={PlugZap} title="Integration" description="Connect external tools and keep publishing channels healthy.">
              <HelpCard title="Social accounts" text="Connect Facebook, Instagram, LinkedIn, Pinterest, Mastodon, Bluesky, Reddit, YouTube and more from the Accounts page." />
              <HelpCard title="API access" text="Use Developer settings to create tokens, inspect API usage, and connect your own tools." />
              <HelpCard title="Automation inputs" text="RSS feeds and AI workflows can pull content into your publishing queue automatically." />
            </SettingsCard>
          )}

          {tab === 'notifications' && (
            <SettingsCard icon={Bell} title="Notifications" description="Choose which workspace alerts your team receives.">
              <SwitchRow label="Email notifications" description="Receive important publishing and workspace updates by email." checked={workspace.settings.email_notifications} onChange={() => updateSetting('email_notifications', !workspace.settings.email_notifications)} disabled={!canUpdate} />
              <SwitchRow label="Publishing alerts" description="Notify members when posts publish, fail, or need approval." checked={workspace.settings.publishing_alerts} onChange={() => updateSetting('publishing_alerts', !workspace.settings.publishing_alerts)} disabled={!canUpdate} />
              <SwitchRow label="Weekly summary" description="Send a weekly performance and queue summary." checked={workspace.settings.weekly_summary} onChange={() => updateSetting('weekly_summary', !workspace.settings.weekly_summary)} disabled={!canUpdate} />
            </SettingsCard>
          )}

          {tab === 'security' && (
            <SettingsCard icon={ShieldCheck} title="Security" description="Control review gates and security-related workspace behavior.">
              <SwitchRow label="Require approval by default" description="New posts enter review before scheduling or publishing." checked={workspace.settings.approval_required} onChange={() => updateSetting('approval_required', !workspace.settings.approval_required)} disabled={!canUpdate} />
              <HelpCard title="Two-factor authentication" text="Personal account security is managed from Profile. Workspace security settings will apply to the team." />
              <HelpCard title="Access control" text="Use Team settings to assign Owner, Admin, Manager, Editor, and Viewer roles." />
            </SettingsCard>
          )}

          {canUpdate && <div className="flex justify-end"><Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save settings</Button></div>}
        </form>
      </div>
    </div>
  )
}

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"><Icon className="h-4 w-4" /></span>
        <div><h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{description}</p></div>
      </div>
      <div className="grid gap-5 p-6 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}

function TimezoneSelect({ value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
      </select>
    </label>
  )
}

function Usage({ label, metric }) {
  const percent = metric.limit ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : 0
  return <div><div className="flex justify-between text-xs"><span className="capitalize text-slate-500 dark:text-slate-400">{label}</span><span className="font-medium text-slate-700 dark:text-slate-200">{metric.used} / {metric.limit ?? '∞'}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${metric.limit ? percent : 10}%` }} /></div></div>
}

function Info({ label, value }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p></div>
}

function PlanBox({ label, value }) {
  return <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{value}</p></div>
}

function HelpCard({ title, text }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"><p className="font-semibold text-slate-900 dark:text-white">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p></div>
}

function SwitchRow({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:col-span-2">
      <div><p className="font-semibold text-slate-900 dark:text-white">{label}</p><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange} disabled={disabled} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}
