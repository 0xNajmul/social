import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import api, { workspaceStore } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Modal } from '../ui'
import { currentTimezone, timezoneLabel, timezones } from '../../lib/timezones'

export default function WorkspaceCreateModal({
  open,
  title = 'Create workspace',
  description = 'A separate workspace gets its own members, accounts, posts, and plan usage.',
  canCancel = true,
  onClose,
  onCreated,
}) {
  const { reload } = useAuth()
  const [form, setForm] = useState({ name: '', timezone: currentTimezone() })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const createWorkspace = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const { data } = await api.post('/workspaces', form)
      workspaceStore.set(data.data.slug)
      await api.post(`/workspaces/${data.data.slug}/switch`)
      await reload()
      setForm({ name: '', timezone: currentTimezone() })
      onCreated?.(data.data)
      onClose?.()
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not create the workspace.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={title} description={description} onClose={canCancel ? onClose : () => {}} size="lg">
      <form onSubmit={createWorkspace} className="space-y-4 p-5">
        {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}
        <Input label="Workspace name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Northstar Studio" required />
        <TimezoneSelect value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {canCancel && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
          <Button type="submit" loading={busy}><Sparkles className="h-4 w-4" /> Create workspace</Button>
        </div>
      </form>
    </Modal>
  )
}

function TimezoneSelect({ value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" required>
        {timezones().map((timezone) => <option key={timezone} value={timezone}>{timezoneLabel(timezone)}</option>)}
      </select>
    </label>
  )
}
