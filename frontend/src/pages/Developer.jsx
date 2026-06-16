import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Plus, Trash2, Webhook } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, ConfirmDialog, Input, Modal, PageLoader } from '../components/ui'

const WEBHOOK_EVENTS = ['post.published', 'post.failed', 'post.scheduled', 'account.connected', 'account.token_expired']

export default function Developer() {
  const [keys, setKeys] = useState(null)
  const [hooks, setHooks] = useState([])
  const [newKey, setNewKey] = useState('')
  const [keyName, setKeyName] = useState('')
  const [hookUrl, setHookUrl] = useState('')
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [hookModalOpen, setHookModalOpen] = useState(false)
  const [confirmKey, setConfirmKey] = useState(null)
  const [confirmHook, setConfirmHook] = useState(null)
  const [busy, setBusy] = useState('')

  const load = () => {
    api.get('/developer/api-keys').then(({ data }) => setKeys(data.data))
    api.get('/developer/webhooks').then(({ data }) => setHooks(data.data))
  }

  useEffect(load, [])

  const createKey = async (event) => {
    event.preventDefault()
    if (!keyName.trim()) return
    setBusy('key')
    try {
      const { data } = await api.post('/developer/api-keys', { name: keyName.trim() })
      setNewKey(data.secret)
      setKeyName('')
      setKeyModalOpen(false)
      load()
    } finally {
      setBusy('')
    }
  }

  const revokeKey = async () => {
    if (!confirmKey) return
    setBusy(`key-${confirmKey.id}`)
    try {
      await api.delete(`/developer/api-keys/${confirmKey.id}`)
      setConfirmKey(null)
      load()
    } finally {
      setBusy('')
    }
  }

  const createHook = async (event) => {
    event.preventDefault()
    if (!hookUrl.trim()) return
    setBusy('hook')
    try {
      await api.post('/developer/webhooks', { url: hookUrl.trim(), events: ['post.published', 'post.failed'] })
      setHookUrl('')
      setHookModalOpen(false)
      load()
    } finally {
      setBusy('')
    }
  }

  const deleteHook = async () => {
    if (!confirmHook) return
    setBusy(`hook-${confirmHook.id}`)
    try {
      await api.delete(`/developer/webhooks/${confirmHook.id}`)
      setConfirmHook(null)
      load()
    } finally {
      setBusy('')
    }
  }

  if (!keys) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Developer</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">API keys and webhooks for Zapier, n8n, and custom integrations.</p>
      </div>

      {newKey && (
        <Card className="border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-900/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Your new API key is shown once</p>
              <code className="mt-2 block truncate rounded-lg bg-white px-3 py-2 text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-100">{newKey}</code>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => copyText(newKey)}><Copy className="h-3.5 w-3.5" /> Copy key</Button>
          </div>
        </Card>
      )}

      <DeveloperCard
        icon={KeyRound}
        title="API keys"
        description="Create scoped credentials for automation tools and private API clients."
        actionLabel="New key"
        onAction={() => setKeyModalOpen(true)}
      >
        <ApiKeysTable keys={keys} onCopy={(key) => copyText(keyIdentifier(key))} onRevoke={setConfirmKey} />
      </DeveloperCard>

      <DeveloperCard
        icon={Webhook}
        title="Webhooks"
        description="Notify your external tools when publishing and account events happen."
        actionLabel="New webhook"
        onAction={() => setHookModalOpen(true)}
      >
        <WebhooksTable hooks={hooks} onDelete={setConfirmHook} />
      </DeveloperCard>

      <Modal open={keyModalOpen} title="Create API key" description="Name this key so your team can recognize where it is used." onClose={() => setKeyModalOpen(false)} size="md">
        <form onSubmit={createKey} className="space-y-4 p-5">
          <Input label="Key name" value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Zapier production" required />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setKeyModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy === 'key'}><Check className="h-4 w-4" /> Create key</Button>
          </div>
        </form>
      </Modal>

      <Modal open={hookModalOpen} title="Create webhook" description="Webhook events will be signed using a generated secret." onClose={() => setHookModalOpen(false)} size="md">
        <form onSubmit={createHook} className="space-y-4 p-5">
          <Input label="Webhook URL" type="url" value={hookUrl} onChange={(event) => setHookUrl(event.target.value)} placeholder="https://example.com/postflow/webhook" required />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Default events</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.slice(0, 2).map((event) => <Badge key={event} color="indigo">{event}</Badge>)}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">More event selection can be expanded later without changing existing hooks.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setHookModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy === 'hook'}><Check className="h-4 w-4" /> Create webhook</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmKey)}
        title="Revoke API key"
        description={`Revoke "${confirmKey?.name || 'this key'}"? Integrations using it will stop working.`}
        confirmLabel="Revoke key"
        loading={busy === `key-${confirmKey?.id}`}
        onClose={() => setConfirmKey(null)}
        onConfirm={revokeKey}
      />

      <ConfirmDialog
        open={Boolean(confirmHook)}
        title="Delete webhook"
        description={`Delete webhook "${confirmHook?.url || ''}"? Event deliveries to this URL will stop.`}
        confirmLabel="Delete webhook"
        loading={busy === `hook-${confirmHook?.id}`}
        onClose={() => setConfirmHook(null)}
        onConfirm={deleteHook}
      />
    </div>
  )
}

function DeveloperCard({ icon: Icon, title, description, actionLabel, onAction, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={onAction}><Plus className="h-4 w-4" /> {actionLabel}</Button>
      </div>
      {children}
    </Card>
  )
}

function ApiKeysTable({ keys, onCopy, onRevoke }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Name</th>
            <th className="px-5 py-3 font-semibold">Key identifier</th>
            <th className="px-5 py-3 font-semibold">Last used</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {keys.map((key) => (
            <tr key={key.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">{key.name}</td>
              <td className="px-5 py-4"><code className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">{keyIdentifier(key)}</code></td>
              <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}</td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-1.5">
                  <IconButton label="Copy key identifier" onClick={() => onCopy(key)}><Copy className="h-3.5 w-3.5" /></IconButton>
                  <IconButton label="Revoke key" tone="danger" onClick={() => onRevoke(key)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                </div>
              </td>
            </tr>
          ))}
          {keys.length === 0 && <tr><td colSpan="4" className="px-5 py-10 text-center text-slate-400">No API keys yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function WebhooksTable({ hooks, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">URL</th>
            <th className="px-5 py-3 font-semibold">Events</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {hooks.map((hook) => (
            <tr key={hook.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className="px-5 py-4"><p className="max-w-xl truncate font-medium text-slate-800 dark:text-slate-100">{hook.url}</p></td>
              <td className="px-5 py-4"><Badge color="indigo">{(hook.events || []).length} events</Badge></td>
              <td className="px-5 py-4"><Badge color={hook.is_active ? 'emerald' : 'slate'}>{hook.is_active ? 'Active' : 'Paused'}</Badge></td>
              <td className="px-5 py-4">
                <div className="flex justify-end">
                  <IconButton label="Delete webhook" tone="danger" onClick={() => onDelete(hook)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                </div>
              </td>
            </tr>
          ))}
          {hooks.length === 0 && <tr><td colSpan="4" className="px-5 py-10 text-center text-slate-400">No webhooks configured.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function IconButton({ label, tone = 'neutral', children, ...props }) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/70',
  }

  return (
    <button type="button" className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${tones[tone]}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

function keyIdentifier(key) {
  return `${key.prefix || 'sk_********'}...${key.last_four || '****'}`
}

function copyText(value) {
  navigator.clipboard?.writeText(value)
}
