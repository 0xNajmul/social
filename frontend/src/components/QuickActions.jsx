import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot,
  Building2,
  ChevronDown,
  ClipboardList,
  ImagePlus,
  PenSquare,
  Share2,
  Sparkles,
  UserPlus,
  Workflow,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button, Card, Input, Modal, Textarea } from './ui'
import MediaDropzone from './composer/MediaDropzone'
import { ComposerContent } from '../pages/Composer'
import { currentTimezone, timezones } from '../lib/timezones'

const ACTIONS = [
  { key: 'composer', label: 'New post', description: 'Compose and publish content.', icon: PenSquare },
  { key: 'planner', label: 'New planner', description: 'Save a plan or campaign note.', icon: ClipboardList },
  { key: 'account', label: 'Connect account', description: 'Add a social profile or page.', icon: Share2 },
  { key: 'media', label: 'Upload media', description: 'Drop files into the library.', icon: ImagePlus },
  { key: 'automation', label: 'New automation', description: 'Create a repeatable workflow.', icon: Workflow },
  { key: 'workspace', label: 'New workspace', description: 'Create a separate brand space.', icon: Building2 },
  { key: 'team', label: 'New team invite', description: 'Invite a collaborator.', icon: UserPlus },
]

export default function QuickActions() {
  const navigate = useNavigate()
  const { reload, switchWorkspace } = useAuth()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const openFromPage = (event) => setActive(event.detail || { type: 'composer' })

    document.addEventListener('mousedown', close)
    window.addEventListener('postflow:quick-action', openFromPage)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('postflow:quick-action', openFromPage)
    }
  }, [])

  const choose = (type) => {
    setActive({ type })
    setOpen(false)
  }

  const closeModal = () => setActive(null)
  const modalType = active?.type

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
          <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800" role="menu">
            {ACTIONS.map(({ key, label, description, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => choose(key)}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700"
                role="menuitem"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalType === 'composer'} title="New post" description="Compose a post without leaving this page." onClose={closeModal} size="xl">
        <div className="p-5">
          <ComposerContent modal initialScheduledAt={active?.scheduledAt} onDone={closeModal} />
        </div>
      </Modal>

      <Modal open={modalType === 'planner'} title="New planner" description="Save a quick plan or note into Planner." onClose={closeModal} size="lg">
        <PlannerQuickForm onDone={closeModal} />
      </Modal>

      <Modal open={modalType === 'account'} title="Connect account" description="Open the account connector from anywhere." onClose={closeModal} size="md">
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Choose the platform and OAuth settings from the Accounts page. This keeps secure account connection flows in one place.</p>
          <Button className="w-full" onClick={() => { closeModal(); navigate('/app/accounts') }}><Share2 className="h-4 w-4" /> Go to accounts</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'media'} title="Upload media" description="Drop one or more files into your media library." onClose={closeModal} size="lg">
        <MediaUploadQuickForm onDone={closeModal} />
      </Modal>

      <Modal open={modalType === 'automation'} title="New automation" description="Create an RSS or evergreen automation." onClose={closeModal} size="lg">
        <AutomationQuickForm onDone={closeModal} />
      </Modal>

      <Modal open={modalType === 'workspace'} title="New workspace" description="Create a separate workspace for a brand or team." onClose={closeModal} size="lg">
        <WorkspaceQuickForm onDone={closeModal} reload={reload} switchWorkspace={switchWorkspace} />
      </Modal>

      <Modal open={modalType === 'team'} title="Invite team member" description="Send an invitation without leaving this page." onClose={closeModal} size="lg">
        <TeamQuickForm onDone={closeModal} />
      </Modal>
    </>
  )
}

function PlannerQuickForm({ onDone }) {
  const [form, setForm] = useState({ title: '', content: '' })
  const [busy, setBusy] = useState(false)

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/planner-notes', {
        title: form.title,
        content_html: textToHtml(form.content),
      })
      onDone()
      window.dispatchEvent(new CustomEvent('postflow:refresh-planner'))
    } catch (error) {
      alert(error.response?.data?.message || 'Could not create planner note.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 p-5">
      <Input label="Plan title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required placeholder="Launch plan" />
      <Textarea label="Plan content" rows={7} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required placeholder="Notes, brief, hooks, campaign ideas..." />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}><ClipboardList className="h-4 w-4" /> Save planner</Button>
      </div>
    </form>
  )
}

function MediaUploadQuickForm({ onDone }) {
  const [items, setItems] = useState([])
  const uploading = items.some((item) => item.uploading)

  return (
    <div className="space-y-4 p-5">
      <MediaDropzone items={items} onChange={setItems} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button onClick={onDone} disabled={uploading}>{uploading ? 'Uploading...' : 'Done'}</Button>
      </div>
    </div>
  )
}

function WorkspaceQuickForm({ onDone, reload, switchWorkspace }) {
  const [form, setForm] = useState({ name: '', timezone: currentTimezone() })
  const [busy, setBusy] = useState(false)

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/workspaces', form)
      workspaceStore.set(data.data.slug)
      await reload()
      await switchWorkspace(data.data.slug)
      onDone()
    } catch (error) {
      alert(error.response?.data?.message || 'Could not create workspace.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 p-5">
      <Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Northstar Studio" />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</span>
        <select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
        </select>
      </label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}><Building2 className="h-4 w-4" /> Create workspace</Button>
      </div>
    </form>
  )
}

function TeamQuickForm({ onDone }) {
  const [form, setForm] = useState({ email: '', role: 'editor' })
  const [busy, setBusy] = useState(false)

  const invite = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/team/invite', form)
      onDone()
    } catch (error) {
      alert(error.response?.data?.message || 'Could not send invitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={invite} className="space-y-4 p-5">
      <Input label="Email address" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required placeholder="teammate@company.com" />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {['admin', 'manager', 'editor', 'viewer'].map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}><UserPlus className="h-4 w-4" /> Send invite</Button>
      </div>
    </form>
  )
}

function AutomationQuickForm({ onDone }) {
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ name: '', type: 'rss_feed', feed_url: '', use_ai: true, account_ids: [] })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/social/accounts').then(({ data }) => setAccounts(data.data || [])).catch(() => setAccounts([]))
  }, [])

  const toggleAccount = (id) => setForm((current) => ({
    ...current,
    account_ids: current.account_ids.includes(id) ? current.account_ids.filter((item) => item !== id) : [...current.account_ids, id],
  }))

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post('/automations', {
        name: form.name,
        type: form.type,
        social_account_ids: form.account_ids,
        use_ai: form.use_ai,
        feed_urls: form.feed_url ? [form.feed_url] : [],
        config: { interval_minutes: 60 },
      })
      onDone()
    } catch (error) {
      alert(error.response?.data?.message || 'Could not create automation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={create} className="space-y-4 p-5">
      <Input label="Automation name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Blog to social" />
      <Input label="RSS feed URL" value={form.feed_url} onChange={(event) => setForm({ ...form, feed_url: event.target.value })} placeholder="https://example.com/feed" />
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Post to</span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => toggleAccount(account.id)}
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-xs transition',
                form.account_ids.includes(account.id) ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
              )}
            >
              {account.name}
            </button>
          ))}
          {accounts.length === 0 && <span className="text-xs text-slate-400">Connect an account first.</span>}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={form.use_ai} onChange={(event) => setForm({ ...form, use_ai: event.target.checked })} />
        Enhance with AI
      </label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy} disabled={!form.name || form.account_ids.length === 0}><Bot className="h-4 w-4" /> Create automation</Button>
      </div>
    </form>
  )
}

function textToHtml(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
