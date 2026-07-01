import { useEffect, useMemo, useState } from 'react'
import { Check, Infinity } from 'lucide-react'
import api from '../lib/api'
import { LIMIT_LABELS, formatLimit } from '../lib/billing'
import { Badge, Button, Card, PageLoader } from '../components/ui'

const CYCLES = [
  ['monthly', 'Monthly', '/mo'],
  ['yearly', 'Yearly', '/yr'],
  ['lifetime', 'Lifetime', 'one-time'],
]

export default function Billing() {
  const [plans, setPlans] = useState([])
  const [sub, setSub] = useState(undefined)
  const [cycle, setCycle] = useState('monthly')
  const [busy, setBusy] = useState(null)

  const load = () => {
    api.get('/plans').then(({ data }) => setPlans(data.data))
    api.get('/billing/subscription').then(({ data }) => {
      setSub(data.data)
      if (data.data?.billing_cycle) setCycle(data.data.billing_cycle)
    })
  }

  useEffect(load, [])

  const availableCycles = useMemo(() => {
    const hasLifetime = plans.some((plan) => plan.lifetime_enabled)
    return CYCLES.filter(([key]) => key !== 'lifetime' || hasLifetime || cycle === 'lifetime')
  }, [cycle, plans])

  const subscribe = async (planId) => {
    setBusy(planId)
    try {
      const { data } = await api.post('/billing/subscribe', { plan_id: planId, billing_cycle: cycle })
      if (data.mode === 'checkout') window.location.assign(data.checkout_url)
      else load()
    } catch (e) {
      alert(e.response?.data?.message || 'Could not subscribe')
    } finally {
      setBusy(null)
    }
  }

  if (sub === undefined) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pricing plan</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your package is tied to your user account and applies across owned workspaces.</p>
        </div>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-300 bg-white p-1 text-sm dark:border-slate-700 dark:bg-slate-800">
          {availableCycles.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setCycle(key)} className={`rounded-full px-4 py-1.5 font-semibold ${cycle === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {plans.map((plan) => {
          const current = sub?.plan?.id === plan.id && sub?.billing_cycle === cycle
          const unavailable = cycle === 'lifetime' && !plan.lifetime_enabled
          const [price, suffix] = planPrice(plan, cycle)
          return (
            <Card key={plan.id} className={`flex flex-col p-4 ${plan.is_featured ? 'border-brand-500 ring-2 ring-brand-500/20' : ''} ${unavailable ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  {plan.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{plan.description}</p>}
                </div>
                {current ? <Badge color="emerald">Current</Badge> : plan.is_featured ? <Badge color="indigo">Featured</Badge> : null}
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatPrice(price, plan.currency)}</span>
                <span className="pb-1 text-xs text-slate-400">{suffix}</span>
              </div>
              {cycle === 'lifetime' ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-violet-500 dark:text-violet-300"><Infinity className="h-3.5 w-3.5" /> One-time lifetime access</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">{plan.trial_days || 0} day trial</p>
              )}

              <div className="mt-4 grid gap-1.5">
                {Object.entries(plan.limits || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">{LIMIT_LABELS[key] || key}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{formatLimit(key, value)}</span>
                  </div>
                ))}
              </div>

              <ul className="mt-4 flex-1 space-y-1.5 text-xs">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-600 dark:text-slate-300"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> {feature}</li>
                ))}
              </ul>
              <Button className="mt-4 w-full" size="sm" variant={current ? 'secondary' : 'primary'} disabled={current || unavailable} loading={busy === plan.id} onClick={() => subscribe(plan.id)}>
                {current ? 'Current package' : unavailable ? 'Not available' : 'Choose package'}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function planPrice(plan, cycle) {
  if (cycle === 'lifetime') return [plan.price_lifetime || 0, 'one-time']
  if (cycle === 'yearly') return [plan.price_yearly || 0, '/yr']
  return [plan.price_monthly || 0, '/mo']
}

function formatPrice(value, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(value || 0))
}
