import { useCallback, useEffect, useState } from 'react'
import api from '../lib/api'
import { PageLoader } from '../components/ui'
import UsageOverview from '../components/billing/UsageOverview'

export default function Usage() {
  return <UsageWorkspacePanel />
}

export function UsageWorkspacePanel({ embedded = false }) {
  const [payload, setPayload] = useState(null)

  const load = useCallback(() => {
    api.get('/billing/subscription')
      .then(({ data }) => setPayload(data))
      .catch(() => setPayload({ data: null, usage: {}, workspaces: [] }))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!payload) return <PageLoader />

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usage</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track package usage for the current workspace.</p>
        </div>
      )}

      <UsageOverview
        subscription={payload.data}
        usage={payload.usage || {}}
        accountWorkspaces={payload.workspaces || []}
      />
    </div>
  )
}
