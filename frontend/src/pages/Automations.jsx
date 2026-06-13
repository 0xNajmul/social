import { useEffect, useState } from 'react'
import { Plus, Workflow, Play, Trash2, Rss, X } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Badge, Input, PageLoader, EmptyState } from '../components/ui'

const TYPES = [
  { value: 'rss_feed', label: 'RSS feed' },
  { value: 'recycle', label: 'Evergreen recycle' },
  { value: 'repost_top_performing', label: 'Repost top performing' },
]

export default function Automations() {
  const [automations, setAutomations] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'rss_feed', feed_url: '', use_ai: true, account_ids: [] })

  const load = () => {
    api.get('/automations').then(({ data }) => setAutomations(data.data))
    api.get('/social/accounts').then(({ data }) => setAccounts(data.data))
  }
  useEffect(load, [])

  const create = async () => {
    try {
      await api.post('/automations', {
        name: form.name,
        type: form.type,
        social_account_ids: form.account_ids,
        use_ai: form.use_ai,
        feed_urls: form.feed_url ? [form.feed_url] : [],
        config: { interval_minutes: 60 },
      })
      setShow(false)
      setForm({ name: '', type: 'rss_feed', feed_url: '', use_ai: true, account_ids: [] })
      load()
    } catch (e) {
      alert(e.response?.data?.message || 'Could not create automation')
    }
  }

  const run = async (id) => { await api.post(`/automations/${id}/run`); alert('Automation queued.') }
  const remove = async (id) => { if (confirm('Delete?')) { await api.delete(`/automations/${id}`); load() } }
  const toggleAccount = (id) => setForm((f) => ({ ...f, account_ids: f.account_ids.includes(id) ? f.account_ids.filter((x) => x !== id) : [...f.account_ids, id] }))

  if (!automations) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automations</h1>
          <p className="text-sm text-slate-500">Auto-post from feeds, recycle evergreen content and more.</p>
        </div>
        <Button onClick={() => setShow(true)}><Plus className="h-4 w-4" /> New automation</Button>
      </div>

      {automations.length === 0 ? (
        <EmptyState icon={Workflow} title="No automations yet" description="Create your first automation to put content on autopilot." action={<Button onClick={() => setShow(true)}>Create automation</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {automations.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                    <Rss className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.type_label}</p>
                  </div>
                </div>
                <Badge color={a.is_active ? 'emerald' : 'gray'}>{a.is_active ? 'Active' : 'Paused'}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span>{a.items_created} posts created</span>
                {a.use_ai && <Badge color="violet">AI</Badge>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => run(a.id)}><Play className="h-3.5 w-3.5" /> Run now</Button>
                <Button size="sm" variant="ghost" className="text-rose-500" onClick={() => remove(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShow(false)}>
          <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">New automation</h2>
              <button onClick={() => setShow(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Blog → Social" />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Type</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              {form.type === 'rss_feed' && <Input label="Feed URL" value={form.feed_url} onChange={(e) => setForm({ ...form, feed_url: e.target.value })} placeholder="https://blog.com/feed" />}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Post to</span>
                <div className="flex flex-wrap gap-2">
                  {accounts.map((a) => (
                    <button key={a.id} onClick={() => toggleAccount(a.id)} className={`rounded-lg border px-3 py-1.5 text-xs ${form.account_ids.includes(a.id) ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={form.use_ai} onChange={(e) => setForm({ ...form, use_ai: e.target.checked })} /> Enhance with AI
              </label>
              <Button className="w-full" onClick={create} disabled={!form.name || form.account_ids.length === 0}>Create automation</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
