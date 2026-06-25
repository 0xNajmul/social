import { useRef, useState, useEffect } from 'react'
import { Bold, Check, FolderOpen, Italic, List, Sparkles, Tags, Underline } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { Button, Input, Modal, Textarea } from '../ui'
import DateTimeField from '../DateTimeField'
import TermPickerField from '../TermPickerField'
import MediaDropzone from '../composer/MediaDropzone'
import MediaLibraryPicker from '../composer/MediaLibraryPicker'
import { normalizeAccounts } from '../../lib/accounts'
import { broadcastDataChanged } from '../../lib/appEvents'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '../../lib/datetime'

export default function PlanEditorModal({ open, note = null, initialScheduledAt = null, onClose, onSaved, onDirtyChange }) {
  const editing = Boolean(note)
  const initialSnapshot = useRef(JSON.stringify(initialForm(note, initialScheduledAt)))
  const [form, setForm] = useState(() => initialForm(note, initialScheduledAt))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [termPickerOpen, setTermPickerOpen] = useState(null)
  const [customCategories, setCustomCategories] = useState(() => loadPlannerTerms('planner_custom_categories'))
  const [customTags, setCustomTags] = useState(() => loadPlannerTerms('planner_custom_tags'))
  const [tagColors, setTagColors] = useState(() => loadTermColors('planner_tag_colors'))
  const [accounts, setAccounts] = useState([])
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(form) !== initialSnapshot.current)
  }, [form, onDirtyChange])

  useEffect(() => {
    storePlannerTerms('planner_custom_categories', customCategories)
  }, [customCategories])

  useEffect(() => {
    storePlannerTerms('planner_custom_tags', customTags)
  }, [customTags])

  useEffect(() => {
    storeTermColors('planner_tag_colors', tagColors)
  }, [tagColors])

  useEffect(() => {
    let mounted = true
    api.get('/social/accounts')
      .then(({ data }) => {
        if (mounted) setAccounts(normalizeAccounts((data.data || []).filter((account) => account.status === 'active')))
      })
      .catch(() => {
        if (mounted) setAccounts([])
      })
    return () => {
      mounted = false
    }
  }, [])

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

  const updateMedia = (next) => {
    setForm((current) => ({
      ...current,
      media: typeof next === 'function' ? next(current.media || []) : next,
    }))
  }

  const savePlan = async (event) => {
    event.preventDefault()
    const mediaUploading = (form.media || []).some((item) => item.uploading)
    if (mediaUploading) {
      setErrors({ general: 'Please wait for media uploads to finish.' })
      return
    }

    setBusy(true)
    setErrors({})
    try {
      const payload = {
        title: form.title,
        content_html: form.content_html,
        ai_prompt: form.ai_prompt,
        scheduled_at: fromLocalDateTimeInput(form.scheduled_at),
        social_account_id: form.social_account_id ? Number(form.social_account_id) : null,
        categories: splitList(form.categories),
        tags: splitList(form.tags),
        tag_colors: pickTermColors(splitList(form.tags), tagColors),
        media_ids: (form.media || []).filter((item) => typeof item.id === 'number').map((item) => item.id),
        media: summarizeMedia(form.media),
      }
      const { data } = editing
        ? await api.put(`/planner-notes/${note.id}`, payload)
        : await api.post('/planner-notes', payload)

      broadcastDataChanged({ resource: 'planner-notes', action: editing ? 'updated' : 'created', item: data.data })
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
      headerActions={(
        <button
          type="button"
          onClick={() => setAiPanelOpen((value) => !value)}
          className={clsx(
            'rounded-lg p-2 transition',
            aiPanelOpen
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white',
          )}
          aria-label={aiPanelOpen ? 'Hide AI assistant' : 'Show AI assistant'}
          aria-pressed={aiPanelOpen}
          title={aiPanelOpen ? 'Hide AI assistant' : 'Show AI assistant'}
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    >
      <form onSubmit={savePlan} className="space-y-5 p-5">
        {errors.general && <Notice type="error">{errors.general}</Notice>}
        {errors.ai && <Notice type="error">{errors.ai}</Notice>}

        <div className={clsx('grid gap-4 transition-[grid-template-columns] duration-500 ease-out', aiPanelOpen ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : 'lg:grid-cols-[minmax(0,1fr)_0rem]')}>
          <div className="space-y-4">
            <Input
              label="Plan title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              error={errors.title?.[0]}
              placeholder="Launch week content plan"
              required
            />
            <RichTextEditor
              value={form.content_html}
              onChange={(content_html) => setForm({ ...form, content_html })}
              error={errors.content_html?.[0]}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Media</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload image or file references for this plan.</p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => setLibraryOpen(true)} disabled={busy}>
                  <FolderOpen className="h-3.5 w-3.5" /> Grab from library
                </Button>
              </div>
              <MediaDropzone items={form.media || []} onChange={updateMedia} disabled={busy} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TermPickerField
                label="Categories"
                icon={List}
                open={termPickerOpen === 'categories'}
                onOpen={() => setTermPickerOpen((current) => current === 'categories' ? null : 'categories')}
                onClose={() => setTermPickerOpen(null)}
                selected={splitList(form.categories)}
                terms={uniqueTerms([...customCategories, ...splitList(form.categories)])}
                onChange={(terms) => setForm({ ...form, categories: terms.join(', ') })}
                onAdd={(term) => setCustomCategories((current) => uniqueTerms([...current, term]))}
                onDelete={(term) => {
                  setCustomCategories((current) => current.filter((item) => item !== term))
                  setForm((current) => ({ ...current, categories: splitList(current.categories).filter((item) => item !== term).join(', ') }))
                }}
                placeholder="Select or add categories"
              />
              <TermPickerField
                label="Tags"
                icon={Tags}
                prefix="#"
                open={termPickerOpen === 'tags'}
                onOpen={() => setTermPickerOpen((current) => current === 'tags' ? null : 'tags')}
                onClose={() => setTermPickerOpen(null)}
                selected={splitList(form.tags)}
                terms={uniqueTerms([...customTags, ...splitList(form.tags)])}
                termColors={tagColors}
                onChange={(terms) => setForm({ ...form, tags: terms.join(', ') })}
                onAdd={(term) => setCustomTags((current) => uniqueTerms([...current, term]))}
                onDelete={(term) => {
                  setCustomTags((current) => current.filter((item) => item !== term))
                  setForm((current) => ({ ...current, tags: splitList(current.tags).filter((item) => item !== term).join(', ') }))
                  setTagColors((current) => {
                    const next = { ...current }
                    delete next[term]
                    return next
                  })
                }}
                onColorChange={(term, color) => setTagColors((current) => ({ ...current, [term]: color }))}
                placeholder="Select or add tags"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Connected channel</span>
                <select
                  value={form.social_account_id}
                  onChange={(event) => setForm({ ...form, social_account_id: event.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">No specific channel</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name} ({account.platform_label || account.platform})</option>
                  ))}
                </select>
              </label>
              <DateTimeField
                label="Schedule date"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })}
              />
            </div>
          </div>

          <aside
            className={clsx(
              'min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition-all duration-500 ease-out dark:border-slate-800 dark:bg-slate-950/50',
              aiPanelOpen
                ? 'max-h-[42rem] translate-x-0 p-3 opacity-100'
                : 'pointer-events-none max-h-0 translate-x-8 border-transparent p-0 opacity-0 lg:max-h-none',
            )}
            aria-hidden={!aiPanelOpen}
          >
            <div className="space-y-3">
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
          </aside>
        </div>

        <div className="sticky bottom-0 z-30 -mx-5 -mb-5 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={(form.media || []).some((item) => item.uploading)}><Check className="h-4 w-4" /> {editing ? 'Update plan' : 'Save plan'}</Button>
        </div>
        <MediaLibraryPicker
          open={libraryOpen}
          existingIds={(form.media || []).filter((item) => typeof item.id === 'number').map((item) => item.id)}
          onClose={() => setLibraryOpen(false)}
          onAdd={(assets) => {
            updateMedia((current) => {
              const existing = new Set((current || []).map((item) => item.id))
              return [...(current || []), ...assets.filter((asset) => !existing.has(asset.id))]
            })
          }}
        />
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

  const pasteCleanContent = (event) => {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') || ''
    if (!text.trim()) return
    document.execCommand('insertHTML', false, textToHtml(text))
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
          onPaste={pasteCleanContent}
          className="min-h-72 break-words px-4 py-3 text-left text-sm leading-7 text-slate-900 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] dark:text-slate-100 [&_*]:max-w-full [&_*]:break-words [&_*]:text-left"
          data-placeholder="Write your content plan, campaign notes, hooks, captions, or brief..."
          dir="ltr"
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
    social_account_id: note?.meta?.social_account_id || '',
    categories: (note?.meta?.categories || []).join(', '),
    tags: (note?.meta?.tags || []).join(', '),
    media: Array.isArray(note?.meta?.media) ? note.meta.media : [],
  }
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

function loadPlannerTerms(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? uniqueTerms(value) : []
  } catch {
    return []
  }
}

function storePlannerTerms(key, terms) {
  localStorage.setItem(key, JSON.stringify(uniqueTerms(terms)))
}

function loadTermColors(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function storeTermColors(key, colors) {
  localStorage.setItem(key, JSON.stringify(colors || {}))
}

function pickTermColors(terms, colors) {
  return (terms || []).reduce((picked, term) => {
    if (colors?.[term]) picked[term] = colors[term]
    return picked
  }, {})
}

function summarizeMedia(items = []) {
  return (items || [])
    .filter((item) => !item.uploading)
    .map((item) => ({
      id: item.id,
      original_name: item.original_name,
      type: item.type,
      mime_type: item.mime_type,
      url: item.url,
      thumbnail_url: item.thumbnail_url,
      alt_text: item.alt_text,
    }))
}

function uniqueTerms(terms) {
  const seen = new Set()
  return (terms || []).reduce((items, value) => {
    const term = cleanTerm(value)
    const key = term.toLowerCase()
    if (!term || seen.has(key)) return items
    seen.add(key)
    return [...items, term]
  }, [])
}

function cleanTerm(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}
