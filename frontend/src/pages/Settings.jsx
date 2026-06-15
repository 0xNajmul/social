import { useEffect, useState } from 'react'
import { Clock3, Palette, Save, Settings2, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input, PageLoader } from '../components/ui'

export default function Settings() {
  const { reload } = useAuth()
  const [workspace, setWorkspace] = useState(null)
  const [usage, setUsage] = useState({})
  const [permissions, setPermissions] = useState({})
  const [role, setRole] = useState('')
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
        },
        subscription: item.subscription,
      })
      setUsage(data.usage || {})
      setPermissions(data.permissions || {})
      setRole(data.current_role || '')
    })
  }, [])

  const update = (field, value) => {
    setWorkspace((current) => ({ ...current, [field]: value }))
    setMessage(null)
  }

  const updateSetting = (field, value) => {
    setWorkspace((current) => ({ ...current, settings: { ...current.settings, [field]: value } }))
    setMessage(null)
  }

  const save = async (event) => {
    event.preventDefault()
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
      setMessage({ type: 'success', text: 'Workspace settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save workspace settings.' })
    } finally {
      setSaving(false)
    }
  }

  if (!workspace) return <PageLoader />
  const canUpdate = Boolean(permissions.can_update)

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace settings</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Control identity, scheduling defaults, and publishing workflow.</p></div>
        <Badge color={canUpdate ? 'indigo' : 'slate'}>{role || 'member'} access</Badge>
      </div>

      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'}`}>{message.text}</div>}

      {!canUpdate && <Card className="flex gap-3 bg-slate-50/70 p-4 dark:bg-slate-900"><ShieldCheck className="h-5 w-5 text-slate-400" /><div><p className="font-medium text-slate-800 dark:text-slate-100">These settings are read-only</p><p className="text-sm text-slate-500 dark:text-slate-400">Only workspace owners and administrators can make changes.</p></div></Card>}

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader icon={Palette} title="Workspace identity" description="Shown throughout the dashboard and team invitations." />
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <Input label="Workspace name" value={workspace.name} onChange={(event) => update('name', event.target.value)} disabled={!canUpdate} required />
              <Input label="Timezone" value={workspace.timezone} onChange={(event) => update('timezone', event.target.value)} disabled={!canUpdate} placeholder="Asia/Dhaka" required />
              <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Brand color</span><div className="flex items-center gap-3"><input type="color" value={workspace.brand_color} onChange={(event) => update('brand_color', event.target.value)} disabled={!canUpdate} className="h-11 w-16 cursor-pointer rounded-xl border border-slate-300 bg-white p-1 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800" /><Input value={workspace.brand_color} onChange={(event) => update('brand_color', event.target.value)} disabled={!canUpdate} className="max-w-40" /></div></label>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader icon={Clock3} title="Planning defaults" description="Set sensible defaults for calendars and new posts." />
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <Select label="Week starts on" value={workspace.settings.week_starts_on} onChange={(value) => updateSetting('week_starts_on', value)} disabled={!canUpdate} options={[['sunday', 'Sunday'], ['monday', 'Monday']]} />
              <Input label="Default posting time" type="time" value={workspace.settings.default_post_time} onChange={(event) => updateSetting('default_post_time', event.target.value)} disabled={!canUpdate} />
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:col-span-2"><input type="checkbox" checked={workspace.settings.approval_required} onChange={(event) => updateSetting('approval_required', event.target.checked)} disabled={!canUpdate} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" /><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Require approval by default</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">New posts should enter the review workflow before scheduling or publishing.</p></div></label>
            </div>
          </Card>

          {canUpdate && <div className="flex justify-end"><Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save settings</Button></div>}
        </div>

        <div className="space-y-6">
          <Card className="p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Settings2 className="h-5 w-5" /></span><div><p className="font-semibold text-slate-900 dark:text-white">{workspace.subscription?.plan?.name || 'Workspace plan'}</p><p className="text-xs text-slate-400">{workspace.subscription?.status_label || 'Active'}</p></div></div>{workspace.subscription?.current_period_end && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Current period ends {new Date(workspace.subscription.current_period_end).toLocaleDateString()}.</p>}</Card>
          <Card className="p-5"><h2 className="font-semibold text-slate-900 dark:text-white">Plan usage</h2><div className="mt-4 space-y-4">{Object.entries(usage).slice(0, 5).map(([key, metric]) => <Usage key={key} label={key.replace(/_/g, ' ')} metric={metric} />)}</div></Card>
        </div>
      </form>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }) {
  return <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/40"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300"><Icon className="h-4 w-4" /></span><div><h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{description}</p></div></div>
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
}

function Usage({ label, metric }) {
  const percent = metric.limit ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : 0
  return <div><div className="flex justify-between text-xs"><span className="capitalize text-slate-500 dark:text-slate-400">{label}</span><span className="font-medium text-slate-700 dark:text-slate-200">{metric.used} / {metric.limit ?? '∞'}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${metric.limit ? percent : 10}%` }} /></div></div>
}
