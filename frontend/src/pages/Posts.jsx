import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, Grid3X3, Image as ImageIcon, List, ListFilter, Plus, Search, Table2, Tags, Trash2, UserRound, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { DATA_CHANGED_EVENT } from '../lib/appEvents'
import { Badge, Button, Card, EmptyState, PageLoader } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'
import useInfiniteList from '../hooks/useInfiniteList'

const STATUS_FILTERS = [
  ['all', 'All posts'],
  ['draft', 'Drafts'],
  ['pending_approval', 'Pending approval'],
  ['approved', 'Approved'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
]

const SORT_OPTIONS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['scheduled', 'Schedule date'],
  ['updated', 'Recently updated'],
]

export default function Posts() {
  const [posts, setPosts] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [view, setView] = useState(() => localStorage.getItem('postflow_posts_view') || 'card')
  const [sort, setSort] = useState(() => localStorage.getItem('postflow_posts_sort') || 'newest')
  const [filterOpen, setFilterOpen] = useState(false)
  const [quickFilter, setQuickFilter] = useState(null)
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [categorySearch, setCategorySearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [customCategories, setCustomCategories] = useState(() => loadPostTerms('post_custom_categories'))
  const [customTags, setCustomTags] = useState(() => loadPostTerms('post_custom_tags'))
  const [deletedCategories, setDeletedCategories] = useState(() => loadPostTerms('post_deleted_categories'))
  const [deletedTags, setDeletedTags] = useState(() => loadPostTerms('post_deleted_tags'))
  const quickFilterRef = useRef(null)

  const loadPosts = useCallback(() => {
    api.get('/posts', { params: { per_page: 100 } })
      .then(({ data }) => setPosts(data.data || []))
      .catch(() => setPosts([]))
  }, [])

  useEffect(() => {
    api.get('/social/accounts')
      .then(({ data }) => setAccounts(data.data || []))
      .catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    loadPosts()
    const interval = window.setInterval(loadPosts, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, loadPosts)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, loadPosts)
    }
  }, [loadPosts])

  useEffect(() => {
    localStorage.setItem('postflow_posts_view', view)
  }, [view])

  useEffect(() => {
    localStorage.setItem('postflow_posts_sort', sort)
  }, [sort])

  useEffect(() => {
    storePostTerms('post_custom_categories', customCategories)
  }, [customCategories])

  useEffect(() => {
    storePostTerms('post_custom_tags', customTags)
  }, [customTags])

  useEffect(() => {
    storePostTerms('post_deleted_categories', deletedCategories)
  }, [deletedCategories])

  useEffect(() => {
    storePostTerms('post_deleted_tags', deletedTags)
  }, [deletedTags])

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

  const categoryOptions = useMemo(() => mergePostTerms(posts, 'categories', customCategories).filter((term) => !deletedCategories.includes(term)), [customCategories, deletedCategories, posts])
  const tagOptions = useMemo(() => mergePostTerms(posts, 'tags', customTags).filter((term) => !deletedTags.includes(term)), [customTags, deletedTags, posts])

  const visiblePosts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (posts || [])
      .filter((post) => status === 'all' || post.status === status)
      .filter((post) => accountFilter === 'all' || (post.variants || []).some((variant) => String(variant.social_account_id) === accountFilter))
      .filter((post) => {
        const postCategories = (post.options?.categories || []).map((item) => String(item).toLowerCase())
        const postTags = (post.options?.tags || []).map((item) => String(item).toLowerCase())
        const matchesCategories = selectedCategories.length === 0 || selectedCategories.some((category) => postCategories.includes(category.toLowerCase()))
        const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => postTags.includes(tag.toLowerCase()))
        if (!matchesCategories || !matchesTags) return false
        if (!query) return true
        return [
          post.title,
          post.content,
          post.status_label,
          ...(post.options?.categories || []),
          ...(post.options?.tags || []),
          ...(post.variants || []).map((variant) => variant.platform),
        ].filter(Boolean).join(' ').toLowerCase().includes(query)
      })
      .sort((a, b) => comparePosts(a, b, sort))
  }, [accountFilter, posts, search, selectedCategories, selectedTags, sort, status])

  const openNewPost = () => {
    window.dispatchEvent(new CustomEvent('postflow:quick-action', { detail: { type: 'composer' } }))
  }

  const openPost = (post) => {
    window.dispatchEvent(new CustomEvent('postflow:open-post', { detail: { id: post.id, item: post } }))
  }

  const deleteCategoryTerm = (term) => {
    setCustomCategories((current) => current.filter((item) => item !== term))
    setSelectedCategories((current) => current.filter((item) => item !== term))
    setDeletedCategories((current) => uniquePostTerms([...current, term]))
  }

  const deleteTagTerm = (term) => {
    setCustomTags((current) => current.filter((item) => item !== term))
    setSelectedTags((current) => current.filter((item) => item !== term))
    setDeletedTags((current) => uniquePostTerms([...current, term]))
  }

  const hasActiveFilters = status !== 'all' || sort !== 'newest' || accountFilter !== 'all' || selectedCategories.length > 0 || selectedTags.length > 0
  const { hasMore, items: pagedPosts, sentinelRef } = useInfiniteList(visiblePosts)

  if (!posts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Posts</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage drafts, approvals, scheduled posts, and published content.</p>
        </div>
        <Button onClick={openNewPost}><Plus className="h-4 w-4" /> New post</Button>
      </div>

      <Card className="overflow-visible">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search posts, channels, categories, tags..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear post search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:w-44"
            aria-label="Filter posts by status"
          >
            {STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:w-48"
            aria-label="Sort posts"
          >
            {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="h-11 min-w-48 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            aria-label="Filter posts by social account"
          >
            <option value="all">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} ({account.platform_label || account.platform})</option>
            ))}
          </select>
          <div ref={quickFilterRef} className="relative inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
            <ViewButton
              active={selectedCategories.length > 0 || quickFilter === 'categories'}
              onClick={() => setQuickFilter((current) => current === 'categories' ? null : 'categories')}
              icon={List}
              label="Categories"
            />
            <ViewButton
              active={selectedTags.length > 0 || quickFilter === 'tags'}
              onClick={() => setQuickFilter((current) => current === 'tags' ? null : 'tags')}
              icon={Tags}
              label="Tags"
            />
            <PostTermPopover
              open={quickFilter === 'categories'}
              title="Categories"
              icon={List}
              search={categorySearch}
              onSearch={setCategorySearch}
              placeholder="Search categories..."
              emptyText="No post categories yet."
              terms={categoryOptions}
              selected={selectedCategories}
              onToggle={(category) => setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}
              onDelete={deleteCategoryTerm}
              onReset={() => setSelectedCategories([])}
              onClose={() => setQuickFilter(null)}
            />
            <PostTermPopover
              open={quickFilter === 'tags'}
              title="Tags"
              icon={Tags}
              search={tagSearch}
              onSearch={setTagSearch}
              placeholder="Search tags..."
              emptyText="No post tags yet."
              terms={tagOptions}
              selected={selectedTags}
              onToggle={(tag) => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}
              onDelete={deleteTagTerm}
              onReset={() => setSelectedTags([])}
              onClose={() => setQuickFilter(null)}
              prefix="#"
            />
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
            <ViewButton active={view === 'card'} onClick={() => setView('card')} icon={Grid3X3} label="Card view" />
            <ViewButton active={view === 'table'} onClick={() => setView('table')} icon={Table2} label="Table view" />
            <ViewButton active={hasActiveFilters} onClick={() => setFilterOpen(true)} icon={ListFilter} label="Filters" />
          </div>
        </div>

        {visiblePosts.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={CalendarClock} title="No posts found" description="Create a new post or adjust the current filters." action={<Button onClick={openNewPost}>New post</Button>} />
          </div>
        ) : view === 'table' ? (
          <PostTable posts={pagedPosts} onOpen={openPost} />
        ) : (
          <div className="columns-1 gap-4 p-4 md:columns-2 xl:columns-3">
            {pagedPosts.map((post) => <PostCard key={post.id} post={post} onOpen={openPost} />)}
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="px-4 pb-5 text-center text-xs font-semibold text-slate-400">Loading more posts...</div>}
      </Card>

      <PostFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        status={status}
        sort={sort}
        accountFilter={accountFilter}
        accounts={accounts}
        categories={categoryOptions}
        tags={tagOptions}
        selectedCategories={selectedCategories}
        selectedTags={selectedTags}
        categorySearch={categorySearch}
        tagSearch={tagSearch}
        onStatusChange={setStatus}
        onSortChange={setSort}
        onAccountFilterChange={setAccountFilter}
        onCategorySearch={setCategorySearch}
        onTagSearch={setTagSearch}
        onToggleCategory={(category) => setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])}
        onToggleTag={(tag) => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}
        onDeleteCategory={deleteCategoryTerm}
        onDeleteTag={deleteTagTerm}
        onReset={() => {
          setStatus('all')
          setSort('newest')
          setAccountFilter('all')
          setSelectedCategories([])
          setSelectedTags([])
        }}
      />
    </div>
  )
}

