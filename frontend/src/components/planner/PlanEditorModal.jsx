import { useRef, useState, useEffect } from 'react'
import { Bold, Check, Italic, List, Sparkles, Underline } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { Button, Input, Modal, Textarea } from '../ui'
import DateTimeField from '../DateTimeField'

export default function PlanEditorModal({ open, note = null, initialScheduledAt = null, onClose, onSaved }) {
  const editing = Boolean(note)
  const [form, setForm] = useState(() => initialForm(note, initialScheduledAt))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(!editing)

  const generatePlanContent = async () => {
    setAiBusy(true)
    setErrors({})
    try {
      const topic = form.ai_prompt || form.title || plainText(form.content_html) || 'Create a practical social content plan'
      const { data } = await api.post('/ai/generate', {
        type: 'caption',
        topic,
        content: plainText(form.content_html),
        tone: 'professional',
      })
      const generated = textToHtml(data.result || '')
      setForm((current) => ({
        ...current,
        content_html: current.content_html ? `${current.content_html}<p><br></p>${generated}` : generated,
      }))
    } catch (error) {
      setErrors({ ai: error.response?.data?.message || 'Could not generate AI content right now.' })
    } finally {
      setAiBusy(false)
    }
  }

  const savePlan = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const payload = {
        title: form.title,
        content_html: form.content_html,
        ai_prompt: form.ai_prompt,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        categories: splitList(form.categories),
        tags: splitList(form.tags),
      }
      const { data } = editing
        ? await api.put(`/planner-notes/${note.id}`, payload)
        : await api.post('/planner-notes', payload)

      onSaved?.(data.data)
      onClose()
    } catch (error) {
      setErrors(error.response?.data?.errors || { general: error.response?.data?.message || 'Could not save this plan.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Edit plan' : 'Create plan'}
      description={editing ? 'Update this saved plan, note, or campaign brief.' : 'Write a planning note, campaign brief, or AI-assisted draft and save it to this workspace.'}
      onClose={onClose}
      size="xl"
      fullscreenable
    >
      <form onSubmit={savePlan} className="space-y-5 p-5">
        {errors.general && <Notice type="error">{errors.general}</Notice>}
        {errors.ai && <Notice type="error">{errors.ai}</Notice>}

        <div className={clsx('grid gap-4', aiPanelOpen ? 'lg:grid-cols-[1fr_18rem]' : 'lg:grid-cols-[1fr_auto]')}>
          <div className="space-y-4">
            <Input
              label="Plan title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              error={errors.title?.[0]}
              placeholder="Launch week content plan"
              required
            />
            <Input
              label="Categories"
              value={form.categories}
              onChange={(event) => setForm({ ...form, categories: event.target.value })}
              placeholder="Campaign, Launch, Ideas"
            />
            <Input
              label="Tags"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              placeholder="Evergreen, LinkedIn, Q3"
            />
            <DateTimeField
              label="Schedule date"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })}
            />
            <RichTextEditor
              value={form.content_html}
              onChange={(content_html) => setForm({ ...form, content_html })}
              error={errors.content_html?.[0]}
            />
          </div>

          <div className={clsx('rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50', !aiPanelOpen && 'flex items-start')}>
            <button type="button" onClick={() => setAiPanelOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand-600 shadow-sm transition hover:bg-brand-50 dark:bg-slate-800 dark:text-brand-300 dark:hover:bg-slate-700">
              <Sparkles className="h-4 w-4" /> AI
            </button>
            {aiPanelOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">AI assistant</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Describe what you want and AI will add a professional draft into the editor.</p>
                </div>
                <Textarea
                  label="Prompt"
                  rows={5}
                  value={form.ai_prompt}
                  onChange={(event) => setForm({ ...form, ai_prompt: event.target.value })}
                  placeholder="Generate a 7-day content plan for our new feature launch..."
                />
                <Button type="button" variant="secondary" className="w-full" onClick={generatePlanContent} loading={aiBusy}>
                  <Sparkles className="h-4 w-4" /> Generate content
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}><Check className="h-4 w-4" /> {editing ? 'Update plan' : 'Save plan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function RichTextEditor({ value, onChange, error }) {
  const editorRef = useRef(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const run = (command) => {
    editorRef.current?.focus()
    document.execCommand(command, false, null)
    onChange(editorRef.current?.innerHTML || '')
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rich text content</span>
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800/60">
          <EditorButton label="Bold" onClick={() => run('bold')}><Bold className="h-4 w-4" /></EditorButton>
          <EditorButton label="Italic" onClick={() => run('italic')}><Italic className="h-4 w-4" /></EditorButton>
          <EditorButton label="Underline" onClick={() => run('underline')}><Underline className="h-4 w-4" /></EditorButton>
          <EditorButton label="Bulleted list" onClick={() => run('insertUnorderedList')}><List className="h-4 w-4" /></EditorButton>
        </div>
        <div
          ref={editorRef}
          contentEditable
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          className="min-h-72 px-4 py-3 text-sm leading-7 text-slate-900 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:text-slate-100"
          data-placeholder="Write your content plan, campaign notes, hooks, captions, or brief..."
          suppressContentEditableWarning
        />
      </div>
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </div>
  )
}

function EditorButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

function Notice({ type = 'success', children }) {
  return (
    <div className={clsx(
      'rounded-xl border px-4 py-3 text-sm',
      type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
    )}>
      {children}
    </div>
  )
}

function initialForm(note, initialScheduledAt) {
  return {
    title: note?.title || '',
    content_html: note?.content_html || '',
    ai_prompt: note?.meta?.ai_prompt || '',
    scheduled_at: toLocalDateTimeInput(note?.meta?.scheduled_at || initialScheduledAt || ''),
    categories: (note?.meta?.categories || []).join(', '),
    tags: (note?.meta?.tags || []).join(', '),
  }
}

function toLocalDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function plainText(html = '') {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  return doc.body.textContent?.trim() || ''
}

function textToHtml(text = '') {
  return String(text)
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

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}
