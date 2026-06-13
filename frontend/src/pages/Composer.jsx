import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wand2, Hash, Sparkles, Send, CalendarClock, Save, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, Textarea, Badge, EmptyState } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'

export default function Composer() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState([])
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [aiBusy, setAiBusy] = useState(null)
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState({})

  useEffect(() => {
    api.get('/social/accounts').then(({ data }) => setAccounts(data.data.filter((a) => a.status === 'active')))
  }, [])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const runAi = async (type) => {
    if (!content && type !== 'ideas') return
    setAiBusy(type)
    try {
      const { data } = await api.post('/ai/generate', { type, topic: content, content, tone: 'friendly' })
      if (type === 'hashtags') {
        setContent((c) => `${c}\n\n${data.result.join(' ')}`)
      } else if (type === 'caption' || type === 'hook') {
        setContent(data.result)
      }
    } catch (e) {
      alert(e.response?.data?.message || 'AI error')
    } finally {
      setAiBusy(null)
    }
  }

  const buildPayload = () => ({
    content,
    type: 'text',
    targets: selected.map((id) => ({ social_account_id: id })),
    scheduled_at: scheduledAt || null,
  })

  const createPost = async () => {
    const { data } = await api.post('/posts', buildPayload())
    setValidation(data.validation || {})
    return data.data
  }

  const action = async (mode) => {
    if (selected.length === 0) return alert('Select at least one account.')
    setSaving(true)
    try {
      const post = await createPost()
      if (mode === 'schedule') {
        if (!scheduledAt) { alert('Pick a date/time to schedule.'); setSaving(false); return }
        await api.post(`/posts/${post.id}/schedule`, { scheduled_at: scheduledAt })
      } else if (mode === 'publish') {
        await api.post(`/posts/${post.id}/publish`)
      }
      navigate('/app/calendar')
    } catch (e) {
      const v = e.response?.data?.validation
      if (v) setValidation(v)
      else alert(e.response?.data?.message || 'Could not save post')
    } finally {
      setSaving(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Connect an account first"
        description="You need at least one connected social account to compose a post."
        action={<Button onClick={() => navigate('/app/accounts')}>Connect account</Button>}
      />
    )
  }

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compose</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Account picker */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Publish to</h2>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    selected.includes(a.id)
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <PlatformBadge platform={a.platform} size="xs" />
                  <span className="text-slate-700 dark:text-slate-200">{a.name}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Editor */}
          <Card className="p-5">
            <Textarea rows={9} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What do you want to share?" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => runAi('caption')} loading={aiBusy === 'caption'}><Wand2 className="h-3.5 w-3.5" /> AI caption</Button>
              <Button size="sm" variant="secondary" onClick={() => runAi('hook')} loading={aiBusy === 'hook'}><Sparkles className="h-3.5 w-3.5" /> Hook</Button>
              <Button size="sm" variant="secondary" onClick={() => runAi('hashtags')} loading={aiBusy === 'hashtags'}><Hash className="h-3.5 w-3.5" /> Hashtags</Button>
              <span className="ml-auto text-xs text-slate-400">{content.length} chars</span>
            </div>
          </Card>

          {/* Validation */}
          {Object.keys(validation).length > 0 && (
            <Card className="border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Platform warnings</p>
              {Object.entries(validation).map(([p, errs]) => (
                <div key={p} className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  <strong>{p}:</strong> {errs.join(' ')}
                </div>
              ))}
            </Card>
          )}

          {/* Schedule + actions */}
          <Card className="p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Schedule for</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => action('schedule')} loading={saving}><CalendarClock className="h-4 w-4" /> Schedule</Button>
              <Button variant="secondary" onClick={() => action('publish')} loading={saving}><Send className="h-4 w-4" /> Publish now</Button>
              <Button variant="ghost" onClick={() => action('draft')} loading={saving}><Save className="h-4 w-4" /> Save draft</Button>
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Preview</h2>
          {selectedAccounts.length === 0 && <p className="text-sm text-slate-400">Select accounts to preview.</p>}
          {selectedAccounts.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-2">
                <PlatformBadge platform={a.platform} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.name}</p>
                  <p className="text-xs text-slate-400">{a.platform_label}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                {content || <span className="text-slate-400">Your post preview…</span>}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
