import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  Download,
  Grid3X3,
  ListFilter,
  MoreVertical,
  Play,
  Plus,
  Rss,
  Search,
  Star,
  Table2,
  Trash2,
  Upload,
  Workflow,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, EmptyState, PageLoader, ConfirmDialog } from '../components/ui'
import AutomationCreateModal from '../components/automations/AutomationCreateModal'
import { DATA_CHANGED_EVENT } from '../lib/appEvents'
import useInfiniteList from '../hooks/useInfiniteList'
import usePageSize from '../hooks/usePageSize'

const CATEGORY_KEY = 'postflow_automation_categories'
const CATEGORY_MAP_KEY = 'postflow_automation_category_map'
const FAVORITES_KEY = 'postflow_automation_favorites'
const VIEW_KEY = 'postflow_automations_view'
const FILTER_KEY = 'postflow_automations_filters'
const FILTER_ACCORDION_KEY = 'postflow_automations_filter_accordions'

const DEFAULT_CATEGORIES = ['Content repurpose', 'RSS publishing', 'Approval workflow']
const SORT_OPTIONS = [
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['name_asc', 'Name A-Z'],
  ['name_desc', 'Name Z-A'],
]

export default function Automations() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageSize = usePageSize('automations', 24)
  const [automations, setAutomations] = useState(null)
  const [automationMeta, setAutomationMeta] = useState(null)
  const [loadingMoreAutomations, setLoadingMoreAutomations] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'card')
  const [filters, setFilters] = useState(() => loadFilters())
  const [categories, setCategories] = useState(() => loadCategories())
  const [categoryMap, setCategoryMap] = useState(() => loadCategoryMap())
  const [favorites, setFavorites] = useState(() => loadFavorites())
  const [openActionId, setOpenActionId] = useState(null)
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)
  const activeTab = normalizeLibraryTab(searchParams.get('tab'), categories)

  const load = useCallback((page = 1, append = false) => {
    if (append) setLoadingMoreAutomations(true)
    return api.get('/automations', { params: { per_page: pageSize, page } })
      .then(({ data }) => {
        const nextAutomations = data.data || []
        setAutomations((current) => append ? [...(current || []), ...nextAutomations] : nextAutomations)
        setAutomationMeta(data.meta || null)
      })
      .catch(() => {
        if (!append) {
          setAutomations([])
          setAutomationMeta(null)
        }
      })
      .finally(() => {
        if (append) setLoadingMoreAutomations(false)
      })
  }, [pageSize])

  useEffect(() => {
    const refresh = () => load()
    refresh()
    const interval = window.setInterval(refresh, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, refresh)
    }
  }, [load])

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  useEffect(() => {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem(CATEGORY_MAP_KEY, JSON.stringify(categoryMap))
  }, [categoryMap])

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters))
  }, [filters])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(null), 2200)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!createMenuOpen) return undefined
    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) setCreateMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [createMenuOpen])

  useEffect(() => {
    if (openActionId === null) return undefined
    const close = (event) => {
      if (!event.target.closest('[data-automation-actions]')) setOpenActionId(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openActionId])

  const selectLibraryTab = (tab) => {
    const nextTab = normalizeLibraryTab(tab, categories)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', nextTab)
      return next
    }, { replace: true })
  }

  const notify = (type, text) => setMessage({ type, text })

  const run = async (event, id) => {
    event.stopPropagation()
    const { data } = await api.post(`/automations/${id}/run`)
    notify('success', data.message || 'Automation run started.')
  }

  const remove = async () => {
    if (!confirmDelete) return
    setDeleteBusy(true)
    try {
      await api.delete(`/automations/${confirmDelete.id}`)
      setConfirmDelete(null)
      setFavorites((current) => current.filter((id) => id !== String(confirmDelete.id)))
      setCategoryMap((current) => {
        const next = { ...current }
        delete next[String(confirmDelete.id)]
        return next
      })
      load()
    } finally {
      setDeleteBusy(false)
    }
  }

  const toggleFavorite = (event, automation) => {
    event.stopPropagation()
    const key = String(automation.id)
    setFavorites((current) => current.includes(key) ? current.filter((id) => id !== key) : [...current, key])
  }

  const assignCategory = (automation, category) => {
    setCategoryMap((current) => {
      const next = { ...current }
      if (!category) delete next[String(automation.id)]
      else next[String(automation.id)] = category
      return next
    })
  }

  const addCategory = (name) => {
    const clean = cleanCategoryName(name)
    if (!clean) return false
    setCategories((current) => current.some((item) => item.toLowerCase() === clean.toLowerCase()) ? current : [...current, clean])
    return true
  }

  const renameCategory = (oldName, nextName) => {
    const clean = cleanCategoryName(nextName)
    if (!clean) return
    setCategories((current) => current.map((category) => category === oldName ? clean : category))
    setCategoryMap((current) => Object.fromEntries(Object.entries(current).map(([id, category]) => [id, category === oldName ? clean : category])))
  }

  const deleteCategory = (categoryName) => {
    setCategories((current) => current.filter((category) => category !== categoryName))
    setCategoryMap((current) => Object.fromEntries(Object.entries(current).filter(([, category]) => category !== categoryName)))
    if (activeTab === categorySlug(categoryName)) selectLibraryTab('all')
  }

  const downloadWorkflow = (event, automation) => {
    event.stopPropagation()
    const template = buildWorkflowTemplate(automation, automationCategory(categoryMap, automation))
    downloadJson(template, `${slugify(automation.name || 'automation')}-workflow.json`)
  }

  const importWorkflow = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 512 * 1024) {
      notify('error', 'Workflow JSON must be smaller than 512 KB.')
      return
    }
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      const template = validateWorkflowTemplate(parsed)
      const { data } = await api.post('/automations', {
        name: template.name,
        description: template.description,
        type: template.type,
        requires_approval: template.requires_approval,
        use_ai: template.use_ai,
        social_account_ids: [],
        feed_urls: template.feed_urls,
        config: {
          description: template.description,
          imported_template: true,
          source_format: 'postflow.workflow.v1',
          workflow: template.workflow,
        },
      })
      if (template.category) {
        addCategory(template.category)
        setCategoryMap((current) => ({ ...current, [String(data.data.id)]: template.category }))
      }
      notify('success', 'Workflow imported. Connect accounts and credentials in the playground.')
      load()
      navigate(`/app/automations/${data.data.id}`)
    } catch (error) {
      notify('error', error.message || error.response?.data?.message || 'Could not import this workflow JSON.')
    }
  }

  const visibleAutomations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (automations || [])
      .filter((automation) => {
        if (activeTab === 'favorite') return favorites.includes(String(automation.id))
        if (activeTab !== 'all') return categorySlug(automationCategory(categoryMap, automation)) === activeTab
        return true
      })
      .filter((automation) => (
        filters.status === 'all'
          ? true
          : filters.status === 'active'
            ? automation.is_active
            : !automation.is_active
      ))
      .filter((automation) => {
        if (!query) return true
        return [
          automation.name,
          automation.description,
          automation.type_label,
          automationCategory(categoryMap, automation),
        ].filter(Boolean).join(' ').toLowerCase().includes(query)
      })
      .sort((a, b) => compareAutomations(a, b, filters.sort))
  }, [activeTab, automations, categoryMap, favorites, filters.sort, filters.status, search])

  const sidebarItems = useMemo(() => {
    const list = automations || []
    return [
      { key: 'all', label: 'All', count: list.length },
      { key: 'favorite', label: 'Favorite', count: list.filter((item) => favorites.includes(String(item.id))).length },
      ...categories.map((category) => ({
        key: categorySlug(category),
        label: category,
        count: list.filter((item) => automationCategory(categoryMap, item) === category).length,
      })),
    ]
  }, [automations, categories, categoryMap, favorites])

  const hasServerMore = Boolean(automationMeta && automationMeta.current_page < automationMeta.last_page)
  const loadMoreAutomations = useCallback(() => {
    if (!hasServerMore || loadingMoreAutomations) return
    load(automationMeta.current_page + 1, true)
  }, [automationMeta, hasServerMore, load, loadingMoreAutomations])
  const { hasMore, items: pagedAutomations, sentinelRef } = useInfiniteList(visibleAutomations, {
    pageSize,
    hasExternalMore: hasServerMore,
    externalLoading: loadingMoreAutomations,
    onEndReached: loadMoreAutomations,
    resetKey: [activeTab, search, filters.status, filters.sort].join('::'),
  })

  if (!automations) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automations</h1>
          <p className="text-sm text-slate-500">Build, import, export, and organize reusable workflow templates.</p>
        </div>
        <div className="relative" ref={menuRef}>
          <div className="flex overflow-hidden rounded-xl shadow-sm">
            <Button type="button" className="rounded-r-none" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New automation</Button>
            <button type="button" onClick={() => setCreateMenuOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center border-l border-white/20 bg-brand-600 text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30" aria-label="Open automation actions" aria-haspopup="menu" aria-expanded={createMenuOpen}>
              <ChevronDown className={clsx('h-4 w-4 transition', createMenuOpen && 'rotate-180')} />
            </button>
          </div>
          {createMenuOpen && (
            <div className="absolute right-0 z-[80] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="menu">
              <button type="button" onClick={() => { setCreateMenuOpen(false); setShowCreate(true) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700" role="menuitem">
                <Workflow className="h-4 w-4 text-brand-500" /> Create blank workflow
              </button>
              <button type="button" onClick={() => { setCreateMenuOpen(false); fileInputRef.current?.click() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700" role="menuitem">
                <Upload className="h-4 w-4 text-brand-500" /> Import workflow JSON
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" hidden accept="application/json,.json" onChange={importWorkflow} />
        </div>
      </div>

      {message && (
        <div className={clsx('rounded-xl border px-4 py-3 text-sm', message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400')}>
          {message.text}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <AutomationSidebar items={sidebarItems} activeTab={activeTab} onSelect={selectLibraryTab} />

        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search automations, categories, workflow types..."
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear automation search"><X className="h-4 w-4" /></button>}
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50">
              <ViewButton active={view === 'card'} onClick={() => setView('card')} icon={Grid3X3} label="Card view" />
              <ViewButton active={view === 'table'} onClick={() => setView('table')} icon={Table2} label="Table view" />
              <ViewButton active={filters.status !== 'all' || filters.sort !== 'newest'} onClick={() => setFilterOpen(true)} icon={ListFilter} label="Filters" />
            </div>
          </div>

          {automations.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Workflow} title="No automations yet" description="Create your first automation or import a workflow JSON template." action={<Button onClick={() => setShowCreate(true)}>Create automation</Button>} />
            </div>
          ) : visibleAutomations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-slate-800 dark:text-slate-100">No automations found</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Adjust the search, sidebar category, or filter options.</p>
            </div>
          ) : view === 'table' ? (
            <AutomationTable
              automations={pagedAutomations}
              categoryMap={categoryMap}
              favorites={favorites}
              onDelete={setConfirmDelete}
              onDownload={downloadWorkflow}
              onFavorite={toggleFavorite}
              onToggleMenu={(id) => setOpenActionId((current) => current === id ? null : id)}
              onCloseMenu={() => setOpenActionId(null)}
              openActionId={openActionId}
              onOpen={(automation) => navigate(`/app/automations/${automation.id}`)}
              onRun={run}
            />
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {pagedAutomations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  category={automationCategory(categoryMap, automation)}
                  favorite={favorites.includes(String(automation.id))}
                  onDelete={setConfirmDelete}
                  onDownload={downloadWorkflow}
                  onFavorite={toggleFavorite}
                  onToggleMenu={(id) => setOpenActionId((current) => current === id ? null : id)}
                  onCloseMenu={() => setOpenActionId(null)}
                  openActionId={openActionId}
                  onOpen={() => navigate(`/app/automations/${automation.id}`)}
                  onRun={run}
                />
              ))}
            </div>
          )}
          {hasMore && <div ref={sentinelRef} className="px-4 pb-5 text-center text-xs font-semibold text-slate-400">Loading more automations...</div>}
        </Card>
      </div>

      <AutomationFilterDrawer
        categories={categories}
        filters={filters}
        onAddCategory={addCategory}
        onClose={() => setFilterOpen(false)}
        onDeleteCategory={deleteCategory}
        onFiltersChange={setFilters}
        onRenameCategory={renameCategory}
        open={filterOpen}
      />

      <AutomationCreateModal
        open={showCreate}
        categories={categories}
        onClose={() => setShowCreate(false)}
        onCreated={(automation, category) => {
          if (category) assignCategory(automation, category)
          load()
          if (automation?.id) navigate(`/app/automations/${automation.id}`)
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete automation"
        description={`Delete "${confirmDelete?.name || 'this automation'}"? It will stop creating future posts.`}
        confirmLabel="Delete automation"
        loading={deleteBusy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </div>
  )
}

function AutomationSidebar({ items, activeTab, onSelect }) {
  return (
    <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-20">
      <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Library</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Filter by category or favorite</p>
      </div>
      <div className="mt-2 space-y-1" role="listbox" aria-label="Automation filters">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={clsx(
              'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
              activeTab === item.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {item.key === 'favorite' ? <Star className={clsx('h-4 w-4', activeTab === item.key && 'fill-current')} /> : <Workflow className="h-4 w-4" />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className={clsx('rounded-full px-1.5 text-[10px]', activeTab === item.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>{item.count}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function AutomationCard({ automation, category, favorite, onCloseMenu, onDelete, onDownload, onFavorite, onOpen, onRun, onToggleMenu, openActionId }) {
  return (
    <Card
      className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:hover:border-brand-700"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30">
            <Rss className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{automation.name}</p>
            <p className="text-xs text-slate-400">{automation.type_label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={(event) => onFavorite(event, automation)} className={clsx('rounded-lg p-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800', favorite ? 'text-amber-500' : 'text-slate-400')} aria-label={favorite ? 'Remove favorite' : 'Add favorite'} title={favorite ? 'Remove favorite' : 'Add favorite'}>
            <Star className={clsx('h-4 w-4', favorite && 'fill-current')} />
          </button>
          <Badge color={automation.is_active ? 'emerald' : 'gray'}>{automation.is_active ? 'Active' : 'Paused'}</Badge>
          <AutomationActionsMenu
            automation={automation}
            open={openActionId === automation.id}
            onClose={onCloseMenu}
            onDelete={onDelete}
            onDownload={onDownload}
            onToggle={() => onToggleMenu(automation.id)}
          />
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{automation.description || 'Open the playground to design triggers, actions, filters, and publishing steps.'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{automation.items_created} posts created</span>
        {automation.use_ai && <Badge color="violet">AI</Badge>}
        {category && <Badge color="indigo">{category}</Badge>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={(event) => onRun(event, automation.id)}><Play className="h-3.5 w-3.5" /> Run now</Button>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-300">Open</span>
      </div>
    </Card>
  )
}

function AutomationTable({ automations, categoryMap, favorites, onCloseMenu, onDelete, onDownload, onFavorite, onOpen, onRun, onToggleMenu, openActionId }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Workflow</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {automations.map((automation) => {
            const favorite = favorites.includes(String(automation.id))
            const category = automationCategory(categoryMap, automation)
            return (
              <tr key={automation.id} role="button" tabIndex={0} onClick={() => onOpen(automation)} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(automation)
                }
              }} className="cursor-pointer transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button type="button" onClick={(event) => onFavorite(event, automation)} className={clsx('rounded-lg p-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800', favorite ? 'text-amber-500' : 'text-slate-400')} aria-label={favorite ? 'Remove favorite' : 'Add favorite'}>
                      <Star className={clsx('h-4 w-4', favorite && 'fill-current')} />
                    </button>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Workflow className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900 dark:text-white">{automation.name}</span>
                      <span className="block truncate text-xs text-slate-400">{automation.description || automation.type_label}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {category ? <Badge color="indigo">{category}</Badge> : <span className="text-xs text-slate-400">No category</span>}
                </td>
                <td className="px-4 py-3"><Badge color={automation.is_active ? 'emerald' : 'gray'}>{automation.is_active ? 'Active' : 'Paused'}</Badge></td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{automation.created_at ? new Date(automation.created_at).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={(event) => onRun(event, automation.id)}><Play className="h-3.5 w-3.5" /></Button>
                    <AutomationActionsMenu
                      automation={automation}
                      open={openActionId === automation.id}
                      onClose={onCloseMenu}
                      onDelete={onDelete}
                      onDownload={onDownload}
                      onToggle={() => onToggleMenu(automation.id)}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AutomationActionsMenu({ automation, open, onClose, onDelete, onDownload, onToggle }) {
  const runAction = (event, action) => {
    event.stopPropagation()
    onClose()
    action(event)
  }

  return (
    <div data-automation-actions className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label="Automation actions"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-[170] w-48 rounded-2xl border border-slate-200 bg-white p-1.5 text-sm shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={(event) => runAction(event, (actionEvent) => onDownload(actionEvent, automation))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            <Download className="h-4 w-4" /> Download
          </button>
          <button type="button" onClick={(event) => runAction(event, () => onDelete(automation))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

function AutomationFilterDrawer({ categories, filters, onAddCategory, onClose, onDeleteCategory, onFiltersChange, onRenameCategory, open }) {
  const [newCategory, setNewCategory] = useState('')
  const [editing, setEditing] = useState(null)
  const [openSections, setOpenSections] = useState(() => loadFilterAccordionState())

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  useEffect(() => {
    localStorage.setItem(FILTER_ACCORDION_KEY, JSON.stringify(openSections))
  }, [openSections])

  const toggleSection = (key) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }))
  }

  const reset = () => {
    onFiltersChange({ status: 'all', sort: 'newest' })
  }

  return (
    <div className={clsx('fixed inset-0 z-[220] transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button
        type="button"
        className={clsx('absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        aria-label="Close automation filters"
      />
      <aside className={clsx(
        'absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Automation filters</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sort workflows and manage category labels.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close filters"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <AutomationFilterAccordion title="Display" description={`${filters.status === 'all' ? 'All statuses' : filters.status} · ${SORT_OPTIONS.find(([key]) => key === filters.sort)?.[1] || 'Newest first'}`} open={openSections.display} onToggle={() => toggleSection('display')} icon={ListFilter}>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
                <select value={filters.status} onChange={(event) => onFiltersChange((current) => ({ ...current, status: event.target.value }))} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Sort</span>
                <select value={filters.sort} onChange={(event) => onFiltersChange((current) => ({ ...current, sort: event.target.value }))} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  {SORT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
            </div>
          </AutomationFilterAccordion>

          <AutomationFilterAccordion title="Categories" description={`${categories.length} saved categories`} open={openSections.categories} onToggle={() => toggleSection('categories')} icon={Workflow}>
            <form className="mt-3 flex gap-2" onSubmit={(event) => {
              event.preventDefault()
              if (onAddCategory(newCategory)) setNewCategory('')
            }}>
              <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              <Button type="submit" size="sm">Add</Button>
            </form>
            <div className="mt-3 space-y-2">
              {categories.map((category) => (
                <div key={category} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-950/40">
                  {editing === category ? (
                    <input
                      autoFocus
                      defaultValue={category}
                      onBlur={(event) => {
                        onRenameCategory(category, event.target.value)
                        setEditing(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          onRenameCategory(category, event.currentTarget.value)
                          setEditing(null)
                        }
                        if (event.key === 'Escape') setEditing(null)
                      }}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  ) : (
                    <button type="button" onClick={() => setEditing(category)} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800">{category}</button>
                  )}
                  <button type="button" onClick={() => onDeleteCategory(category)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30" aria-label={`Delete ${category}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </AutomationFilterAccordion>
        </div>
        <div className="flex justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
          <Button type="button" onClick={onClose}>Apply filters</Button>
        </div>
      </aside>
    </div>
  )
}

function AutomationFilterAccordion({ children, description, icon: Icon, onToggle, open, title }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/30">
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

function ViewButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-brand-500/25',
        active ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800',
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function loadCategories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORY_KEY) || '[]')
    return Array.isArray(parsed) && parsed.length ? parsed.map(cleanCategoryName).filter(Boolean) : DEFAULT_CATEGORIES
  } catch {
    return DEFAULT_CATEGORIES
  }
}

function loadCategoryMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORY_MAP_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function loadFilters() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTER_KEY) || '{}')
    return {
      status: ['all', 'active', 'paused'].includes(parsed.status) ? parsed.status : 'all',
      sort: SORT_OPTIONS.some(([key]) => key === parsed.sort) ? parsed.sort : 'newest',
    }
  } catch {
    return { status: 'all', sort: 'newest' }
  }
}

function loadFilterAccordionState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTER_ACCORDION_KEY) || '{}')
    return {
      display: typeof parsed.display === 'boolean' ? parsed.display : true,
      categories: typeof parsed.categories === 'boolean' ? parsed.categories : true,
    }
  } catch {
    return { display: true, categories: true }
  }
}

function normalizeLibraryTab(tab, categories) {
  if (tab === 'favorite') return 'favorite'
  if ((categories || []).some((category) => categorySlug(category) === tab)) return tab
  return 'all'
}

function cleanCategoryName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60)
}

function automationCategory(categoryMap, automation) {
  return categoryMap[String(automation.id)] || automation.config?.category || ''
}

function categorySlug(value) {
  return slugify(value || 'category')
}

function slugify(value) {
  return String(value || 'automation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'automation'
}

function compareAutomations(a, b, sort) {
  if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0)
  if (sort === 'name_asc') return String(a.name || '').localeCompare(String(b.name || ''))
  if (sort === 'name_desc') return String(b.name || '').localeCompare(String(a.name || ''))
  return new Date(b.created_at || 0) - new Date(a.created_at || 0)
}

function buildWorkflowTemplate(automation, category) {
  const workflow = automation.config?.workflow || { nodes: [], edges: [] }
  return {
    format: 'postflow.workflow.v1',
    exported_at: new Date().toISOString(),
    automation: {
      name: automation.name,
      description: automation.description || automation.config?.description || '',
      type: automation.type || 'rss_feed',
      category: category || '',
      requires_approval: Boolean(automation.requires_approval),
      use_ai: Boolean(automation.use_ai),
      feed_urls: (automation.feeds || []).map((feed) => feed.url).filter(isSafeUrl),
      workflow: sanitizeWorkflowForExport(workflow),
    },
  }
}

function validateWorkflowTemplate(template) {
  if (!template || typeof template !== 'object') throw new Error('Invalid JSON workflow file.')
  if (template.format && template.format !== 'postflow.workflow.v1') throw new Error('Unsupported workflow format.')
  const automation = template.automation || template
  const name = cleanTemplateString(automation.name || 'Imported workflow', 120)
  const description = cleanTemplateString(automation.description || '', 900)
  const type = ['rss_feed', 'blog', 'youtube_channel', 'csv_import', 'recycle', 'repost_top_performing'].includes(automation.type) ? automation.type : 'rss_feed'
  const workflow = sanitizeWorkflowForImport(automation.workflow || automation.config?.workflow || {})
  const feedUrls = Array.isArray(automation.feed_urls) ? automation.feed_urls.filter(isSafeUrl).slice(0, 10) : []
  return {
    name,
    description,
    type,
    category: cleanCategoryName(automation.category || ''),
    requires_approval: Boolean(automation.requires_approval),
    use_ai: Boolean(automation.use_ai),
    feed_urls: feedUrls,
    workflow,
  }
}

function sanitizeWorkflowForExport(workflow) {
  return sanitizeWorkflowForImport(dropCredentialLikeKeys(workflow || {}))
}

function sanitizeWorkflowForImport(workflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.slice(0, 100).map(sanitizeNode).filter(Boolean) : []
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = Array.isArray(workflow.edges)
    ? workflow.edges.slice(0, 200).map(sanitizeEdge).filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target))
    : []
  return { nodes, edges }
}

function sanitizeNode(node, index) {
  if (!node || typeof node !== 'object') return null
  const id = cleanTemplateString(node.id || `node-${index + 1}`, 80)
  const data = dropCredentialLikeKeys(node.data || {})
  return {
    id,
    type: node.type === 'workflowNode' ? 'workflowNode' : 'workflowNode',
    position: {
      x: safeNumber(node.position?.x, 80 + index * 24),
      y: safeNumber(node.position?.y, 80 + index * 24),
    },
    data: {
      kind: cleanTemplateString(data.kind || 'source', 40),
      label: cleanTemplateString(data.label || 'Workflow step', 80),
      description: cleanTemplateString(data.description || '', 280),
      color: cleanTemplateString(data.color || 'slate', 20),
      settings: dropCredentialLikeKeys(data.settings || {}),
    },
  }
}

function sanitizeEdge(edge) {
  if (!edge || typeof edge !== 'object') return null
  const source = cleanTemplateString(edge.source || '', 80)
  const target = cleanTemplateString(edge.target || '', 80)
  if (!source || !target) return null
  return {
    id: cleanTemplateString(edge.id || `${source}-${target}`, 120),
    source,
    target,
    type: edge.type === 'smoothstep' ? 'smoothstep' : 'smoothstep',
    animated: Boolean(edge.animated),
  }
}

function dropCredentialLikeKeys(value) {
  if (Array.isArray(value)) return value.map(dropCredentialLikeKeys).slice(0, 100)
  if (!value || typeof value !== 'object') return typeof value === 'string' ? cleanTemplateString(value, 1000) : value
  const blocked = /token|secret|password|credential|authorization|bearer|api[_-]?key|private/i
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key)).map(([key, item]) => [key, dropCredentialLikeKeys(item)]))
}

function cleanTemplateString(value, maxLength) {
  const text = String(value || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/javascript:/gi, '').replace(/\bon\w+=/gi, '').trim()
  if (/eval\s*\(|new\s+Function\s*\(|document\.cookie|localStorage|sessionStorage/i.test(text)) return ''
  return text.slice(0, maxLength)
}

function safeNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(-5000, Math.min(5000, number)) : fallback
}

function isSafeUrl(url) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
