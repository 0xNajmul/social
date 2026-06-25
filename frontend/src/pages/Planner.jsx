import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Edit3, Image as ImageIcon, LayoutGrid, List, ListFilter, Plus, Search, Table2, Tags, Trash2, UserRound, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, PageLoader, ConfirmDialog } from '../components/ui'
import PlanEditorModal from '../components/planner/PlanEditorModal'
import { DATA_CHANGED_EVENT, broadcastDataChanged } from '../lib/appEvents'
import { mediaUrl } from '../lib/media'
import useInfiniteList from '../hooks/useInfiniteList'

const PLANNER_SORT_OPTIONS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['updated', 'Recently updated'],
  ['title_asc', 'Title A-Z'],
  ['title_desc', 'Title Z-A'],
]

export default function Planner() {
  const [notes, setNotes] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState(() => localStorage.getItem('planner_notes_view') || 'card')
  const [planOpen, setPlanOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [quickFilter, setQuickFilter] = useState(null)
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('planner_sort_order') || 'newest')
  const [categorySearch, setCategorySearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [customCategories, setCustomCategories] = useState(() => loadPlannerTerms('planner_custom_categories'))
  const [customTags, setCustomTags] = useState(() => loadPlannerTerms('planner_custom_tags'))
  const [deletedCategories, setDeletedCategories] = useState(() => loadPlannerTerms('planner_deleted_categories'))
  const [deletedTags, setDeletedTags] = useState(() => loadPlannerTerms('planner_deleted_tags'))
  const quickFilterRef = useRef(null)

  const loadNotes = useCallback(() => {
    api.get('/planner-notes', { params: { limit: 100 } })
      .then(({ data }) => setNotes(data.data || []))
      .catch(() => setNotes([]))
  }, [])

  useEffect(() => {
    loadNotes()
    const interval = window.setInterval(loadNotes, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, loadNotes)
    window.addEventListener('postflow:refresh-planner', loadNotes)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, loadNotes)
      window.removeEventListener('postflow:refresh-planner', loadNotes)
    }
  }, [loadNotes])

  useEffect(() => {
    storePlannerTerms('planner_custom_categories', customCategories)
  }, [customCategories])

  useEffect(() => {
    storePlannerTerms('planner_custom_tags', customTags)
  }, [customTags])

  useEffect(() => {
    storePlannerTerms('planner_deleted_categories', deletedCategories)
  }, [deletedCategories])

  useEffect(() => {
    storePlannerTerms('planner_deleted_tags', deletedTags)
  }, [deletedTags])

  useEffect(() => {
    localStorage.setItem('planner_sort_order', sortOrder)
  }, [sortOrder])

  useEffect(() => {
    if (!quickFilter) return undefined

    const closeQuickFilter = (event) => {
      if (quickFilterRef.current?.contains(event.target)) return
      setQuickFilter(null)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setQuickFilter(null)
    }

    document.addEventListener('mousedown', closeQuickFilter)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeQuickFilter)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [quickFilter])

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

  const categoryOptions = useMemo(() => mergePlannerTerms(notes, 'categories', customCategories).filter((term) => !deletedCategories.includes(term)), [deletedCategories, notes, customCategories])
  const tagOptions = useMemo(() => mergePlannerTerms(notes, 'tags', customTags).filter((term) => !deletedTags.includes(term)), [deletedTags, notes, customTags])

  const addCustomCategory = (value) => {
    const term = cleanTerm(value)
    if (!term) return false
    setCustomCategories((current) => uniqueTerms([...current, term]))
    setDeletedCategories((current) => current.filter((item) => item !== term))
    return true
  }

  const addCustomTag = (value) => {
    const term = cleanTerm(value)
    if (!term) return false
    setCustomTags((current) => uniqueTerms([...current, term]))
    setDeletedTags((current) => current.filter((item) => item !== term))
    return true
  }

  const deleteCategoryTerm = (term) => {
    setCustomCategories((current) => current.filter((item) => item !== term))
    setSelectedCategories((current) => current.filter((item) => item !== term))
    setDeletedCategories((current) => uniqueTerms([...current, term]))
  }

  const deleteTagTerm = (term) => {
    setCustomTags((current) => current.filter((item) => item !== term))
    setSelectedTags((current) => current.filter((item) => item !== term))
    setDeletedTags((current) => uniqueTerms([...current, term]))
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
      broadcastDataChanged({ resource: 'planner-notes', action: 'deleted', item: confirmDelete })
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
    }).sort((a, b) => comparePlannerNotes(a, b, sortOrder))
  }, [notes, search, selectedCategories, selectedTags, sortOrder])

  const hasActiveFilters = selectedCategories.length > 0 || selectedTags.length > 0
  const { hasMore, items: pagedNotes, sentinelRef } = useInfiniteList(filteredNotes)

  if (!notes) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planner</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track ideas, briefs, AI drafts, and reusable content plans.</p>
        </div>
        <Button onClick={openCreatePlan}><Plus className="h-4 w-4" /> Create plan</Button>
      </div>

      <Card className="overflow-visible">
        <div className="relative z-20 flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plans, categories, tags..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear planner search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className="h-11 min-w-40 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Sort plans"
            >
              {PLANNER_SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

            <div ref={quickFilterRef} className="relative inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              <ToolbarIconButton
                active={selectedCategories.length > 0 || quickFilter === 'categories'}
                onClick={() => setQuickFilter((current) => current === 'categories' ? null : 'categories')}
                icon={List}
                label="Categories"
              />
              <ToolbarIconButton
                active={selectedTags.length > 0 || quickFilter === 'tags'}
                onClick={() => setQuickFilter((current) => current === 'tags' ? null : 'tags')}
                icon={Tags}
                label="Tags"
              />
              <QuickTermPopover
                open={quickFilter === 'categories'}
                title="Categories"
                icon={List}
                newLabel="New category"
                search={categorySearch}
                onSearch={setCategorySearch}
                placeholder="Search categories..."
                emptyText="No categories yet."
                terms={categoryOptions}
                selected={selectedCategories}
                onToggle={toggleCategory}
                onAdd={addCustomCategory}
                onDelete={deleteCategoryTerm}
                onReset={() => setSelectedCategories([])}
                onClose={() => setQuickFilter(null)}
              />
              <QuickTermPopover
                open={quickFilter === 'tags'}
                title="Tags"
                icon={Tags}
                newLabel="New tag"
                search={tagSearch}
                onSearch={setTagSearch}
                placeholder="Search tags..."
                emptyText="No tags yet."
                terms={tagOptions}
                selected={selectedTags}
                onToggle={toggleTag}
                onAdd={addCustomTag}
                onDelete={deleteTagTerm}
                onReset={() => setSelectedTags([])}
                onClose={() => setQuickFilter(null)}
                prefix="#"
              />
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              <ToolbarIconButton active={view === 'card'} onClick={() => changeView('card')} icon={LayoutGrid} label="Card view" />
              <ToolbarIconButton active={view === 'table'} onClick={() => changeView('table')} icon={Table2} label="Table view" />
              <ToolbarIconButton active={hasActiveFilters} onClick={() => setFilterOpen(true)} icon={ListFilter} label="Filters" />
            </div>
          </div>
        </div>
        {filteredNotes.length ? (
          view === 'table'
            ? <PlannerNotesTable notes={pagedNotes} onEdit={openEditPlan} onDelete={setConfirmDelete} deleteBusy={deleteBusy} />
            : <PlannerNotesCards notes={pagedNotes} onEdit={openEditPlan} onDelete={setConfirmDelete} deleteBusy={deleteBusy} />
        ) : (
          <div className="p-4">
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{search || hasActiveFilters ? 'No matching plans' : 'No saved plans yet'}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{search || hasActiveFilters ? 'Try another title, note, category, or tag.' : 'Create a plan to store notes, campaign briefs, or AI-generated content.'}</p>
            </div>
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="px-4 pb-5 text-center text-xs font-semibold text-slate-400">Loading more plans...</div>}
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
        onDeleteCategory={deleteCategoryTerm}
        onDeleteTag={deleteTagTerm}
        onResetCategories={() => setSelectedCategories([])}
        onResetTags={() => setSelectedTags([])}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
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
  onDeleteCategory,
  onDeleteTag,
  onResetCategories,
  onResetTags,
  sortOrder,
  onSortOrderChange,
}) {
  const [openSections, setOpenSections] = useState(() => loadFilterSections())

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  useEffect(() => {
    localStorage.setItem('planner_filter_sections', JSON.stringify(openSections))
  }, [openSections])

  const toggleSection = (key) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className={clsx('fixed inset-0 z-[220] transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
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

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <FilterAccordionCard
            title="Sorting"
            description="Control the order of plans in table and card views."
            icon={Table2}
            open={openSections.sort}
            onToggle={() => toggleSection('sort')}
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Sort order</span>
              <select
                value={sortOrder}
                onChange={(event) => onSortOrderChange(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {PLANNER_SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </FilterAccordionCard>

          <FilterAccordionCard
            title="Categories"
            description={`${selectedCategories.length} selected`}
            icon={ListFilter}
            open={openSections.categories}
            onToggle={() => toggleSection('categories')}
          >
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
              onDelete={onDeleteCategory}
              onReset={onResetCategories}
            />
          </FilterAccordionCard>

          <FilterAccordionCard
            title="Tags"
            description={`${selectedTags.length} selected`}
            icon={Tags}
            open={openSections.tags}
            onToggle={() => toggleSection('tags')}
          >
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
              onDelete={onDeleteTag}
              onReset={onResetTags}
              prefix="#"
            />
          </FilterAccordionCard>
        </div>
      </aside>
    </div>
  )
}

function ToolbarIconButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx(
        'rounded-lg p-2 transition',
        active
          ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function QuickTermPopover({ open, title, icon, newLabel, search, onSearch, placeholder, emptyText, terms, selected, onToggle, onAdd, onDelete, onReset, onClose, prefix = '' }) {
  return (
    <div
      className={clsx(
        'fixed inset-0 z-[230] origin-top-right overflow-y-auto rounded-none border-0 border-slate-200 bg-white p-4 shadow-2xl transition duration-200 dark:border-slate-800 dark:bg-slate-900 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:z-[150] sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))] sm:rounded-2xl sm:border',
        open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
      )}
    >
      <PlannerFilterPanel
        title={title}
        icon={icon}
        newLabel={newLabel}
        search={search}
        onSearch={onSearch}
        placeholder={placeholder}
        emptyText={emptyText}
        terms={terms}
        selected={selected}
        onToggle={onToggle}
        onAdd={onAdd}
        onDelete={onDelete}
        onReset={onReset}
        onClose={onClose}
        prefix={prefix}
      />
    </div>
  )
}

function FilterAccordionCard({ title, description, icon: Icon, open, onToggle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{description}</span>
          </span>
        </span>
        <X className={clsx('h-4 w-4 shrink-0 text-slate-400 transition', open ? 'rotate-45' : 'rotate-0')} />
      </button>
      {open && <div className="border-t border-slate-100 p-4 dark:border-slate-800">{children}</div>}
    </section>
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
  onDelete,
  onReset,
  onClose,
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
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setAdding((value) => !value)}><Plus className="h-3.5 w-3.5" /> {newLabel}</Button>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white sm:hidden" aria-label={`Close ${title.toLowerCase()} popup`}>
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
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
          <div key={term} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
              <input
                type="checkbox"
                checked={selected.includes(term)}
                onChange={() => onToggle(term)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                aria-label={`Select ${term}`}
              />
              <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{prefix}{term}</span>
            </label>
            {onDelete && (
              <button type="button" onClick={() => onDelete(term)} className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30" aria-label={`Delete ${term}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
    <div className="columns-1 gap-4 p-4 md:columns-2 xl:columns-4">
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
          className="mb-4 break-inside-avoid cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-brand-900/70 dark:hover:bg-slate-900/70"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{note.title}</h3>
            <Badge color="indigo">Note</Badge>
          </div>
          <PlannerMediaPreview media={note.meta?.media} />
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{note.excerpt || 'No preview text.'}</p>
          <PlanTermsLine categories={note.meta?.categories} tags={note.meta?.tags} tagColors={note.meta?.tag_colors} />
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

function PlanTermsLine({ categories = [], tags = [], tagColors = {}, compact = false }) {
  const terms = [
    ...(categories || []).map((value) => ({ value, color: 'sky', prefix: '' })),
    ...(tags || []).map((value) => ({ value, color: 'violet', prefix: '#', style: tagColorStyle(tagColors?.[value]) })),
  ]
  if (terms.length === 0) return null

  return (
    <div className={clsx('flex min-w-0 flex-wrap items-center gap-1.5', !compact && 'mt-3')}>
      {terms.slice(0, 5).map((term) => (
        <Badge key={`${term.prefix}${term.value}`} color={term.color} className={term.style ? '!text-white' : ''} style={term.style}>{term.prefix}{term.value}</Badge>
      ))}
      {terms.length > 5 && <Badge>+{terms.length - 5}</Badge>}
    </div>
  )
}

function PlannerNotesTable({ notes, onEdit, onDelete, deleteBusy }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Plan</th>
            <th className="px-5 py-3 font-semibold">Preview</th>
            <th className="px-5 py-3 font-semibold">Categories & tags</th>
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
                  <span className="font-semibold text-slate-900 dark:text-white">{note.title}</span>
                  <PlannerMediaCount media={note.meta?.media} />
                </div>
              </td>
              <td className="max-w-md px-5 py-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{note.excerpt || 'No preview text.'}</td>
              <td className="px-5 py-4"><PlanTermsLine compact categories={note.meta?.categories} tags={note.meta?.tags} tagColors={note.meta?.tag_colors} /></td>
              <td className="px-5 py-4"><PlannerOwner author={note.author} /></td>
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

function PlannerMediaPreview({ media = [] }) {
  const item = Array.isArray(media) ? media[0] : null
  if (!item) return null

  const src = mediaUrl(item.thumbnail_url || item.url)
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
      {item.type === 'image' || item.type === 'gif' ? (
        <img src={src} alt={item.alt_text || item.original_name || ''} className="max-h-52 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <ImageIcon className="h-4 w-4" />
          <span className="max-w-[12rem] truncate">{item.original_name || 'Attached media'}</span>
        </div>
      )}
      {media.length > 1 && <span className="block border-t border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">+{media.length - 1} more file{media.length - 1 === 1 ? '' : 's'}</span>}
    </div>
  )
}

function PlannerMediaCount({ media = [] }) {
  if (!Array.isArray(media) || media.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300" title={`${media.length} media file${media.length === 1 ? '' : 's'}`}>
      <ImageIcon className="h-3 w-3" />
      {media.length}
    </span>
  )
}

function PlannerOwner({ author }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
      {author?.avatar_url ? (
        <img src={author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <UserRound className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="max-w-24 truncate text-xs font-medium">{author?.name || 'Unknown'}</span>
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

function loadFilterSections() {
  try {
    return {
      sort: true,
      categories: true,
      tags: true,
      ...JSON.parse(localStorage.getItem('planner_filter_sections') || '{}'),
    }
  } catch {
    return { sort: true, categories: true, tags: true }
  }
}

function comparePlannerNotes(a, b, sortOrder) {
  if (sortOrder === 'title_asc' || sortOrder === 'title_desc') {
    const result = String(a.title || '').localeCompare(String(b.title || ''))
    return sortOrder === 'title_asc' ? result : -result
  }

  const aDate = new Date(sortOrder === 'updated' ? a.updated_at || a.created_at : a.created_at).getTime()
  const bDate = new Date(sortOrder === 'updated' ? b.updated_at || b.created_at : b.created_at).getTime()
  return sortOrder === 'oldest' ? aDate - bDate : bDate - aDate
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

function tagColorStyle(value) {
  if (!/^#[0-9a-f]{6}$/i.test(String(value || ''))) return undefined
  return { backgroundColor: value }
}
