import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Heart, MessageCircle, Share2, Eye } from 'lucide-react'
import api from '../lib/api'
import { Card, StatCard, PageLoader } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'

export default function Analytics() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/analytics/overview').then(({ data }) => setData(data))
  }, [])

  if (!data) return <PageLoader />
  const { summary, by_platform, timeseries, top_posts } = data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Likes" value={summary.likes.toLocaleString()} icon={Heart} accent="rose" />
        <StatCard label="Comments" value={summary.comments.toLocaleString()} icon={MessageCircle} accent="sky" />
        <StatCard label="Shares" value={summary.shares.toLocaleString()} icon={Share2} accent="emerald" />
        <StatCard label="Impressions" value={summary.impressions.toLocaleString()} icon={Eye} accent="brand" hint={`${summary.engagement_rate}% engagement`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Engagement over time</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="likes" stroke="#6366f1" fill="url(#g)" strokeWidth={2} />
              <Area type="monotone" dataKey="impressions" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">By platform</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={by_platform}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} />
              <XAxis dataKey="platform" tick={{ fontSize: 10 }} tickFormatter={(p) => p?.slice(0, 4)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="engagement" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Top performing posts</h2>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {top_posts.length === 0 && <li className="p-5 text-sm text-slate-400">No published posts yet.</li>}
          {top_posts.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-4">
              <PlatformBadge platform={p.platform} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{p.content}</p>
              <div className="flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {p.likes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {p.comments}</span>
                <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> {p.shares}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