function PostFilterDrawer({
  open,
  onClose,
  status,
  sort,
  accountFilter,
  accounts,
  categories,
  tags,
  selectedCategories,
  selectedTags,
  categorySearch,
  tagSearch,
  onStatusChange,
  onSortChange,
  onAccountFilterChange,
  onCategorySearch,
  onTagSearch,
  onToggleCategory,
  onToggleTag,
  onDeleteCategory,
  onDeleteTag,
  onReset,
}) {
  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  return (
    <div className={clsx('fixed inset-0 z-[220] transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button
        type="button"
        className={clsx('absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        aria-label="Close post filters"
      />
      <aside className={clsx(
        'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Post filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Filter posts by status, account, category, tag, and order.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close post filters">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <FilterCard title="Status" description="Drafts, scheduled posts, published posts, and failures.">
            <select value={status} onChange={(event) => onStatusChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FilterCard>
          <FilterCard title="Social account" description="Limit results to posts targeting one connected account.">
            <select value={accountFilter} onChange={(event) => onAccountFilterChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name} ({account.platform_label || account.platform})</option>
              ))}
            </select>
          </FilterCard>
          <FilterCard title="Categories" description={`${selectedCategories.length} selected`}>
            <PostTermFilterPanel
              emptyText="No post categories yet."
              onDelete={onDeleteCategory}
              onSearch={onCategorySearch}
              onToggle={onToggleCategory}
              placeholder="Search categories..."
              search={categorySearch}
              selected={selectedCategories}
              terms={categories}
            />
          </FilterCard>
          <FilterCard title="Tags" description={`${selectedTags.length} selected`}>
            <PostTermFilterPanel
              emptyText="No post tags yet."
              onDelete={onDeleteTag}
              onSearch={onTagSearch}
              onToggle={onToggleTag}
              placeholder="Search tags..."
              prefix="#"
              search={tagSearch}
              selected={selectedTags}
              terms={tags}
            />
          </FilterCard>
          <FilterCard title="Sort" description="Control ordering in card and table views.">
            <select value={sort} onChange={(event) => onSortChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FilterCard>
        </div>
        <div className="flex justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onReset}>Reset</Button>
          <Button type="button" onClick={onClose}>Apply filters</Button>
        </div>
      </aside>
    </div>
  )
}

function FilterCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="-mt-2 mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
      {children}
    </section>
  )
}

function PostTermFilterPanel({ emptyText, onDelete, onSearch, onToggle, placeholder, prefix = '', search, selected, terms }) {
  const visibleTerms = terms.filter((term) => term.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear term search">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {visibleTerms.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{emptyText}</p>
        ) : visibleTerms.map((term) => (
          <div key={term} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={selected.includes(term)} onChange={() => onToggle(term)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{prefix}{term}</span>
            </label>
            {onDelete && (
              <button type="button" onClick={() => onDelete(term)} className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300" aria-label={`Delete ${term}`} title={`Delete ${term}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PostTermPopover({ open, title, icon: Icon, search, onSearch, placeholder, emptyText, terms, selected, onToggle, onDelete, onReset, onClose, prefix = '' }) {
  const visibleTerms = terms.filter((term) => term.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[230] origin-top-right overflow-y-auto rounded-none border-0 border-slate-200 bg-white p-4 shadow-2xl transition duration-200 dark:border-slate-800 dark:bg-slate-900 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:z-[150] sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))] sm:rounded-2xl sm:border',
        open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
      )}
    >
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
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white sm:hidden" aria-label={`Close ${title.toLowerCase()} popup`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1 sm:max-h-72">
          {visibleTerms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{emptyText}</p>
          ) : visibleTerms.map((term) => {
            const checked = selected.includes(term)
            return (
              <div key={term} className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition', checked ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60')}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={checked} onChange={() => onToggle(term)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="min-w-0 flex-1 truncate">{prefix}{term}</span>
                </label>
                {onDelete && (
                  <button type="button" onClick={() => onDelete(term)} className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300" aria-label={`Delete ${term}`} title={`Delete ${term}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button type="button" size="sm" variant="ghost" onClick={onReset}>Reset</Button>
        </div>
      </section>
    </div>
  )
}

function ViewButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={clsx('rounded-lg p-2 transition', active ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white')}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function PostCard({ post, onOpen }) {
  const categories = post.options?.categories || []
  const tags = post.options?.tags || []
  const media = post.media || []

  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-800">
      <button type="button" onClick={() => onOpen(post)} className="block w-full text-left">
        {media[0] ? (
          media[0].type === 'image'
            ? <img src={media[0].thumbnail_url || media[0].url} alt="" className="aspect-video w-full object-cover" />
            : <div className="flex aspect-video items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-950"><ImageIcon className="h-7 w-7" /></div>
        ) : null}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <Badge color={post.status_color || 'slate'}>{post.status_label || post.status}</Badge>
            <span className="whitespace-nowrap text-xs font-medium text-slate-400">{formatDate(post.scheduled_at || post.published_at || post.created_at)}</span>
          </div>
          <p className="line-clamp-5 break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{post.content || post.title || 'Untitled post'}</p>
          <TermLine categories={categories} tags={tags} tagColors={post.options?.tag_colors} />
          <div className="flex items-center justify-between gap-3">
            <Platforms post={post} />
            <Owner post={post} />
          </div>
        </div>
      </button>
    </article>
  )
}

function PostTable({ posts, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Post</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Channels</th>
            <th className="px-5 py-3 font-semibold">Terms</th>
            <th className="px-5 py-3 font-semibold">Schedule</th>
            <th className="px-5 py-3 font-semibold">Owner</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {posts.map((post) => (
            <tr key={post.id} onClick={() => onOpen(post)} className="cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className="max-w-md px-5 py-4">
                <p className="font-semibold text-slate-900 dark:text-white">{post.title || `Post #${post.id}`}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{post.content || 'No content yet.'}</p>
              </td>
              <td className="px-5 py-4"><Badge color={post.status_color || 'slate'}>{post.status_label || post.status}</Badge></td>
              <td className="px-5 py-4"><Platforms post={post} /></td>
              <td className="px-5 py-4"><TermLine categories={post.options?.categories || []} tags={post.options?.tags || []} tagColors={post.options?.tag_colors} compact /></td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-500 dark:text-slate-400">{formatDate(post.scheduled_at || post.published_at || post.created_at)}</td>
              <td className="px-5 py-4"><Owner post={post} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Platforms({ post }) {
  const variants = post.variants || []
  if (!variants.length) return <span className="text-xs text-slate-400">No channels</span>
  return (
    <div className="flex items-center -space-x-1.5">
      {variants.slice(0, 4).map((variant) => <PlatformBadge key={variant.id} platform={variant.platform} size="xs" className="ring-2 ring-white dark:ring-slate-900" />)}
      {variants.length > 4 && <span className="ml-2 text-xs font-medium text-slate-500">+{variants.length - 4}</span>}
    </div>
  )
}

function Owner({ post }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
      {post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><UserRound className="h-3.5 w-3.5" /></span>}
      <span className="max-w-24 truncate text-xs font-medium">{post.author?.name || 'Unknown'}</span>
    </div>
  )
}

function TermLine({ categories = [], tags = [], tagColors = {}, compact = false }) {
  const items = [
    ...categories.map((value) => ({ value, color: 'sky', prefix: '' })),
    ...tags.map((value) => ({ value, color: 'violet', prefix: '#', style: tagColorStyle(tagColors?.[value]) })),
  ]
  if (!items.length) return <span className="text-xs text-slate-400">No categories or tags</span>
  return (
    <div className={clsx('flex flex-wrap gap-1.5', compact && 'max-w-64')}>
      {items.slice(0, compact ? 4 : 6).map((item) => <Badge key={`${item.prefix}${item.value}`} color={item.color} className={item.style ? '!text-white' : ''} style={item.style}>{item.prefix}{item.value}</Badge>)}
      {items.length > (compact ? 4 : 6) && <Badge>+{items.length - (compact ? 4 : 6)}</Badge>}
    </div>
  )
}

function comparePosts(a, b, sort) {
  const dateFor = (post) => {
    if (sort === 'scheduled') return post.scheduled_at || post.published_at || post.created_at
    if (sort === 'updated') return post.updated_at || post.created_at
    return post.created_at || post.updated_at
  }
  const aDate = new Date(dateFor(a)).getTime() || 0
  const bDate = new Date(dateFor(b)).getTime() || 0
  if (sort === 'oldest') return aDate - bDate
  return bDate - aDate
}

function formatDate(value) {
  if (!value) return 'Not scheduled'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}

function mergePostTerms(posts, field, customTerms = []) {
  const terms = new Set()
  ;(posts || []).forEach((post) => {
    ;(post.options?.[field] || []).forEach((term) => {
      const value = String(term || '').trim()
      if (value) terms.add(value)
    })
  })
  customTerms.forEach((term) => {
    const value = String(term || '').trim()
    if (value) terms.add(value)
  })
  return [...terms].sort((a, b) => a.localeCompare(b))
}

function loadPostTerms(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? uniquePostTerms(parsed) : []
  } catch {
    return []
  }
}

function storePostTerms(key, terms) {
  localStorage.setItem(key, JSON.stringify(uniquePostTerms(terms)))
}

function uniquePostTerms(terms) {
  const seen = new Set()
  return (terms || []).reduce((items, value) => {
    const term = String(value || '').trim().replace(/\s+/g, ' ')
    const key = term.toLowerCase()
    if (!term || seen.has(key)) return items
    seen.add(key)
    return [...items, term]
  }, [])
}

function tagColorStyle(value) {
  if (!/^#[0-9a-f]{6}$/i.test(String(value || ''))) return undefined
  return { backgroundColor: value }
}
