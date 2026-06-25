import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Copy, DollarSign, Gift, Link2, TrendingUp, Users, WalletCards } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, EmptyState, Input, PageLoader } from '../components/ui'

const TABS = [
  { key: 'invites', label: 'Invite activity', icon: Users },
  { key: 'packages', label: 'Workspace packages', icon: WalletCards },
  { key: 'ledger', label: 'Reward ledger', icon: DollarSign },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function InviteEarn() {
  const { user, activeWorkspace, workspaces = [] } = useAuth()
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('invites')
  const [teamData, setTeamData] = useState(null)
  const memberId = user?.member_id || user?.referral_code || buildMemberId(user?.id)
  const referralUrl = useMemo(() => `${window.location.origin}/register?ref=${encodeURIComponent(memberId)}`, [memberId])

  useEffect(() => {
    let active = true
    api.get('/team')
      .then(({ data }) => {
        if (active) setTeamData({ members: data.members || [], invitations: data.invitations || [], permissions: data.permissions || {} })
      })
      .catch(() => {
        if (active) setTeamData({ members: [], invitations: [], permissions: {} })
      })
    return () => {
      active = false
    }
  }, [])

  const pendingInvitations = teamData?.invitations || []
  const members = teamData?.members || []
  const activePlan = activeWorkspace?.subscription?.plan?.name || 'Free'

  const copyLink = async () => {
    await navigator.clipboard?.writeText(referralUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  if (!teamData) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invite & earn</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Share your member link and track real workspace invite activity from this account.</p>
        </div>
        <Card className="w-full p-3 xl:max-w-xl">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Referral link · Member ID {memberId}</p>
              <Input value={referralUrl} readOnly />
            </div>
            <Button onClick={copyLink} variant={copied ? 'secondary' : 'primary'} className="self-end"><Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Pending invites" value={pendingInvitations.length} hint={`${members.length} current members`} />
        <Stat icon={WalletCards} label="Workspaces" value={workspaces.length} hint={`${activeWorkspace?.name || 'Current workspace'} active`} />
        <Stat icon={TrendingUp} label="Reward balance" value={formatMoney(0)} hint="No payout records yet" />
        <Stat icon={Gift} label="Current package" value={activePlan} hint="Workspace plan" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 dark:border-slate-800">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition',
                tab === key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'invites' && (
          pendingInvitations.length ? (
            <DataTable columns={['Email', 'Role', 'Invited by', 'Created', 'Expires', 'Status']}>
              {pendingInvitations.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.email}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatRole(item.role)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.invited_by || 'Workspace admin'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(item.expires_at)}</td>
                  <td className="px-4 py-3"><Badge color={item.is_expired ? 'rose' : 'amber'}>{item.is_expired ? 'Expired' : 'Pending'}</Badge></td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyPane icon={Users} title="No pending invites" description="Workspace invitations you send will appear here." />
          )
        )}

        {tab === 'packages' && (
          workspaces.length ? (
            <DataTable columns={['Workspace', 'Role', 'Package', 'Members', 'Accounts']}>
              {workspaces.map((workspace) => (
                <tr key={workspace.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 dark:text-white">{workspace.name}</p>
                    <p className="text-xs text-slate-400">{workspace.public_id || workspace.slug}</p>
                  </td>
                  <td className="px-4 py-3"><Badge color={workspace.role === 'owner' ? 'amber' : 'indigo'}>{formatRole(workspace.role)}</Badge></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{workspace.subscription?.plan?.name || 'Free'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{workspace.members_count ?? 0}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{workspace.social_accounts_count ?? 0}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyPane icon={WalletCards} title="No workspaces found" description="Create or join a workspace to see package data." />
          )
        )}

        {tab === 'ledger' && (
          <EmptyPane icon={DollarSign} title="No reward ledger yet" description="Payout and commission rows will appear after affiliate income records are recorded." />
        )}

        {tab === 'analytics' && (
          <InviteAnalytics memberId={memberId} members={members} pendingInvitations={pendingInvitations} workspaces={workspaces} />
        )}
      </Card>
    </div>
  )
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <Card className="p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Icon className="h-5 w-5" /></span>
      <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  )
}

function DataTable({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function InviteAnalytics({ memberId, members, pendingInvitations, workspaces }) {
  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Invite status</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Real account and workspace invite counts for member {memberId}.</p>
          </div>
          <Link2 className="h-5 w-5 text-brand-500" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniAnalytic label="Workspace members" value={members.length} />
          <MiniAnalytic label="Pending invites" value={pendingInvitations.length} />
          <MiniAnalytic label="Workspaces" value={workspaces.length} />
        </div>
      </div>
      <EmptyState
        icon={DollarSign}
        title="Affiliate income not recorded"
        description="The app has no payout records for this member yet, so reward analytics remain zero."
      />
    </div>
  )
}

function EmptyPane({ icon, title, description }) {
  return (
    <div className="p-5">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  )
}

function MiniAnalytic({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{Number(value || 0).toLocaleString()}</p>
    </div>
  )
}

function buildMemberId(id) {
  return String(Number(id || 0) * 1000003 + 7919).padStart(10, '0').slice(0, 10)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function formatRole(role) {
  if (!role) return 'Member'
  return String(role).charAt(0).toUpperCase() + String(role).slice(1)
}
