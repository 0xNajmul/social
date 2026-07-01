import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Bell, CreditCard, Maximize2, Moon, Palette, PlugZap, Save, Settings2, ShieldCheck, Sun } from 'lucide-react'
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

const DEFAULT_ACCOUNT_SETTINGS = {
  language: 'en',
  week_starts_on: 'monday',
  default_post_time: '09:00',
  theme: 'light',
  content_width: 'contained',
  popup_default_stage: '0',
  receive_email: true,
  weekly_alert: true,
  publishing_alert: true,
  two_step_email: false,
  two_step_authenticator: false,
}

const DEFAULT_LANGUAGE_OPTIONS = [
  ['en', 'English'],
]

function buildAccountSettings(user) {
  return {
    ...DEFAULT_ACCOUNT_SETTINGS,
    ...(user?.settings || {}),
    language: user?.settings?.language || user?.locale || DEFAULT_ACCOUNT_SETTINGS.language,
    theme: user?.settings?.theme || localStorage.getItem('theme') || DEFAULT_ACCOUNT_SETTINGS.theme,
    popup_default_stage: String(user?.settings?.popup_default_stage ?? localStorage.getItem('postflow_popup_default_stage') ?? DEFAULT_ACCOUNT_SETTINGS.popup_default_stage),
  }
}

