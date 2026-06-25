import { useState } from 'react'
import { Bot } from 'lucide-react'
import api from '../../lib/api'
import { Button, Input, Modal, Textarea } from '../ui'

const INITIAL_FORM = { name: '', description: '' }

export default function AutomationCreateModal({ categories = [], open, onClose, onCreated }) {
  const [form, setForm] = useState({ ...INITIAL_FORM, category: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const close = () => {
    setMessage('')
    onClose?.()
  }

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const { data } = await api.post('/automations', {
        name: form.name,
        description: form.description,
        config: { category: form.category || '' },
      })
      setForm({ ...INITIAL_FORM, category: '' })
      onCreated?.(data.data, form.category)
      close()
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not create automation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="New automation" description="Name the workflow now. Configure steps in the playground after creation." onClose={close} size="md">
      <form onSubmit={create} className="space-y-4 p-5">
        {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}
        <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Blog to social workflow" required />
        <Textarea label="Description" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe what this automation should do." />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Category</span>
          <select
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">No category</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!form.name.trim()}>
            <Bot className="h-4 w-4" /> Create automation
          </Button>
        </div>
      </form>
    </Modal>
  )
}
