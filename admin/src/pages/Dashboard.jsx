import { useEffect, useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Users, Building2, Share2, FileText, DollarSign, Activity } from 'lucide-react'
import api from '../lib/api'
import { Card, StatCard, PageLoader, Badge } from '../components/ui'

export default function Dashboard() {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/admin/dashboard').then(({ data }) => setData(data)) }, [])
  if (!data) return <PageLoader />
  const { stats, revenue, signups, plan_distribution, health } = data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Platform overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.users} icon={Users} hint={`+${stats.new_users_30d} in 30d`} />
        <StatCard label="Workspaces" value={stats.workspaces} icon={Building2} />
        <StatCard label="Social accounts" value={stats.social_accounts} icon={Share2} />
        <StatCard label="Posts" value={stats.posts} icon={FileText} hint={`${stats.published_posts} published`} />
        <StatCard label="MRR" value={`$${revenue.mrr}`} icon={DollarSign} hint={`$${revenue.arr} ARR`} />
        <StatCard label="Active subscriptions" value={stats.active_subscriptions} icon={Activity} />
        <StatCard label="Queue pending" value={health.queue_pending} icon={Activity} />
        <StatCard label="Queue failed" value={health.queue_failed} icon={Activity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-white">New signups (30d)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={signups}>
              <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(d) => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#s)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-white">Plan distribution</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={plan_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="plan" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} />
              <Bar dataKey="subscribers" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-white">System health</h2>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(health).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-800 p-3">
              <p className="text-xs capitalize text-slate-500">{k.replace(/_/g, ' ')}</p>
              <p className="mt-1 font-semibold text-slate-200">
                {typeof v === 'number' ? v : <Badge color={v === 'ok' ? 'emerald' : 'slate'}>{v}</Badge>}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
