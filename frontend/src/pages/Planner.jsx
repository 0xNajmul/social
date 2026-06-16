import { useEffect, useMemo, useState } from 'react'
import { Edit3, LayoutGrid, ListFilter, Plus, Search, Table2, Tags, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, PageLoader, ConfirmDialog } from '../components/ui'
import PlanEditorModal from '../components/planner/PlanEditorModal'

export default function Planner() {
  const [notes, setNotes] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState(() => localStorage.getItem('planner_notes_view') || 'card')
  const [planOpen, setPlanOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [categorySearch, setCategorySearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [customCategories, setCustomCategories] = useState(() => loadPlannerTerms('planner_custom_categories'))
  const [customTags, setCustomTags] = useState(() => loadPlannerTerms('planner_custom_tags'))

  const loadNotes = () => {
    api.get('/planner-notes', { params: { limit: 100 } })
      .then(({ data }) => setNotes(data.data || []))
      .catch(() => setNotes([]))
  }

  useEffect(() => {
    loadNotes()
  }, [])

  useEffect(() => {
    window.addEventListener('postflow:refresh-planner', loadNotes)
    return () => window.removeEventListener('postflow:refresh-planner', loadNotes)
  }, [])

  useEffect(() => {
    storePlannerTerms('planner_custom_categories', customCategories)
  }, [customCategories])

  useEffect(() => {
    storePlannerTerms('planner_custom_tags', customTags)
  }, [customTags])

  const openCreatePlan = () => {
    setEditingNote(null)
    setPlanOpen(true)
  }

  const openEditPlan = (note) => {
    setEditingNote(note)
    setPlanOpen(true)
  }

  const closePlan = () => {
    setPlanOpen(false)
    setEditingNote(null)
  }

  const changeView = (nextView) => {
    setView(nextView)
    localStorage.setItem('planner_notes_view', nextView)
  }

  const categoryOptions = useMemo(() => mergePlannerTerms(notes, 'categories', customCategories), [notes, customCategories])
  const tagOptions = useMemo(() => mergePlannerTerms(notes, 'tags', customTags), [notes, customTags])

  const addCustomCategory = (value) => {
    const term = cleanTerm(value)
    if (!term) return false
    setCustomCategories((current) => uniqueTerms([...current, term]))
    setSelectedCategories((current) => uniqueTerms([...current, term]))
    return true
  }

  const addCustomTag = (value) => {
    const term = cleanTerm(value)
    if (!term) return false
    setCustomTags((current) => uniqueTerms([...current, term]))
    setSelectedTags((current) => uniqueTerms([...current, term]))
    return true
  }

  const toggleCategory = (category) => {
    setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])
  }

  const toggleTag = (tag) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  const deletePlan = async () => {
    if (!confirmDelete) return
    setDeleteBusy(confirmDelete.id)
    try {
      await api.delete(`/planner-notes/${confirmDelete.id}`)
      setNotes((current) => (current || []).filter((item) => item.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (deleteError) {
      alert(deleteError.response?.data?.message || 'Could not delete this plan.')
    } finally {
      setDeleteBusy(null)
    }
  }

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (notes || []).filter((note) => {
      const categories = (note.meta?.categories || []).join(' ')
      const tags = (note.meta?.tags || []).join(' ')
      const noteCategories = (note.meta?.categories || []).map((item) => String(item).toLowerCase())
      const noteTags = (note.meta?.tags || []).map((item) => String(item).toLowerCase())
      const matchesQuery = !query || `${note.title || ''} ${note.excerpt || ''} ${note.content_text || ''} ${categories} ${tags}`.toLowerCase().includes(query)
      const matchesCategories = selectedCategories.length === 0 || selectedCategories.some((category) => noteCategories.includes(category.toLowerCase()))
      const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => noteTags.includes(tag.toLowerCase()))
      return matchesQuery && matchesCategories && matchesTags
    })
  }, [notes, search, selectedCategories, selectedTags])

  if (!notes) return <PageLoader />
  const hasActiveFilters = selectedCategories.length > 0 || selectedTags.length > 0

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
                {label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans..."
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear planner search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={openCreatePlan}><Plus className="h-4 w-4" /> Create plan</Button>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            onClick={() => setFilterOpen(true)}
            aria-label="Filter"
            title="Filter"
          >
            <ListFilter className="h-5 w-5 shrink-0" />
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filteredNotes.length ? (
          view === 'table'
            ? <PlannerNotesTable notes={filteredNotes} onEdit={openEditPlan} onDelete={setConfirmDelete} deleteBusy={deleteBusy} />
            : <PlannerNotesCards notes={filteredNotes} onEdit={openEditPlan} onDelete={setConfirmDelete} deleteBusy={deleteBusy} />
        ) : (
          <div className="p-4">
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{search || hasActiveFilters ? 'No matching plans' : 'No saved plans yet'}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{search || hasActiveFilters ? 'Try another title, note, category, or tag.' : 'Create a plan to store notes, campaign briefs, or AI-generated content.'}</p>
            </div>
          </div>
        )}
      </Card>

      {planOpen && (
        <PlanEditorModal
          key={editingNote ? `edit-${editingNote.id}` : 'create'}
          open
          note={editingNote}
          onClose={closePlan}
          onSaved={(savedNote) => {
            setNotes((current) => {
              if (editingNote) return (current || []).map((note) => note.id === editingNote.id ? savedNote : note)
              return [savedNote, ...(current || [])]
            })
          }}
        />
      )}

      <PlannerFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        categories={categoryOptions}
        tags={tagOptions}
        selectedCategories={selectedCategories}
        selectedTags={selectedTags}
        categorySearch={categorySearch}
        tagSearch={tagSearch}
        onCategorySearch={setCategorySearch}
        onTagSearch={setTagSearch}
        onToggleCategory={toggleCategory}
        onToggleTag={toggleTag}
        onAddCategory={addCustomCategory}
        onAddTag={addCustomTag}
        onResetCategories={() => setSelectedCategories([])}
        onResetTags={() => setSelectedTags([])}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete plan"
        description={`Delete "${confirmDelete?.title || 'this plan'}"? This removes the saved planner note.`}
        confirmLabel="Delete plan"
        loading={Boolean(deleteBusy)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deletePlan}
      />
    </div>
  )
}