export default function Settings() {
  const { user, reload } = useAuth()
  const { setTheme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [settings, setSettings] = useState(() => buildAccountSettings(user))
  const [subscription, setSubscription] = useState(undefined)
  const [usage, setUsage] = useState({})
  const [languageOptions, setLanguageOptions] = useState(DEFAULT_LANGUAGE_OPTIONS)
  const [tab, setTab] = useState(() => TABS.some((item) => item.key === searchParams.get('tab')) ? searchParams.get('tab') : 'general')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    api.get('/billing/subscription')
      .then(({ data }) => {
        setSubscription(data.data)
        setUsage(data.usage || {})
      })
      .catch(() => {
        setSubscription(null)
        setUsage({})
      })
  }, [])

  useEffect(() => {
    api.get('/public/settings')
      .then(({ data }) => {
        setLanguageOptions(languageOptionsFromSettings(data.data?.language, settings.language))
      })
      .catch(() => setLanguageOptions(languageOptionsFromSettings(null, settings.language)))
  }, [])

  const updateSetting = (field, value) => {
    const nextValue = field === 'popup_default_stage' ? String(value) : value
    setSettings((current) => ({ ...current, [field]: nextValue }))
    if (field === 'theme') setTheme(nextValue)
    if (field === 'popup_default_stage') localStorage.setItem('postflow_popup_default_stage', nextValue)
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
      await api.post('/profile', {
        name: user.name,
        email: user.email,
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: settings.language || user.locale || 'en',
        settings,
      })
      await reload()
      setMessage({ type: 'success', text: 'Account settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save account settings.' })
    } finally {
      setSaving(false)
    }
  }

  const planName = subscription?.plan?.name || 'No package'
  const usageEntries = useMemo(() => Object.entries(usage), [usage])

  if (!settings || subscription === undefined) return <PageLoader />

  return (
    <div className="max-w-7xl space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage account-wide preferences, package access, notifications, and security.</p>
          </div>
          <Badge color="indigo">Account settings</Badge>
        </div>

      </div>

      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'}`}>{message.text}</div>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <Card className="p-2">
            <div className="px-3 py-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Settings sections</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose what to manage.</p>
            </div>
            <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeTab(key)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${tab === key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" /> <span className="min-w-0 truncate">{label}</span>
                </button>
              ))}
            </div>
          </Card>

        </aside>

        <form onSubmit={save} className="space-y-6">
          {tab === 'general' && (
            <>
              <SettingsCard icon={Settings2} title="General" description="Account language and planning defaults used across your workspaces.">
                <Select label="Language" value={settings.language} onChange={(value) => updateSetting('language', value)} options={languageOptions} />
                <Select label="Week starts on" value={settings.week_starts_on} onChange={(value) => updateSetting('week_starts_on', value)} options={[['monday', 'Monday'], ['sunday', 'Sunday'], ['saturday', 'Saturday']]} />
                <Input label="Default posting time" type="time" value={settings.default_post_time} onChange={(event) => updateSetting('default_post_time', event.target.value)} />
                <HelpCard title="Workspace settings" text="Workspace name, brand color, role access, and workspace-specific notifications live on each workspace edit page." />
              </SettingsCard>
            </>
          )}

          {tab === 'appearance' && (
            <SettingsCard icon={Maximize2} title="Appearance" description="Account-wide panel, theme, and popup defaults.">
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Theme</span>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/40">
                  {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateSetting('theme', key)}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${settings.theme === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <Select label="User panel content width" value={settings.content_width} onChange={(value) => updateSetting('content_width', value)} options={[['contained', 'Current width'], ['full', 'Full width']]} />
              <Select label="Default popup size" value={String(settings.popup_default_stage)} onChange={(value) => updateSetting('popup_default_stage', value)} options={[['0', 'Small popup'], ['1', 'Content screen'], ['2', 'Full screen']]} />
              <HelpCard title="Account based" text="These appearance choices follow your user account and apply in every workspace you can access." />
            </SettingsCard>
          )}

          {tab === 'billing' && (
            <SettingsCard icon={CreditCard} title="Billing & credit" description="Your package benefits are attached to your user account.">
              <PlanBox label="Current package" value={planName} />
              <PlanBox label="Subscription status" value={subscription?.status_label || 'Not active'} />
              <PlanBox label="Period end" value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'Not available'} />
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:col-span-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Account package limits</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">The same package applies across all workspaces you own.</p>
                </div>
                <Link to="/app/pricing-plan"><Button type="button" size="sm">View packages</Button></Link>
              </div>
              <div className="space-y-4 sm:col-span-2">
                {usageEntries.map(([key, metric]) => <Usage key={key} label={key.replace(/_/g, ' ')} metric={metric} />)}
              </div>
            </SettingsCard>
          )}

          {tab === 'integration' && (
            <SettingsCard icon={PlugZap} title="Integration" description="Future account integrations will be usable across any workspace you own.">
              <HelpCard title="Coming account-wide" text="Integration purchases and credits will be attached to your user account, then usable from all owned workspaces." />
              <HelpCard title="Current workspace channels" text="Social accounts remain connected to individual workspaces so client and brand data stays separated." />
              <HelpCard title="Developer access" text="API keys and webhooks are still scoped to the active workspace for security." />
            </SettingsCard>
          )}

          {tab === 'notifications' && (
            <SettingsCard icon={Bell} title="Notifications" description="Control account email preferences. Workspace-specific alerts live on workspace edit pages.">
              <SwitchRow label="Receive email" description="Allow account and workspace email notifications to be sent to you." checked={settings.receive_email} onChange={() => updateSetting('receive_email', !settings.receive_email)} />
              <SwitchRow label="Weekly alert" description="Receive a weekly account summary for package usage and workspace activity." checked={settings.weekly_alert} onChange={() => updateSetting('weekly_alert', !settings.weekly_alert)} />
              <SwitchRow label="Publishing alert" description="Receive publishing success, failure, and approval email alerts when enabled by the workspace." checked={settings.publishing_alert} onChange={() => updateSetting('publishing_alert', !settings.publishing_alert)} />
            </SettingsCard>
          )}

          {tab === 'security' && (
            <SettingsCard icon={ShieldCheck} title="Security" description="Account sign-in and two-step verification preferences.">
              <SwitchRow label="Two-step verification by email" description="Ask for a one-time email code during sensitive sign-ins." checked={settings.two_step_email} onChange={() => updateSetting('two_step_email', !settings.two_step_email)} />
              <SwitchRow label="Authenticator app" description="Prepare app-based verification for your account." checked={settings.two_step_authenticator} onChange={() => updateSetting('two_step_authenticator', !settings.two_step_authenticator)} />
              <HelpCard title="Password and email changes" text="Account notifications such as password changed or email changed appear in your notification center across workspaces." />
            </SettingsCard>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save account settings</Button>
          </div>
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

function Select({ label, value, onChange, options }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}

function Usage({ label, metric }) {
  const percent = metric.limit ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between gap-4 text-xs">
        <span className="capitalize text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{metric.used} / {metric.limit ?? 'Unlimited'}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${metric.limit ? percent : 12}%` }} /></div>
    </div>
  )
}

function PlanBox({ label, value }) {
  return <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{value}</p></div>
}

function HelpCard({ title, text }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"><p className="font-semibold text-slate-900 dark:text-white">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p></div>
}

function SwitchRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:col-span-2">
      <div><p className="font-semibold text-slate-900 dark:text-white">{label}</p><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></div>
      <button type="button" role="switch" aria-checked={checked} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

function languageOptionsFromSettings(language, currentLanguage) {
  const configured = Array.isArray(language?.languages)
    ? language.languages.map((item) => [item.code, item.native_name || item.name || item.code]).filter(([code]) => code)
    : []
  const options = configured.length ? configured : DEFAULT_LANGUAGE_OPTIONS

  if (currentLanguage && !options.some(([code]) => code === currentLanguage)) {
    return [[currentLanguage, currentLanguage.toUpperCase()], ...options]
  }

  return options
}
