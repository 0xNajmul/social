import { Building2, CreditCard, Gauge } from 'lucide-react'
import { LIMIT_LABELS } from '../../lib/billing'
import { Card } from '../ui'

export default function UsageOverview({ subscription, usage = {}, accountWorkspaces = [], scope = 'account' }) {
  const usageEntries = Object.entries(usage)
  const workspaceScope = scope === 'workspace'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryCard icon={CreditCard} label="Current package" value={subscription?.plan?.name || 'No package'} hint={subscription?.current_period_end ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}` : 'No renewal date'} />
        <SummaryCard icon={Building2} label={workspaceScope ? 'This workspace' : 'Owned workspaces'} value={workspaceScope ? accountWorkspaces[0]?.name || 'Workspace' : usage.workspaces?.used ?? accountWorkspaces.length} hint={workspaceScope ? accountWorkspaces[0]?.slug || 'Current workspace' : `${usage.workspaces?.remaining ?? 'Unlimited'} remaining`} />
        <SummaryCard icon={Gauge} label="Storage used" value={`${usage.storage_mb?.used ?? 0} MB`} hint={formatRemaining(usage.storage_mb)} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">{workspaceScope ? 'Workspace package usage' : 'Account package usage'}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{workspaceScope ? 'Usage below is limited to this workspace.' : 'Usage is counted across the workspaces owned by your account.'}</p>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
          {usageEntries.map(([key, metric]) => <UsageMeter key={key} label={LIMIT_LABELS[key] || key.replace(/_/g, ' ')} metric={metric} />)}
          {usageEntries.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No usage data available yet.</p>}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">{workspaceScope ? 'Current workspace' : 'Workspaces using this package'}</h2>
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

function formatRemaining(metric) {
  if (!metric) return 'No limit data'
  if (metric.remaining === null || metric.remaining === undefined) return 'Unlimited remaining'
  return `${metric.remaining} remaining`
}
