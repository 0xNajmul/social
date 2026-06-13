import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Badge, PageLoader } from '../components/ui'

export default function Billing() {
  const [plans, setPlans] = useState([])
  const [sub, setSub] = useState(undefined)
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState(null)

  const load = () => {
    api.get('/plans').then(({ data }) => setPlans(data.data))
    api.get('/billing/subscription').then(({ data }) => setSub(data.data))
  }
  useEffect(load, [])

  const subscribe = async (planId) => {
    setBusy(planId)
    try {
      const { data } = await api.post('/billing/subscribe', { plan_id: planId, billing_cycle: yearly ? 'yearly' : 'monthly' })
      if (data.mode === 'checkout') window.location.href = data.checkout_url
      else load()
    } catch (e) { alert(e.response?.data?.message || 'Could not subscribe') }
    finally { setBusy(null) }
  }

  if (sub === undefined) return <PageLoader />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing</h1>

      {sub && (
        <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{sub.plan?.name}</p>
            <p className="text-xs text-slate-400">Renews {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}</p>
          </div>
          <Badge color={sub.on_trial ? 'amber' : 'emerald'}>{sub.status_label}</Badge>
        </Card>
      )}

      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white p-1 text-sm dark:border-slate-700 dark:bg-slate-800">
          <button onClick={() => setYearly(false)} className={`rounded-full px-4 py-1.5 ${!yearly ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>Monthly</button>
          <button onClick={() => setYearly(true)} className={`rounded-full px-4 py-1.5 ${yearly ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>Yearly</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {plans.map((plan) => {
          const current = sub?.plan?.id === plan.id
          return (
            <Card key={plan.id} className={`flex flex-col p-6 ${plan.is_featured ? 'ring-2 ring-brand-500/40' : ''}`}>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">${yearly ? plan.price_yearly : plan.price_monthly}</span>
                <span className="pb-1 text-xs text-slate-400">/{yearly ? 'yr' : 'mo'}</span>
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {(plan.features || []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-slate-600 dark:text-slate-300"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> {f}</li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant={current ? 'secondary' : 'primary'} disabled={current} loading={busy === plan.id} onClick={() => subscribe(plan.id)}>
                {current ? 'Current plan' : 'Choose plan'}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
