import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Card, Badge, PageLoader } from '../components/ui'

export default function Plans() {
  const [plans, setPlans] = useState(null)
  useEffect(() => { api.get('/admin/plans').then(({ data }) => setPlans(data.data)) }, [])
  if (!plans) return <PageLoader />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Plans</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{p.name}</h3>
              {p.is_featured && <Badge color="indigo">Featured</Badge>}
            </div>
            <p className="mt-1 text-2xl font-extrabold text-white">${p.price_monthly}<span className="text-sm font-normal text-slate-500">/mo</span></p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
              <li>Social accounts: {p.limits.social_accounts === -1 ? '∞' : p.limits.social_accounts}</li>
              <li>Team members: {p.limits.team_members === -1 ? '∞' : p.limits.team_members}</li>
              <li>Monthly posts: {p.limits.monthly_posts === -1 ? '∞' : p.limits.monthly_posts}</li>
              <li>AI credits: {p.limits.ai_credits}</li>
              <li>Storage: {p.limits.storage_mb} MB</li>
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
