import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Badge, PageLoader, EmptyState } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'

export default function Accounts() {
  const [accounts, setAccounts] = useState(null)
  const [platforms, setPlatforms] = useState([])
  const [showConnect, setShowConnect] = useState(false)
  const [connecting, setConnecting] = useState(null)

  const load = () => {
    api.get('/social/accounts').then(({ data }) => setAccounts(data.data))
    api.get('/social/platforms').then(({ data }) => setPlatforms(data.data))
  }
  useEffect(load, [])

  const connect = async (platform) => {
    setConnecting(platform)
    try {
      const { data } = await api.post('/social/accounts/connect', { platform })
      if (data.mode === 'oauth') {
        window.location.href = data.redirect_url
      } else {
        setShowConnect(false)
        load()
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Could not connect')
    } finally {
      setConnecting(null)
    }
  }

  const disconnect = async (id) => {
    if (!confirm('Disconnect this account?')) return
    await api.delete(`/social/accounts/${id}`)
    load()
  }

  const refresh = async (id) => {
    await api.post(`/social/accounts/${id}/refresh`)
    alert('Token refresh queued.')
  }

  if (!accounts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Connected accounts</h1>
          <p className="text-sm text-slate-500">Connect and manage all your social profiles.</p>
        </div>
        <Button onClick={() => setShowConnect(true)}><Plus className="h-4 w-4" /> Connect account</Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No accounts connected"
          description="Connect your first social account to start scheduling posts."
          action={<Button onClick={() => setShowConnect(true)}>Connect account</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={acc.platform} size="lg" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{acc.name}</p>
                    <p className="text-xs text-slate-400">{acc.username}</p>
                  </div>
                </div>
                {acc.status === 'active' && !acc.is_expiring_soon ? (
                  <Badge color="emerald"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
                ) : acc.is_expiring_soon ? (
                  <Badge color="amber"><AlertTriangle className="mr-1 h-3 w-3" /> Expiring</Badge>
                ) : (
                  <Badge color="rose">{acc.status}</Badge>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">{acc.platform_label}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => refresh(acc.id)}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
                <Button size="sm" variant="ghost" onClick={() => disconnect(acc.id)} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Connect modal */}
      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowConnect(false)}>
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Choose a platform</h2>
              <button onClick={() => setShowConnect(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {platforms.map((p) => (
                <button
                  key={p.key}
                  onClick={() => connect(p.key)}
                  disabled={connecting === p.key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <PlatformBadge platform={p.key} size="md" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Demo mode connects a simulated account. Add OAuth keys in the backend to enable real connections.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
