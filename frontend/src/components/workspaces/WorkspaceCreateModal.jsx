import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import api, { workspaceStore } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, Modal, Textarea } from '../ui'

export default function WorkspaceCreateModal({
  open,
  title = 'Create workspace',
  description = 'A separate workspace gets its own members, accounts, posts, and brand settings.',
  canCancel = true,
  onClose,
  onCreated,
}) {
  const { reload } = useAuth()
  const [form, setForm] = useState({ name: '', description: '' })
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
      setForm({ name: '', description: '' })
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
        <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="A short note about this brand, client, or team." />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {canCancel && <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>}
          <Button type="submit" loading={busy}><Sparkles className="h-4 w-4" /> Create workspace</Button>
        </div>
      </form>
    </Modal>
  )
}
