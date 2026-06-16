import { useEffect, useRef, useState } from 'react'
import { Bold, Check, Edit3, Italic, LayoutGrid, List, Plus, Sparkles, Table2, Trash2, Underline } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader, Textarea } from '../components/ui'

export default function Planner() {
  const [notes, setNotes] = useState(null)
  const [view, setView] = useState(() => localStorage.getItem('planner_notes_view') || 'card')
  const [planOpen, setPlanOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [planForm, setPlanForm] = useState({ title: '', content_html: '', ai_prompt: '' })
  const [planErrors, setPlanErrors] = useState({})
  const [planBusy, setPlanBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)

  const loadNotes = () => {
    api.get('/planner-notes', { params: { limit: 24 } })
      .then(({ data }) => setNotes(data.data || []))
      .catch(() => setNotes([]))
  }

  useEffect(() => {
    loadNotes()
  }, [])

  const openCreatePlan = () => {
    setEditingNote(null)
    setPlanForm({ title: '', content_html: '', ai_prompt: '' })
    setPlanErrors({})
    setPlanOpen(true)
  }

  const openEditPlan = (note) => {
    setEditingNote(note)
    setPlanForm({
      title: note.title || '',
      content_html: note.content_html || '',
      ai_prompt: note.meta?.ai_prompt || '',
    })
    setPlanErrors({})
    setPlanOpen(true)
  }

  const closePlan = () => {
    setPlanOpen(false)
    setEditingNote(null)
    setPlanErrors({})
  }

  const changeView = (nextView) => {
    setView(nextView)
    localStorage.setItem('planner_notes_view', nextView)
  }

  const generatePlanContent = async () => {
    setAiBusy(true)
    setPlanErrors({})
    try {
      const topic = planForm.ai_prompt || planForm.title || plainText(planForm.content_html) || 'Create a practical social content plan'
      const { data } = await api.post('/ai/generate', {
        type: 'caption',
        topic,
        content: plainText(planForm.content_html),
        tone: 'professional',
      })
      const generated = textToHtml(data.result || '')
      setPlanForm((current) => ({
        ...current,
        content_html: current.content_html ? `${current.content_html}<p><br></p>${generated}` : generated,
      }))
    } catch (aiError) {
      setPlanErrors({ ai: aiError.response?.data?.message || 'Could not generate AI content right now.' })
    } finally {
      setAiBusy(false)
    }
  }

  const savePlan = async (event) => {
    event.preventDefault()
    setPlanBusy(true)
    setPlanErrors({})
    try {
      const payload = {
        title: planForm.title,
        content_html: planForm.content_html,
        ai_prompt: planForm.ai_prompt,
      }
      const { data } = editingNote
        ? await api.put(`/planner-notes/${editingNote.id}`, payload)
        : await api.post('/planner-notes', payload)
      setNotes((current) => {
        if (editingNote) return (current || []).map((note) => note.id === editingNote.id ? data.data : note)
        return [data.data, ...(current || [])]
      })
      closePlan()
    } catch (saveError) {
      setPlanErrors(saveError.response?.data?.errors || { general: saveError.response?.data?.message || 'Could not save this plan.' })
    } finally {
      setPlanBusy(false)
    }
  }

  const deletePlan = async (note) => {
    if (!window.confirm(`Delete "${note.title}"?`)) return
    setDeleteBusy(note.id)
    try {
      await api.delete(`/planner-notes/${note.id}`)
      setNotes((current) => (current || []).filter((item) => item.id !== note.id))
    } catch (deleteError) {
      alert(deleteError.response?.data?.message || 'Could not delete this plan.')
    } finally {
      setDeleteBusy(null)
    }
  }

  if (!notes) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planner</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track ideas, briefs, AI drafts, and reusable content plans.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { key: 'table', label: 'Table', icon: Table2 },
              { key: 'card', label: 'Card', icon: LayoutGrid },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => changeView(key)}
                className={clsx(
                  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  view === key
                    ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {label} view
              </button>
            ))}
          </div>
          <Button onClick={openCreatePlan}><Plus className="h-4 w-4" /> Create plan</Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {notes.length ? (
          view === 'table'
            ? <PlannerNotesTable notes={notes} onEdit={openEditPlan} onDelete={deletePlan} deleteBusy={deleteBusy} />
            : <PlannerNotesCards notes={notes} onEdit={openEditPlan} onDelete={deletePlan} deleteBusy={deleteBusy} />
        ) : (
          <div className="p-4">
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">No saved plans yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create a plan to store notes, campaign briefs, or AI-generated content.</p>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={planOpen}
        title={editingNote ? 'Edit plan' : 'Create plan'}
        description={editingNote ? 'Update this saved plan, note, or campaign brief.' : 'Write a planning note, campaign brief, or AI-assisted draft and save it to this workspace.'}
        onClose={closePlan}
        size="xl"
        fullscreenable
      >
        <form onSubmit={savePlan} className="space-y-5 p-5">
          {planErrors.general && <Notice type="error">{planErrors.general}</Notice>}
          {planErrors.ai && <Notice type="error">{planErrors.ai}</Notice>}

          <Input
            label="Plan title"
            value={planForm.title}
            onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })}
            error={planErrors.title?.[0]}
            placeholder="Launch week content plan"
            required
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <RichTextEditor
              value={planForm.content_html}
              onChange={(content_html) => setPlanForm({ ...planForm, content_html })}
              error={planErrors.content_html?.[0]}
            />
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">AI assistant</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Describe what you want and AI will add a professional draft into the editor.</p>
              </div>
              <Textarea
                label="Prompt"
                rows={5}
                value={planForm.ai_prompt}
                onChange={(event) => setPlanForm({ ...planForm, ai_prompt: event.target.value })}
                placeholder="Generate a 7-day content plan for our new feature launch..."
              />
              <Button type="button" variant="secondary" className="w-full" onClick={generatePlanContent} loading={aiBusy}>
                <Sparkles className="h-4 w-4" /> Generate content
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={closePlan}>Cancel</Button>
            <Button type="submit" loading={planBusy}><Check className="h-4 w-4" /> {editingNote ? 'Update plan' : 'Save plan'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function PlannerNotesCards({ notes, onEdit, onDelete, deleteBusy }) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      {notes.map((note) => (
        <article key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{note.title}</h3>
            <Badge color="indigo">Note</Badge>
          </div>
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{note.excerpt || 'No preview text.'}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{new Date(note.created_at).toLocaleDateString()}</p>
            <div className="flex gap-1.5">
              <PlanActionIcon tone="edit" label="Edit plan" onClick={() => onEdit(note)}><Edit3 className="h-3.5 w-3.5" /></PlanActionIcon>
              <PlanActionIcon tone="delete" label="Delete plan" disabled={deleteBusy === note.id} onClick={() => onDelete(note)}><Trash2 className="h-3.5 w-3.5" /></PlanActionIcon>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function PlannerNotesTable({ notes, onEdit, onDelete, deleteBusy }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Plan</th>
            <th className="px-5 py-3 font-semibold">Preview</th>
            <th className="px-5 py-3 font-semibold">Owner</th>
            <th className="px-5 py-3 font-semibold">Created</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {notes.map((note) => (
            <tr key={note.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <Badge color="indigo">Note</Badge>
                  <span className="font-semibold text-slate-900 dark:text-white">{note.title}</span>
                </div>
              </td>
              <td className="max-w-md px-5 py-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{note.excerpt || 'No preview text.'}</td>
              <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{note.author?.name || 'Unknown'}</td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{new Date(note.created_at).toLocaleDateString()}</td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-1.5">
                  <PlanActionIcon tone="edit" label="Edit plan" onClick={() => onEdit(note)}><Edit3 className="h-3.5 w-3.5" /></PlanActionIcon>
                  <PlanActionIcon tone="delete" label="Delete plan" disabled={deleteBusy === note.id} onClick={() => onDelete(note)}><Trash2 className="h-3.5 w-3.5" /></PlanActionIcon>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlanActionIcon({ tone, label, children, ...props }) {
  const tones = {
    edit: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/70',
    delete: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/70 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-600',
  }

  return (
    <button
      type="button"
      className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60', tones[tone])}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
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
