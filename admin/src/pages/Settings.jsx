import { useEffect, useState } from 'react'
import { Save, Settings2, ShieldCheck } from 'lucide-react'
import api from '../lib/api'
import { Button, Card, Input, PageLoader, Textarea } from '../components/ui'

export default function Settings() {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { api.get('/admin/settings').then(({ data }) => setForm(data.data)) }, [])
  if (!form) return <PageLoader />

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const { data } = await api.put('/admin/settings', form)
      setForm(data.data)
      setMessage({ type: 'success', text: data.message })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save platform settings.' })
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Platform settings</h1><p className="mt-1 text-sm text-slate-400">Manage account availability, trial defaults, and customer-facing support details.</p></div>
      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div>}
      <form onSubmit={save} className="space-y-6">
        <Card className="overflow-hidden"><Header icon={Settings2} title="General" description="Core platform identity and onboarding defaults." /><div className="grid gap-5 p-6 sm:grid-cols-2"><Input label="Platform name" value={form.platform_name} onChange={(event) => setForm({ ...form, platform_name: event.target.value })} required /><Input label="Default trial days" type="number" min="0" max="365" value={form.default_trial_days} onChange={(event) => setForm({ ...form, default_trial_days: Number(event.target.value) })} required /><Input label="Support email" type="email" value={form.support_email} onChange={(event) => setForm({ ...form, support_email: event.target.value })} placeholder="support@example.com" className="sm:col-span-2" /></div></Card>
        <Card className="overflow-hidden"><Header icon={ShieldCheck} title="Access and operations" description="Control new registrations and display operational notices." /><div className="space-y-5 p-6"><label className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4"><div><p className="font-medium text-slate-100">Allow new registrations</p><p className="mt-1 text-sm text-slate-400">When disabled, the registration API rejects new accounts.</p></div><input type="checkbox" checked={form.registration_enabled} onChange={(event) => setForm({ ...form, registration_enabled: event.target.checked })} className="h-5 w-5 rounded border-slate-600 text-brand-600" /></label><Textarea label="Maintenance notice" value={form.maintenance_notice} onChange={(event) => setForm({ ...form, maintenance_notice: event.target.value })} placeholder="Optional internal operations note..." maxLength="500" /></div></Card>
        <div className="flex justify-end"><Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save settings</Button></div>
      </form>
    </div>
  )
}

function Header({ icon: Icon, title, description }) {
  return <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-800/40 px-6 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300"><Icon className="h-4 w-4" /></span><div><h2 className="font-semibold text-white">{title}</h2><p className="text-xs text-slate-400">{description}</p></div></div>
}
