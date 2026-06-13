import { useEffect, useState } from 'react'
import { KeyRound, Webhook, Plus, Trash2, Copy } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Input, Badge, PageLoader } from '../components/ui'

export default function Developer() {
  const [keys, setKeys] = useState(null)
  const [hooks, setHooks] = useState([])
  const [newKey, setNewKey] = useState('')
  const [keyName, setKeyName] = useState('')
  const [hookUrl, setHookUrl] = useState('')

  const load = () => {
    api.get('/developer/api-keys').then(({ data }) => setKeys(data.data))
    api.get('/developer/webhooks').then(({ data }) => setHooks(data.data))
  }
  useEffect(load, [])

  const createKey = async () => {
    if (!keyName) return
    const { data } = await api.post('/developer/api-keys', { name: keyName })
    setNewKey(data.secret)
    setKeyName('')
    load()
  }
  const revoke = async (id) => { if (confirm('Revoke key?')) { await api.delete(`/developer/api-keys/${id}`); load() } }
  const createHook = async () => {
    if (!hookUrl) return
    await api.post('/developer/webhooks', { url: hookUrl, events: ['post.published', 'post.failed'] })
    setHookUrl('')
    load()
  }
  const deleteHook = async (id) => { await api.delete(`/developer/webhooks/${id}`); load() }

  if (!keys) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Developer</h1>
        <p className="text-sm text-slate-500">API keys &amp; webhooks for Zapier, n8n and custom integrations.</p>
      </div>

      {newKey && (
        <Card className="border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-900/20">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Your new API key (copy it now — shown once)</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900">{newKey}</code>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(newKey); }}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><KeyRound className="h-4 w-4" /> API keys</h2>
        <div className="flex gap-2">
          <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name (e.g. Zapier)" className="flex-1" />
          <Button onClick={createKey}><Plus className="h-4 w-4" /> Create</Button>
        </div>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-3 text-sm">
              <span className="text-slate-700 dark:text-slate-200">{k.name} <code className="ml-2 text-xs text-slate-400">{k.prefix}…</code></span>
              <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => revoke(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
          {keys.length === 0 && <li className="py-3 text-sm text-slate-400">No API keys yet.</li>}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Webhook className="h-4 w-4" /> Webhooks</h2>
        <div className="flex gap-2">
          <Input value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." className="flex-1" />
          <Button onClick={createHook}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-3 text-sm">
              <span className="truncate text-slate-700 dark:text-slate-200">{h.url}</span>
              <div className="flex items-center gap-2">
                <Badge color="indigo">{(h.events || []).length} events</Badge>
                <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => deleteHook(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          ))}
          {hooks.length === 0 && <li className="py-3 text-sm text-slate-400">No webhooks configured.</li>}
        </ul>
      </Card>
    </div>
  )
}
