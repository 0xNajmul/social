import { useMemo, useState } from 'react'
import { Copy, DollarSign, Gift, Link2, TrendingUp, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Input } from '../components/ui'

const REFERRAL_HISTORY = [
  { name: 'Northstar Studio', status: 'Subscribed', date: 'Jun 12, 2026', reward: '$24.50' },
  { name: 'Apex Creators', status: 'Trial', date: 'Jun 8, 2026', reward: 'Pending' },
  { name: 'Pixel Forge', status: 'Signed up', date: 'May 28, 2026', reward: 'Pending' },
]

const MONTHLY_HISTORY = [
  { month: 'June 2026', referrals: 3, commission: '$24.50' },
  { month: 'May 2026', referrals: 7, commission: '$118.00' },
  { month: 'April 2026', referrals: 4, commission: '$72.00' },
]

export default function InviteEarn() {
  const { user, activeWorkspace } = useAuth()
  const [copied, setCopied] = useState(false)
  const referralUrl = useMemo(() => {
    const code = user?.referral_code || `PF-${user?.id || 'USER'}`
    return `${window.location.origin}/register?ref=${encodeURIComponent(code)}`
  }, [user])

  const copyLink = async () => {
    await navigator.clipboard?.writeText(referralUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Badge className="bg-white/15 text-white dark:bg-white/15 dark:text-white">Invite & earn</Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Share Postflow and earn recurring rewards.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">
              Give creators and teams your referral link. When they upgrade, your affiliate balance grows with every eligible subscription.
            </p>
          </div>
          <Card className="border-white/15 bg-white/10 p-5 text-white shadow-none backdrop-blur dark:border-white/15 dark:bg-white/10">
            <p className="text-sm text-indigo-100">Current package</p>
            <p className="mt-1 text-2xl font-bold">{activeWorkspace?.subscription?.plan?.name || 'Starter'}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Metric icon={WalletCards} label="Balance" value="$214.50" />
              <Metric icon={TrendingUp} label="This month" value="$24.50" />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Users} label="Total referrals" value="14" />
        <Stat icon={DollarSign} label="Paid commission" value="$438.00" />
        <Stat icon={Gift} label="Pending rewards" value="$96.50" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Link2 className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Your referral link</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Share this link anywhere you promote your workspace.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-[1fr_auto]">
          <Input value={referralUrl} readOnly />
          <Button onClick={copyLink} variant={copied ? 'secondary' : 'primary'}><Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}</Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionTitle title="Referral history" description="People and workspaces that joined from your link." />
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {REFERRAL_HISTORY.map((item) => (
              <HistoryRow key={item.name} title={item.name} meta={`${item.status} · ${item.date}`} value={item.reward} />
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionTitle title="Affiliate monthly history" description="Commission summary by month." />
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {MONTHLY_HISTORY.map((item) => (
              <HistoryRow key={item.month} title={item.month} meta={`${item.referrals} referrals`} value={item.commission} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><Icon className="h-5 w-5" /></span>
      <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </Card>
  )
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <Icon className="h-5 w-5 text-indigo-100" />
      <p className="mt-3 text-xl font-bold">{value}</p>
      <p className="text-xs text-indigo-100">{label}</p>
    </div>
  )
}

function SectionTitle({ title, description }) {
  return (
    <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
      <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  )
}

function HistoryRow({ title, meta, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{meta}</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{value}</span>
    </div>
  )
}
