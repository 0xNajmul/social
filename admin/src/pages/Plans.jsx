import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Edit3, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader, Textarea } from '../components/ui'

const LIMITS = [
  ['workspaces', 'Workspaces'], ['team_members', 'Team members'], ['social_accounts', 'Social accounts'],
  ['scheduled_posts', 'Scheduled posts'], ['monthly_posts', 'Monthly posts'], ['automations', 'Automations'],
  ['ai_credits', 'AI credits'], ['storage_mb', 'Storage (MB)'],
]

const EMPTY = { name: '', description: '', price_monthly: 0, price_yearly: 0, trial_days: 14, is_active: true, is_featured: false, sort_order: 0, features: '', limits: Object.fromEntries(LIMITS.map(([key]) => [key, 1])) }

export default function Plans() {
  const [plans, setPlans] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [message, setMessage] = useState(null)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setLoadError('')
    try {
      const { data } = await api.get('/admin/plans')
      setPlans(data.data)
    } catch (error) {
      setPlans([])
      setLoadError(error.response?.data?.message || 'Could not load plans. Check the API server and try again.')
    }
  }
  useEffect(() => {
    api.get('/admin/plans')
      .then(({ data }) => setPlans(data.data))
      .catch((error) => {
        setPlans([])
        setLoadError(error.response?.data?.message || 'Could not load plans. Check the API server and try again.')
      })
  }, [])

  const openCreate = () => { setEditing('new'); setForm(EMPTY); setErrors({}) }
  const openEdit = (plan) => { setEditing(plan); setForm({ name: plan.name, description: plan.description || '', price_monthly: plan.price_monthly, price_yearly: plan.price_yearly, trial_days: plan.trial_days, is_active: plan.is_active, is_featured: plan.is_featured, sort_order: plan.sort_order || 0, features: (plan.features || []).join('\n'), limits: { ...plan.limits } }); setErrors({}) }

  const payload = () => ({
    name: form.name, description: form.description || null,
    price_monthly: Math.round(Number(form.price_monthly) * 100), price_yearly: Math.round(Number(form.price_yearly) * 100),
    trial_days: Number(form.trial_days), is_active: form.is_active, is_featured: form.is_featured, sort_order: Number(form.sort_order),
    features: form.features.split('\n').map((item) => item.trim()).filter(Boolean),
    ...Object.fromEntries(LIMITS.map(([key]) => [`max_${key}`, Number(form.limits[key])])),
  })

  const save = async (event) => {
    event.preventDefault(); setBusy(true); setErrors({})
    try {
      if (editing === 'new') await api.post('/admin/plans', payload())
      else await api.put(`/admin/plans/${editing.slug}`, payload())
      setMessage({ type: 'success', text: editing === 'new' ? 'Plan created.' : 'Plan updated.' }); setEditing(null); await load()
    } catch (error) { setErrors(error.response?.data?.errors || {}); if (!error.response?.data?.errors) setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save the plan.' }) }
    finally { setBusy(false) }
  }

  const remove = async (plan) => {
    setBusy(true)
    try { await api.delete(`/admin/plans/${plan.slug}`); setMessage({ type: 'success', text: 'Plan deleted.' }); setConfirmDelete(null); await load() }
    catch (error) { setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete the plan.' }) }
    finally { setBusy(false) }
  }

  if (!plans) return <PageLoader />
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white">Plans</h1><p className="mt-1 text-sm text-slate-400">Configure pricing, usage limits, trials, and plan visibility.</p></div><Button onClick={openCreate}><Plus className="h-4 w-4" /> Add plan</Button></div>
      {message && <Notice message={message} />}
      {loadError && <div className="flex flex-col gap-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300 sm:flex-row sm:items-center"><AlertTriangle className="h-5 w-5 shrink-0" /><span className="flex-1">{loadError}</span><Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button></div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => <Card key={plan.id} className={`relative overflow-hidden p-5 ${plan.is_featured ? 'border-brand-500 ring-2 ring-brand-500/15' : ''}`}>{plan.is_featured && <span className="absolute right-0 top-0 rounded-bl-xl bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase text-white">Featured</span>}<div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-bold text-white">{plan.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{plan.description}</p></div></div><p className="mt-4 text-3xl font-extrabold text-white">${plan.price_monthly}<span className="text-sm font-normal text-slate-500">/mo</span></p><div className="mt-3 flex gap-2"><Badge color={plan.is_active ? 'emerald' : 'slate'}>{plan.is_active ? 'Active' : 'Hidden'}</Badge><Badge color="indigo">{plan.subscriptions_count ?? 0} subscriptions</Badge></div><ul className="mt-5 space-y-2 text-sm text-slate-400">{(plan.features || []).slice(0, 4).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {feature}</li>)}</ul><div className="mt-5 flex gap-2 border-t border-slate-800 pt-4"><Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(plan)}><Edit3 className="h-3.5 w-3.5" /> Edit</Button><Button size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-950/30" onClick={() => setConfirmDelete(plan)}><Trash2 className="h-3.5 w-3.5" /></Button></div></Card>)}</div>

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Create plan' : `Edit ${editing?.name || 'plan'}`} description="Prices are entered in display currency. Use -1 for unlimited limits." onClose={() => setEditing(null)} size="xl"><form onSubmit={save} className="space-y-6 p-5"><div className="grid gap-5 sm:grid-cols-2"><Input label="Plan name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name?.[0]} required /><Input label="Sort order" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /><Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="sm:col-span-2" /><Input label="Monthly price ($)" type="number" min="0" step="0.01" value={form.price_monthly} onChange={(event) => setForm({ ...form, price_monthly: event.target.value })} required /><Input label="Yearly price ($)" type="number" min="0" step="0.01" value={form.price_yearly} onChange={(event) => setForm({ ...form, price_yearly: event.target.value })} required /><Input label="Trial days" type="number" min="0" value={form.trial_days} onChange={(event) => setForm({ ...form, trial_days: event.target.value })} required /><div className="grid grid-cols-2 gap-3"><Toggle label="Active" checked={form.is_active} onChange={(value) => setForm({ ...form, is_active: value })} /><Toggle label="Featured" checked={form.is_featured} onChange={(value) => setForm({ ...form, is_featured: value })} /></div></div><div><h3 className="mb-3 text-sm font-semibold text-slate-200">Usage limits</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{LIMITS.map(([key, label]) => <Input key={key} label={label} type="number" min={key === 'storage_mb' ? '0' : '-1'} value={form.limits[key]} onChange={(event) => setForm({ ...form, limits: { ...form.limits, [key]: event.target.value } })} error={errors[`max_${key}`]?.[0]} />)}</div></div><Textarea label="Features (one per line)" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} /><div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}><Star className="h-4 w-4" /> Save plan</Button></div></form></Modal>

      <Modal open={Boolean(confirmDelete)} title="Delete plan" description="Plans with subscriptions cannot be deleted." onClose={() => setConfirmDelete(null)} size="md"><div className="p-5"><p className="text-sm text-slate-300">Delete <strong className="text-white">{confirmDelete?.name}</strong>?</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => remove(confirmDelete)}>Delete plan</Button></div></div></Modal>
    </div>
  )
}

function Toggle({ label, checked, onChange }) { return <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-600 text-brand-600" /><span className="text-sm text-slate-300">{label}</span></label> }
function Notice({ message }) { return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div> }