function PlannerFilterDrawer({
  open,
  onClose,
  categories,
  tags,
  selectedCategories,
  selectedTags,
  categorySearch,
  tagSearch,
  onCategorySearch,
  onTagSearch,
  onToggleCategory,
  onToggleTag,
  onAddCategory,
  onAddTag,
  onResetCategories,
  onResetTags,
}) {
  const [tab, setTab] = useState('categories')

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  return (
    <div className={clsx('fixed inset-0 z-50 transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button
        type="button"
        className={clsx('absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        aria-label="Close planner filters"
      />
      <aside className={clsx(
        'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Planner filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create and select categories or tags for saved plans.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { key: 'categories', label: 'Categories', icon: ListFilter },
              { key: 'tags', label: 'Tags', icon: Tags },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={clsx(
                  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition',
                  tab === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'categories' ? (
            <PlannerFilterPanel
              title="Categories"
              icon={ListFilter}
              newLabel="New category"
              search={categorySearch}
              onSearch={onCategorySearch}
              placeholder="Search categories..."
              emptyText="No categories yet."
              terms={categories}
              selected={selectedCategories}
              onToggle={onToggleCategory}
              onAdd={onAddCategory}
              onReset={onResetCategories}
            />
          ) : (
            <PlannerFilterPanel
              title="Tags"
              icon={Tags}
              newLabel="New tag"
              search={tagSearch}
              onSearch={onTagSearch}
              placeholder="Search tags..."
              emptyText="No tags yet."
              terms={tags}
              selected={selectedTags}
              onToggle={onToggleTag}
              onAdd={onAddTag}
              onReset={onResetTags}
              prefix="#"
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function PlannerFilterPanel({
  title,
  icon: Icon,
  newLabel,
  search,
  onSearch,
  placeholder,
  emptyText,
  terms,
  selected,
  onToggle,
  onAdd,
  onReset,
  prefix = '',
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const visibleTerms = terms.filter((term) => term.toLowerCase().includes(search.trim().toLowerCase()))

  const submit = (event) => {
    event.preventDefault()
    if (onAdd(draft)) {
      setDraft('')
      setAdding(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{selected.length} selected</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setAdding((value) => !value)}><Plus className="h-3.5 w-3.5" /> {newLabel}</Button>
      </div>

      {adding && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">{newLabel}</span>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Add ${title === 'Categories' ? 'category' : 'tag'} name`}
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <Button type="submit" size="sm">Add</Button>
            </div>
          </label>
        </form>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label={`Clear ${title.toLowerCase()} search`}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
        {visibleTerms.map((term) => (
          <label key={term} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{prefix}{term}</span>
            <input
              type="checkbox"
              checked={selected.includes(term)}
              onChange={() => onToggle(term)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
          </label>
        ))}
        {visibleTerms.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400 dark:border-slate-800">{emptyText}</p>}
      </div>

      <div className="flex justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onReset}>Reset</Button>
        <span className="text-xs text-slate-400">{terms.length} total</span>
      </div>
    </section>
  )
}

function PlannerNotesCards({ notes, onEdit, onDelete, deleteBusy }) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      {notes.map((note) => (
        <article
          key={note.id}
          role="button"
          tabIndex={0}
          title="Open edit popup"
          onClick={() => onEdit(note)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onEdit(note)
            }
          }}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-brand-900/70 dark:hover:bg-slate-900/70"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{note.title}</h3>
            <Badge color="indigo">Note</Badge>
          </div>
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{note.excerpt || 'No preview text.'}</p>
          <CategoryList categories={note.meta?.categories} />
          <CategoryList categories={note.meta?.tags} color="violet" prefix="#" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{new Date(note.created_at).toLocaleDateString()}</p>
            <div className="flex gap-1.5">
              <PlanActionIcon tone="edit" label="Edit plan" onClick={(event) => { event.stopPropagation(); onEdit(note) }}><Edit3 className="h-3.5 w-3.5" /></PlanActionIcon>
              <PlanActionIcon tone="delete" label="Delete plan" disabled={deleteBusy === note.id} onClick={(event) => { event.stopPropagation(); onDelete(note) }}><Trash2 className="h-3.5 w-3.5" /></PlanActionIcon>
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
            <tr
              key={note.id}
              className="cursor-pointer transition hover:bg-slate-50/80 focus-within:bg-slate-50/80 dark:hover:bg-slate-800/40 dark:focus-within:bg-slate-800/40"
              onClick={() => onEdit(note)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onEdit(note)
                }
              }}
              tabIndex={0}
              title="Open edit popup"
            >
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
                  <PlanActionIcon tone="edit" label="Edit plan" onClick={(event) => { event.stopPropagation(); onEdit(note) }}><Edit3 className="h-3.5 w-3.5" /></PlanActionIcon>
                  <PlanActionIcon tone="delete" label="Delete plan" disabled={deleteBusy === note.id} onClick={(event) => { event.stopPropagation(); onDelete(note) }}><Trash2 className="h-3.5 w-3.5" /></PlanActionIcon>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CategoryList({ categories = [], color = 'sky', prefix = '' }) {
  if (!categories?.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {categories.slice(0, 4).map((category) => <Badge key={category} color={color}>{prefix}{category}</Badge>)}
      {categories.length > 4 && <Badge>+{categories.length - 4}</Badge>}
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

function mergePlannerTerms(notes, metaKey, customTerms) {
  const terms = [...customTerms]
  ;(notes || []).forEach((note) => {
    ;(note.meta?.[metaKey] || []).forEach((term) => terms.push(term))
  })

  return uniqueTerms(terms).sort((a, b) => a.localeCompare(b))
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
