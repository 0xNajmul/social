import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, CreditCard, Gauge } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, PageLoader } from '../components/ui'

const LIMIT_LABELS = {
  workspaces: 'Workspaces',
  team_members: 'Team members',
  social_accounts: 'Social accounts',
  scheduled_posts: 'Scheduled posts',
  monthly_posts: 'Monthly posts',
  automations: 'Automations',
  ai_credits: 'AI credits',
  storage_mb: 'Storage',
}

export default function Billing() {
  const [plans, setPlans] = useState([])
  const [sub, setSub] = useState(undefined)
  const [usage, setUsage] = useState({})
  const [accountWorkspaces, setAccountWorkspaces] = useState([])
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState(null)

  const load = () => {
    api.get('/plans').then(({ data }) => setPlans(data.data))
    api.get('/billing/subscription').then(({ data }) => {
      setSub(data.data)
      setUsage(data.usage || {})
      setAccountWorkspaces(data.workspaces || [])
    })
  }

  useEffect(load, [])

  const subscribe = async (planId) => {
    setBusy(planId)
    try {
      const { data } = await api.post('/billing/subscribe', { plan_id: planId, billing_cycle: yearly ? 'yearly' : 'monthly' })
      if (data.mode === 'checkout') window.location.assign(data.checkout_url)
      else load()
    } catch (e) {
      alert(e.response?.data?.message || 'Could not subscribe')
    } finally {
      setBusy(null)
    }
  }

  const usageEntries = useMemo(() => Object.entries(usage), [usage])

  if (sub === undefined) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pricing plan</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your package is tied to your user account and applies across owned workspaces.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white p-1 text-sm dark:border-slate-700 dark:bg-slate-800">
          <button type="button" onClick={() => setYearly(false)} className={`rounded-full px-4 py-1.5 ${!yearly ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>Monthly</button>
          <button type="button" onClick={() => setYearly(true)} className={`rounded-full px-4 py-1.5 ${yearly ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>Yearly</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard icon={CreditCard} label="Current package" value={sub?.plan?.name || 'No package'} hint={sub?.current_period_end ? `Renews ${new Date(sub.current_period_end).toLocaleDateString()}` : 'No renewal date'} />
        <SummaryCard icon={Building2} label="Owned workspaces" value={usage.workspaces?.used ?? accountWorkspaces.length} hint={`${usage.workspaces?.remaining ?? 'Unlimited'} remaining`} />
        <SummaryCard icon={Gauge} label="Storage used" value={`${usage.storage_mb?.used ?? 0} MB`} hint={formatRemaining(usage.storage_mb)} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Account package usage</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Usage is counted across the workspaces owned by your account.</p>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
          {usageEntries.map(([key, metric]) => <UsageMeter key={key} label={LIMIT_LABELS[key] || key.replace(/_/g, ' ')} metric={metric} />)}
          {usageEntries.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No usage data available yet.</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Workspaces using this package</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr><th className="px-5 py-3">Workspace</th><th className="px-5 py-3">Members</th><th className="px-5 py-3">Accounts</th><th className="px-5 py-3">Posts</th><th className="px-5 py-3">Automations</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {accountWorkspaces.map((workspace) => (
                <tr key={workspace.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900 dark:text-white">{workspace.name}</p>
                    <p className="text-xs text-slate-400">{workspace.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.members_count ?? 0}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.social_accounts_count ?? 0}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.posts_count ?? 0}</td>
                  <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{workspace.automations_count ?? 0}</td>
                </tr>
              ))}
              {accountWorkspaces.length === 0 && <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-400">No owned workspaces found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-4">
        {plans.map((plan) => {
          const current = sub?.plan?.id === plan.id
          return (
            <Card key={plan.id} className={`flex flex-col p-6 ${plan.is_featured ? 'border-brand-500 ring-2 ring-brand-500/20' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  {plan.description && <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">{plan.description}</p>}
                </div>
                {current ? <Badge color="emerald">Current</Badge> : plan.is_featured ? <Badge color="indigo">Featured</Badge> : null}
              </div>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">${yearly ? plan.price_yearly : plan.price_monthly}</span>
                <span className="pb-1 text-xs text-slate-400">/{yearly ? 'yr' : 'mo'}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{plan.trial_days || 0} day trial</p>

              <div className="mt-5 grid gap-2">
                {Object.entries(plan.limits || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">{LIMIT_LABELS[key] || key}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{formatLimit(key, value)}</span>
                  </div>
                ))}
              </div>

              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-slate-600 dark:text-slate-300"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {feature}</li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant={current ? 'secondary' : 'primary'} disabled={current} loading={busy === plan.id} onClick={() => subscribe(plan.id)}>
                {current ? 'Current package' : 'Choose package'}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-3 truncate text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </Card>
  )
}

function UsageMeter({ label, metric }) {
  const percent = metric.limit ? Math.min(100, Math.round((metric.used / metric.limit) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between gap-4 text-xs">
        <span className="capitalize text-slate-500 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-700 dark:text-slate-200">{metric.used} / {metric.limit ?? 'Unlimited'}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${metric.limit ? percent : 12}%` }} /></div>
    </div>
  )
}

function formatLimit(key, value) {
  if (value === -1 || value === null || value === undefined) return 'Unlimited'
  if (key === 'storage_mb') return `${value} MB`
  return value
}

function formatRemaining(metric) {
  if (!metric) return 'No limit data'
  if (metric.remaining === null || metric.remaining === undefined) return 'Unlimited remaining'
  return `${metric.remaining} remaining`
}
