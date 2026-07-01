import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Edit3, Infinity, Plus, RefreshCw, Star, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader, Textarea } from '../components/ui'

const LIMITS = [
  ['workspaces', 'Workspaces'],
  ['team_members', 'Team members'],
  ['social_accounts', 'Social accounts'],
  ['scheduled_posts', 'Scheduled posts'],
  ['monthly_posts', 'Monthly posts'],
  ['automations', 'Automations'],
  ['ai_credits', 'AI credits'],
  ['storage_mb', 'Storage (MB)'],
]

const EMPTY = {
  name: '',
  description: '',
  price_monthly: 0,
  price_yearly: 0,
  price_lifetime: 0,
  currency: 'USD',
  trial_days: 14,
  lifetime_enabled: false,
  preferred_payment_provider: 'default',
  dodo_monthly_product_id: '',
  dodo_yearly_product_id: '',
  dodo_lifetime_product_id: '',
  creem_monthly_product_id: '',
  creem_yearly_product_id: '',
  creem_lifetime_product_id: '',
  checkout_success_url: '',
  checkout_cancel_url: '',
  is_active: true,
  is_featured: false,
  sort_order: 0,
  features: '',
  limits: Object.fromEntries(LIMITS.map(([key]) => [key, 1])),
}

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
    load()
  }, [])

  const totals = useMemo(() => ({
    active: plans?.filter((plan) => plan.is_active).length || 0,
    lifetime: plans?.filter((plan) => plan.lifetime_enabled).length || 0,
    subscriptions: plans?.reduce((sum, plan) => sum + Number(plan.subscriptions_count || 0), 0) || 0,
  }), [plans])

  const openCreate = () => {
    setEditing('new')
    setForm({ ...EMPTY, limits: { ...EMPTY.limits } })
    setErrors({})
  }

  const openEdit = (plan) => {
    setEditing(plan)
    setForm({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly ?? 0,
      price_yearly: plan.price_yearly ?? 0,
      price_lifetime: plan.price_lifetime ?? 0,
      currency: plan.currency || 'USD',
      trial_days: plan.trial_days ?? 0,
      lifetime_enabled: Boolean(plan.lifetime_enabled),
      preferred_payment_provider: plan.preferred_payment_provider || 'default',
      dodo_monthly_product_id: plan.product_ids?.dodo?.monthly || '',
      dodo_yearly_product_id: plan.product_ids?.dodo?.yearly || '',
      dodo_lifetime_product_id: plan.product_ids?.dodo?.lifetime || '',
      creem_monthly_product_id: plan.product_ids?.creem?.monthly || '',
      creem_yearly_product_id: plan.product_ids?.creem?.yearly || '',
      creem_lifetime_product_id: plan.product_ids?.creem?.lifetime || '',
      checkout_success_url: plan.checkout_success_url || '',
      checkout_cancel_url: plan.checkout_cancel_url || '',
      is_active: Boolean(plan.is_active),
      is_featured: Boolean(plan.is_featured),
      sort_order: plan.sort_order || 0,
      features: (plan.features || []).join('\n'),
      limits: { ...EMPTY.limits, ...(plan.limits || {}) },
    })
    setErrors({})
  }

  const payload = () => ({
    name: form.name,
    description: form.description || null,
    price_monthly: moneyToCents(form.price_monthly),
    price_yearly: moneyToCents(form.price_yearly),
    price_lifetime: moneyToCents(form.price_lifetime),
    currency: String(form.currency || 'USD').toUpperCase().slice(0, 3),
    trial_days: Number(form.trial_days || 0),
    lifetime_enabled: Boolean(form.lifetime_enabled),
    preferred_payment_provider: form.preferred_payment_provider || 'default',
    dodo_monthly_product_id: form.dodo_monthly_product_id || null,
    dodo_yearly_product_id: form.dodo_yearly_product_id || null,
    dodo_lifetime_product_id: form.dodo_lifetime_product_id || null,
    creem_monthly_product_id: form.creem_monthly_product_id || null,
    creem_yearly_product_id: form.creem_yearly_product_id || null,
    creem_lifetime_product_id: form.creem_lifetime_product_id || null,
    checkout_success_url: form.checkout_success_url || null,
    checkout_cancel_url: form.checkout_cancel_url || null,
    is_active: Boolean(form.is_active),
    is_featured: Boolean(form.is_featured),
    sort_order: Number(form.sort_order || 0),
    features: form.features.split('\n').map((item) => item.trim()).filter(Boolean),
    ...Object.fromEntries(LIMITS.map(([key]) => [`max_${key}`, Number(form.limits[key]) || 0])),
  })

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage(null)
    try {
      if (editing === 'new') await api.post('/admin/plans', payload())
      else await api.put(`/admin/plans/${editing.slug}`, payload())
      setMessage({ type: 'success', text: editing === 'new' ? 'Plan created.' : 'Plan updated.' })
      setEditing(null)
      await load()
    } catch (error) {
      setErrors(error.response?.data?.errors || {})
      if (!error.response?.data?.errors) setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save the plan.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (plan) => {
    setBusy(true)
    try {
      await api.delete(`/admin/plans/${plan.slug}`)
      setMessage({ type: 'success', text: 'Plan deleted.' })
      setConfirmDelete(null)
      await load()
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete the plan.' })
    } finally {
      setBusy(false)
    }
  }

  if (!plans) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Plans</h1>
          <p className="mt-1 text-sm text-slate-400">Configure packages, lifetime deals, limits, and Dodo or Creem product IDs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat label="Active" value={totals.active} />
          <Stat label="Lifetime deals" value={totals.lifetime} />
          <Stat label="Subscriptions" value={totals.subscriptions} />
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add plan</Button>
        </div>
      </div>

      {message && <Notice message={message} />}
      {loadError && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1">{loadError}</span>
          <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative flex flex-col overflow-hidden p-5 ${plan.is_featured ? 'border-brand-500 ring-2 ring-brand-500/15' : ''}`}>
            {plan.is_featured && <span className="absolute right-0 top-0 rounded-bl-xl bg-brand-600 px-3 py-1 text-[10px] font-bold uppercase text-white">Featured</span>}
            <div>
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{plan.description}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <PriceBox label="Monthly" value={plan.price_monthly} currency={plan.currency} suffix="/mo" />
              <PriceBox label="Yearly" value={plan.price_yearly} currency={plan.currency} suffix="/yr" />
              <div className="col-span-2">
                <PriceBox label="Lifetime" value={plan.price_lifetime} currency={plan.currency} suffix="one-time" muted={!plan.lifetime_enabled} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge color={plan.is_active ? 'emerald' : 'slate'}>{plan.is_active ? 'Active' : 'Hidden'}</Badge>
              {plan.lifetime_enabled && <Badge color="violet">Lifetime</Badge>}
              <Badge color="indigo">{plan.subscriptions_count ?? 0} subscriptions</Badge>
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-400">
              {(plan.features || []).slice(0, 4).map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {feature}</li>)}
            </ul>
            <div className="mt-5 flex gap-2 border-t border-slate-800 pt-4">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(plan)}><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-950/30" onClick={() => setConfirmDelete(plan)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Create plan' : `Edit ${editing?.name || 'plan'}`} description="Prices are entered in display currency. Use -1 for unlimited limits." onClose={() => setEditing(null)} size="xl">
        <form onSubmit={save} className="space-y-6 p-5">
          <section className="grid gap-5 sm:grid-cols-2">
            <Input label="Plan name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name?.[0]} required />
            <Input label="Sort order" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
            <Textarea label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="sm:col-span-2" />
            <Input label="Currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase().slice(0, 3) })} maxLength={3} />
            <Input label="Trial days" type="number" min="0" value={form.trial_days} onChange={(event) => setForm({ ...form, trial_days: event.target.value })} required />
            <Input label="Monthly price" type="number" min="0" step="0.01" value={form.price_monthly} onChange={(event) => setForm({ ...form, price_monthly: event.target.value })} required />
            <Input label="Yearly price" type="number" min="0" step="0.01" value={form.price_yearly} onChange={(event) => setForm({ ...form, price_yearly: event.target.value })} required />
            <Input label="Lifetime price" type="number" min="0" step="0.01" value={form.price_lifetime} onChange={(event) => setForm({ ...form, price_lifetime: event.target.value })} />
            <Select label="Payment provider" value={form.preferred_payment_provider} onChange={(value) => setForm({ ...form, preferred_payment_provider: value })} options={[['default', 'Use payment setting'], ['manual', 'Manual/demo'], ['dodo', 'Dodo Payments'], ['creem', 'Creem.io'], ['stripe', 'Stripe placeholder']]} />
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              <Toggle label="Active" checked={form.is_active} onChange={(value) => setForm({ ...form, is_active: value })} />
              <Toggle label="Featured" checked={form.is_featured} onChange={(value) => setForm({ ...form, is_featured: value })} />
              <Toggle label="Lifetime deal" checked={form.lifetime_enabled} onChange={(value) => setForm({ ...form, lifetime_enabled: value })} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Gateway product IDs</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <ProviderBox title="Dodo Payments" provider="dodo" form={form} setForm={setForm} />
              <ProviderBox title="Creem.io" provider="creem" form={form} setForm={setForm} />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Input label="Checkout success URL" value={form.checkout_success_url} onChange={(event) => setForm({ ...form, checkout_success_url: event.target.value })} placeholder="/app/pricing-plan?checkout=success" />
            <Input label="Checkout cancel URL" value={form.checkout_cancel_url} onChange={(event) => setForm({ ...form, checkout_cancel_url: event.target.value })} placeholder="/app/pricing-plan?checkout=cancelled" />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Usage limits</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LIMITS.map(([key, label]) => (
                <Input key={key} label={label} type="number" min={key === 'storage_mb' ? '0' : '-1'} value={form.limits[key]} onChange={(event) => setForm({ ...form, limits: { ...form.limits, [key]: event.target.value } })} error={errors[`max_${key}`]?.[0]} />
              ))}
            </div>
          </section>

          <Textarea label="Features (one per line)" value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} />

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={busy}><Star className="h-4 w-4" /> Save plan</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirmDelete)} title="Delete plan" description="Plans with subscriptions cannot be deleted." onClose={() => setConfirmDelete(null)} size="md">
        <div className="p-5">
          <p className="text-sm text-slate-300">Delete <strong className="text-white">{confirmDelete?.name}</strong>?</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => remove(confirmDelete)}>Delete plan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ProviderBox({ title, provider, form, setForm }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="mb-3 text-sm font-semibold text-white">{title}</p>
      <div className="grid gap-3">
        {['monthly', 'yearly', 'lifetime'].map((cycle) => {
          const key = `${provider}_${cycle}_product_id`
          return (
            <Input
              key={key}
              label={`${cycle.charAt(0).toUpperCase() + cycle.slice(1)} product ID`}
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              placeholder={`${provider}_${cycle}_product_id`}
            />
          )
        })}
      </div>
    </div>
  )
}

function PriceBox({ label, value, currency, suffix, muted }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${muted ? 'border-slate-800 bg-slate-950/50 text-slate-500' : 'border-slate-800 bg-slate-950/60 text-slate-200'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{formatMoney(value, currency)} <span className="text-xs font-medium text-slate-500">{suffix}</span></p>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
      <Infinity className="h-4 w-4 text-brand-300" />
      <span className="text-slate-500">{label}</span>
      <strong className="text-white">{value}</strong>
    </span>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-600 text-brand-600" />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30">
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  )
}

function Notice({ message }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div>
}

function moneyToCents(value) {
  return Math.round(Number(value || 0) * 100)
}

function formatMoney(value, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value || 0))
}
