import { useMemo, useState } from 'react'
import { BarChart3, Copy, DollarSign, Gift, Link2, TrendingUp, Users, WalletCards } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input } from '../components/ui'

const REFERRAL_HISTORY = [
  { id: 'RF-1042', name: 'Northstar Studio', package: 'Business', status: 'Subscribed', date: 'Jun 12, 2026', reward: '$24.50' },
  { id: 'RF-1037', name: 'Apex Creators', package: 'Trial', status: 'Trial', date: 'Jun 8, 2026', reward: 'Pending' },
  { id: 'RF-1028', name: 'Pixel Forge', package: 'Free', status: 'Signed up', date: 'May 28, 2026', reward: 'Pending' },
]

const MONTHLY_HISTORY = [
  { month: 'June 2026', referrals: 3, upgrades: 1, commission: '$24.50', status: 'Open' },
  { month: 'May 2026', referrals: 7, upgrades: 4, commission: '$118.00', status: 'Paid' },
  { month: 'April 2026', referrals: 4, upgrades: 2, commission: '$72.00', status: 'Paid' },
]

const USAGE_HISTORY = [
  { date: 'Jun 15, 2026', type: 'Balance credit', amount: '+$24.50', note: 'Business plan renewal' },
  { date: 'May 31, 2026', type: 'Withdraw request', amount: '-$100.00', note: 'Bank payout' },
  { date: 'May 20, 2026', type: 'Balance credit', amount: '+$42.00', note: 'Two Pro upgrades' },
]

const TABS = [
  { key: 'referrals', label: 'Referral history', icon: Users },
  { key: 'monthly', label: 'Affiliate monthly history', icon: WalletCards },
  { key: 'usage', label: 'Withdraw/usage history', icon: DollarSign },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function InviteEarn() {
  const { user, activeWorkspace } = useAuth()
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('referrals')
  const memberId = user?.member_id || user?.referral_code || buildMemberId(user?.id)
  const referralUrl = useMemo(() => `${window.location.origin}/register?ref=${encodeURIComponent(memberId)}`, [memberId])

  const copyLink = async () => {
    await navigator.clipboard?.writeText(referralUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invite & earn</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Share your member referral link, track signups, and monitor affiliate rewards from one place.</p>
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
        <Stat icon={Users} label="Total referrals" value="14" hint="3 this month" />
        <Stat icon={WalletCards} label="Balance" value="$214.50" hint="Available rewards" />
        <Stat icon={TrendingUp} label="This month" value="$24.50" hint="Eligible commission" />
        <Stat icon={Gift} label="Current package" value={activeWorkspace?.subscription?.plan?.name || 'Free'} hint="Workspace plan" />
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

        {tab === 'referrals' && (
          <DataTable columns={['Referral ID', 'Workspace', 'Package', 'Status', 'Joined', 'Reward']}>
            {REFERRAL_HISTORY.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.id}</td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.name}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.package}</td>
                <td className="px-4 py-3"><Badge color={item.status === 'Subscribed' ? 'emerald' : 'amber'}>{item.status}</Badge></td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.date}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{item.reward}</td>
              </tr>
            ))}
          </DataTable>
        )}

        {tab === 'monthly' && (
          <DataTable columns={['Month', 'Referrals', 'Upgrades', 'Commission', 'Status']}>
            {MONTHLY_HISTORY.map((item) => (
              <tr key={item.month} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.month}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.referrals}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.upgrades}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{item.commission}</td>
                <td className="px-4 py-3"><Badge color={item.status === 'Paid' ? 'emerald' : 'sky'}>{item.status}</Badge></td>
              </tr>
            ))}
          </DataTable>
        )}

        {tab === 'usage' && (
          <DataTable columns={['Date', 'Type', 'Amount', 'Note']}>
            {USAGE_HISTORY.map((item) => (
              <tr key={`${item.date}-${item.type}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.date}</td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{item.type}</td>
                <td className={clsx('px-4 py-3 font-semibold', item.amount.startsWith('+') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{item.amount}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.note}</td>
              </tr>
            ))}
          </DataTable>
        )}

        {tab === 'analytics' && <AffiliateAnalytics />}
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

function AffiliateAnalytics() {
  const bars = [42, 64, 38, 88, 73, 104, 92]

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Referral conversion trend</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Demo analytics for clicks, trials, upgrades, and commissions.</p>
          </div>
          <Link2 className="h-5 w-5 text-brand-500" />
        </div>
        <div className="mt-6 flex h-60 items-end gap-3">
          {bars.map((height, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-xl bg-gradient-to-t from-brand-600 to-sky-400" style={{ height }} />
              <span className="text-[10px] text-slate-400">W{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <MiniAnalytic label="Referral clicks" value="1,284" />
        <MiniAnalytic label="Trial signups" value="82" />
        <MiniAnalytic label="Paid upgrades" value="17" />
        <MiniAnalytic label="Conversion rate" value="20.7%" />
      </div>
    </div>
  )
}

function MiniAnalytic({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function buildMemberId(id) {
  return String(Number(id || 0) * 1000003 + 7919).padStart(10, '0').slice(0, 10)
}
