import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Edit3, Grid3X3, ListFilter, Plus, RefreshCw, Rss, Search, Table2, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, ConfirmDialog, EmptyState, Modal, PageLoader } from '../components/ui'
import FeedItemModal from '../components/feed/FeedItemModal'
import usePageSize from '../hooks/usePageSize'

const PREBUILT_FEEDS = [
  { title: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', country: 'Global', category: 'News' },
  { title: 'TechCrunch', url: 'https://techcrunch.com/feed/', country: 'US', category: 'Technology' },
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', country: 'US', category: 'Technology' },
  { title: 'Google Trends', url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US', country: 'US', category: 'Trends' },
  { title: 'Guardian Business', url: 'https://www.theguardian.com/uk/business/rss', country: 'UK', category: 'Business' },
  { title: 'bdnews24', url: 'https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true', country: 'Bangladesh', category: 'News' },
]

const INITIAL_FILTERS = { search: '', country: 'all', category: 'all', feed_id: 'all' }
const FEED_FREQUENCIES = [
  ['manual', 'Manual refresh'],
  ['5', 'Every 5 minutes'],
  ['15', 'Every 15 minutes'],
  ['30', 'Every 30 minutes'],
  ['60', 'Every hour'],
]
const FEED_ITEM_LIMITS = [
  ['10', 'Latest 10'],
  ['25', 'Latest 25'],
  ['50', 'Latest 50'],
  ['100', 'Latest 100'],
]

export default function Feed() {
  const configuredFeedItemLimit = usePageSize('feed_items', 20)
  const [feeds, setFeeds] = useState(null)
  const [items, setItems] = useState(null)
  const [itemMeta, setItemMeta] = useState(null)
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [feedItemLimit, setFeedItemLimit] = useState(() => localStorage.getItem('postflow_feed_item_limit') || '25')
  const [view, setView] = useState(() => localStorage.getItem('postflow_feed_view') || 'card')
  const [fetchFrequency, setFetchFrequency] = useState(() => localStorage.getItem('postflow_feed_fetch_frequency') || 'manual')
  const [menuOpen, setMenuOpen] = useState(false)
  const [prebuiltOpen, setPrebuiltOpen] = useState(false)
  const [editorFeed, setEditorFeed] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busyFeedId, setBusyFeedId] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [error, setError] = useState('')
  const menuRef = useRef(null)
  const loadMoreRef = useRef(null)

  const loadFeeds = useCallback(() => {
    return api.get('/feeds')
      .then(({ data }) => setFeeds(data.data || []))
      .catch((loadError) => {
        setFeeds([])
        setError(loadError.response?.data?.message || 'Could not load feed sources.')
      })
  }, [])

  const loadItems = useCallback((extra = {}) => {
    const { append = false, page = 1, ...requestParams } = extra
    if (append) {
      setLoadingMore(true)
    } else {
      setItems((current) => current ?? null)
    }

    return api.get('/feed/items', {
      params: {
        per_page: Number(feedItemLimit),
        page,
        search: filters.search || undefined,
        feed_id: filters.feed_id !== 'all' ? filters.feed_id : undefined,
        country: filters.country !== 'all' ? filters.country : undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        ...requestParams,
      },
    })
      .then(({ data }) => {
        const nextItems = data.data || []
        setItems((current) => append ? [...(current || []), ...nextItems] : nextItems)
        setItemMeta(data.meta || null)
      })
      .catch((loadError) => {
        setItems([])
        setItemMeta(null)
        setError(loadError.response?.data?.message || 'Could not load feed items.')
      })
      .finally(() => {
        if (append) setLoadingMore(false)
      })
  }, [feedItemLimit, filters.category, filters.country, filters.feed_id, filters.search])

  useEffect(() => {
    loadFeeds()
  }, [loadFeeds])

  useEffect(() => {
    if (localStorage.getItem('postflow_feed_item_limit')) return
    const timer = window.setTimeout(() => setFeedItemLimit(String(configuredFeedItemLimit)), 0)
    return () => window.clearTimeout(timer)
  }, [configuredFeedItemLimit])

  useEffect(() => {
    localStorage.setItem('postflow_feed_view', view)
  }, [view])

  useEffect(() => {
    localStorage.setItem('postflow_feed_item_limit', feedItemLimit)
  }, [feedItemLimit])

  useEffect(() => {
    localStorage.setItem('postflow_feed_fetch_frequency', fetchFrequency)
    if (fetchFrequency === 'manual') return undefined
    const minutes = Number(fetchFrequency)
    if (!Number.isFinite(minutes) || minutes <= 0) return undefined
    const interval = window.setInterval(() => {
      loadItems({ refresh: 1 })
      loadFeeds()
    }, minutes * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [fetchFrequency, loadFeeds, loadItems])

  useEffect(() => {
    if (feeds === null) return undefined
    const timer = window.setTimeout(() => {
      loadItems()
    }, 200)
    return () => window.clearTimeout(timer)
  }, [feeds, loadItems])

  useEffect(() => {
    if (!menuOpen) return undefined
    const closeOnOutside = (event) => {
      if (menuRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  const countries = useMemo(() => uniqueOptions((feeds || []).map((feed) => feed.country)), [feeds])
  const categories = useMemo(() => uniqueOptions((feeds || []).map((feed) => feed.category)), [feeds])
  const feedItemLimitOptions = useMemo(() => {
    const configured = String(configuredFeedItemLimit)
    if (FEED_ITEM_LIMITS.some(([value]) => value === configured)) return FEED_ITEM_LIMITS
    return [[configured, `Latest ${configured}`], ...FEED_ITEM_LIMITS].sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [configuredFeedItemLimit])
  const hasMoreItems = Boolean(itemMeta && itemMeta.current_page < itemMeta.last_page)
  const shownItemCount = items?.length || 0
  const totalItemCount = itemMeta?.total ?? shownItemCount

  const loadMoreItems = useCallback(() => {
    if (!hasMoreItems || loadingMore) return
    loadItems({ page: itemMeta.current_page + 1, append: true })
  }, [hasMoreItems, itemMeta, loadItems, loadingMore])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasMoreItems || loadingMore) return undefined

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreItems()
    }, { rootMargin: '420px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMoreItems, loadMoreItems, loadingMore])

  const saveFeed = async (payload) => {
    setError('')
    const request = payload.id
      ? api.put(`/feeds/${payload.id}`, payload)
      : api.post('/feeds', payload)
    await request
    setEditorFeed(null)
    await loadFeeds()
    await loadItems({ refresh: payload.status === 'active' ? 1 : undefined })
  }

  const addPrebuilt = async (feed) => {
    setBusyFeedId(feed.url)
    setError('')
    try {
      await api.post('/feeds', { ...feed, status: 'active' })
      await loadFeeds()
      await loadItems({ refresh: 1 })
    } catch (addError) {
      setError(addError.response?.data?.message || 'Could not add this feed.')
    } finally {
      setBusyFeedId(null)
    }
  }

  const refreshFeed = async (feed) => {
    setBusyFeedId(feed.id)
    setError('')
    try {
      await api.post(`/feeds/${feed.id}/refresh`)
      await loadFeeds()
      await loadItems()
    } catch (refreshError) {
      setError(refreshError.response?.data?.message || 'Could not refresh this feed.')
    } finally {
      setBusyFeedId(null)
    }
  }

  const refreshAll = async () => {
    setRefreshingAll(true)
    setError('')
    try {
      await loadItems({ refresh: 1 })
      await loadFeeds()
    } finally {
      setRefreshingAll(false)
    }
  }

  const deleteFeed = async () => {
    if (!confirmDelete) return
    setBusyFeedId(confirmDelete.id)
    try {
      await api.delete(`/feeds/${confirmDelete.id}`)
      if (String(filters.feed_id) === String(confirmDelete.id)) {
        setFilters((current) => ({ ...current, feed_id: 'all' }))
      }
      setConfirmDelete(null)
      await loadFeeds()
      await loadItems()
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete this feed.')
    } finally {
      setBusyFeedId(null)
    }
  }

  if (feeds === null) return <PageLoader />

  const installedUrls = new Set(feeds.map((feed) => feed.url))
  const activeFilters = filters.country !== 'all' || filters.category !== 'all' || filters.feed_id !== 'all' || fetchFrequency !== 'manual'

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Feed</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track real RSS stories and ideas for planning content.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={refreshAll} loading={refreshingAll}>
            <RefreshCw className={clsx('h-4 w-4', refreshingAll && 'animate-spin')} /> Refresh
          </Button>
          <div ref={menuRef} className="relative">
            <Button type="button" onClick={() => setMenuOpen((value) => !value)}>
              <Plus className="h-4 w-4" /> New feed <ChevronDown className={clsx('h-4 w-4 transition', menuOpen && 'rotate-180')} />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 z-[150] mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <button type="button" onClick={() => { setPrebuiltOpen(true); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Rss className="h-4 w-4" /> Add prebuilt feed
                </button>
                <button type="button" onClick={() => { setEditorFeed({}); setMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Plus className="h-4 w-4" /> Add custom
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Search feed stories..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {filters.search && <button type="button" onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear feed search"><X className="h-4 w-4" /></button>}
          </div>
          <select value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="all">All countries</option>
            {countries.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="all">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={feedItemLimit} onChange={(event) => setFeedItemLimit(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" aria-label="Number of latest feed items">
            {feedItemLimitOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50 xl:self-auto">
            <FeedIconButton active={view === 'card'} onClick={() => setView('card')} icon={Grid3X3} label="Card view" />
            <FeedIconButton active={view === 'table'} onClick={() => setView('table')} icon={Table2} label="Table view" />
            <FeedIconButton active={activeFilters} onClick={() => setFilterOpen(true)} icon={ListFilter} label="Filters" />
          </div>
        </div>

        {items === null ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">Loading feed items...</div>
        ) : feeds.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Rss}
              title="No feed sources yet"
              description="Add a prebuilt or custom RSS feed to start collecting real stories."
              action={<Button type="button" onClick={() => setPrebuiltOpen(true)}>Add prebuilt feed</Button>}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-slate-800 dark:text-slate-100">No feed items found</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Refresh your sources or adjust the search and filters.</p>
          </div>
        ) : view === 'table' ? (
          <FeedTable items={items} onOpen={setSelectedItem} />
        ) : (
          <div className="columns-1 gap-4 p-4 md:columns-2 xl:columns-3">
            {items.map((item) => <FeedCard key={item.id} item={item} onOpen={setSelectedItem} />)}
          </div>
        )}
        {items !== null && items.length > 0 && (
          <div ref={loadMoreRef} className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 text-xs font-semibold text-slate-400 dark:border-slate-800 sm:flex-row">
            <span>Showing {shownItemCount} of {totalItemCount} latest feed item{totalItemCount === 1 ? '' : 's'}</span>
            {hasMoreItems && (
              <Button type="button" size="sm" variant="secondary" loading={loadingMore} onClick={loadMoreItems}>
                <ChevronDown className="h-4 w-4" /> Load more
              </Button>
            )}
          </div>
        )}
      </Card>

      <PrebuiltFeedModal
        open={prebuiltOpen}
        feeds={feeds}
        installedUrls={installedUrls}
        busyFeedId={busyFeedId}
        onClose={() => setPrebuiltOpen(false)}
        onAdd={addPrebuilt}
        onDelete={(feed) => { setConfirmDelete(feed); setPrebuiltOpen(false) }}
        onEdit={(feed) => { setEditorFeed(feed); setPrebuiltOpen(false) }}
        onRefresh={refreshFeed}
      />
      <FeedEditorModal key={editorFeed?.id || (editorFeed ? 'new' : 'closed')} feed={editorFeed} onClose={() => setEditorFeed(null)} onSave={saveFeed} />
      <FeedFilterDrawer
        open={filterOpen}
        filters={filters}
        feeds={feeds}
        countries={countries}
        categories={categories}
        fetchFrequency={fetchFrequency}
        busyFeedId={busyFeedId}
        setFilters={setFilters}
        setFetchFrequency={setFetchFrequency}
        onClose={() => setFilterOpen(false)}
        onDelete={(feed) => { setConfirmDelete(feed); setFilterOpen(false) }}
        onEdit={(feed) => { setEditorFeed(feed); setFilterOpen(false) }}
        onRefresh={refreshFeed}
        onRefreshAll={refreshAll}
        refreshingAll={refreshingAll}
      />
      <FeedItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete feed"
        description={`Delete "${confirmDelete?.title || 'this feed'}" and its saved items?`}
        confirmLabel="Delete feed"
        loading={busyFeedId === confirmDelete?.id}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteFeed}
      />
    </div>
  )
}

function ConnectedFeedsPanel({ feeds, busyFeedId, onEdit, onRefresh, onDelete }) {
  return (
    <section className="grid gap-3">
      {feeds.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No feed sources connected yet.
        </div>
      )}
      {feeds.map((feed) => (
        <article key={feed.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge color={feed.status === 'active' ? 'emerald' : 'gray'}>{feed.status === 'active' ? 'Active' : 'Paused'}</Badge>
                <Badge color="sky">{feed.category || 'General'}</Badge>
                <Badge>{feed.country || 'Global'}</Badge>
              </div>
              <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">{feed.title || feed.url}</h2>
              <p className="mt-1 truncate text-xs text-slate-400">{feed.url}</p>
            </div>
            <Rss className="h-5 w-5 shrink-0 text-brand-500" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>{feed.items_count ?? 0} items</span>
            <span>{feed.last_fetched_at ? `Fetched ${formatDate(feed.last_fetched_at)}` : 'Not fetched yet'}</span>
          </div>
          <div className="mt-3 flex justify-end gap-1.5">
            <SourceIconButton label="Refresh feed" disabled={busyFeedId === feed.id || feed.status !== 'active'} onClick={() => onRefresh(feed)}><RefreshCw className={clsx('h-3.5 w-3.5', busyFeedId === feed.id && 'animate-spin')} /></SourceIconButton>
            <SourceIconButton label="Edit feed" onClick={() => onEdit(feed)}><Edit3 className="h-3.5 w-3.5" /></SourceIconButton>
            <SourceIconButton label="Delete feed" tone="danger" onClick={() => onDelete(feed)}><Trash2 className="h-3.5 w-3.5" /></SourceIconButton>
          </div>
        </article>
      ))}
    </section>
  )
}

function SourceIconButton({ label, tone = 'default', children, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function FeedIconButton({ active, icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={clsx('rounded-lg p-2 transition', active ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white')}>
      <Icon className="h-4 w-4" />
    </button>
  )
}

function FeedCard({ item, onOpen }) {
  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <button type="button" onClick={() => onOpen(item)} className="block w-full p-4 text-left">
        {item.image_url && <img src={item.image_url} alt="" className="mb-4 h-36 w-full rounded-xl object-cover" />}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge color="sky">{item.category || 'General'}</Badge>
          <Badge>{item.country || 'Global'}</Badge>
        </div>
        <h2 className="line-clamp-3 text-sm font-bold leading-6 text-slate-900 dark:text-white">{item.title || 'Untitled story'}</h2>
        <p className="mt-3 line-clamp-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.summary || 'No summary available.'}</p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-medium text-slate-400">
          <span className="truncate">{item.source || item.feed?.title || 'RSS feed'}</span>
          <span className="whitespace-nowrap">{formatDate(item.published_at || item.created_at)}</span>
        </div>
      </button>
    </article>
  )
}

function FeedTable({ items, onOpen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Story</th>
            <th className="px-5 py-3 font-semibold">Source</th>
            <th className="px-5 py-3 font-semibold">Category</th>
            <th className="px-5 py-3 font-semibold">Country</th>
            <th className="px-5 py-3 font-semibold">Published</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <tr key={item.id} onClick={() => onOpen(item)} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="max-w-xl px-5 py-4"><span className="font-semibold text-slate-900 dark:text-white">{item.title || 'Untitled story'}</span><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.summary}</p></td>
              <td className="px-5 py-4 text-slate-500">{item.source || item.feed?.title || 'RSS feed'}</td>
              <td className="px-5 py-4"><Badge color="sky">{item.category || 'General'}</Badge></td>
              <td className="px-5 py-4"><Badge>{item.country || 'Global'}</Badge></td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(item.published_at || item.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PrebuiltFeedModal({ open, feeds, installedUrls, busyFeedId, onClose, onAdd, onDelete, onEdit, onRefresh }) {
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('all')
  const [category, setCategory] = useState('all')
  const countries = uniqueOptions(PREBUILT_FEEDS.map((feed) => feed.country))
  const categories = uniqueOptions(PREBUILT_FEEDS.map((feed) => feed.category))
  const query = search.trim().toLowerCase()
  const visibleFeeds = PREBUILT_FEEDS
    .filter((feed) => !query || `${feed.title} ${feed.url} ${feed.country} ${feed.category}`.toLowerCase().includes(query))
    .filter((feed) => country === 'all' || feed.country === country)
    .filter((feed) => category === 'all' || feed.category === category)

  return (
    <Modal open={open} title="Add feed" description="Choose a curated source or manage saved prebuilt feeds from the same list." onClose={onClose} size="lg">
      <div className="space-y-4 p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search prebuilt feeds..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={country} onChange={(event) => setCountry(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="all">All countries</option>
            {countries.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="all">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleFeeds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 sm:col-span-2">No prebuilt feeds match your search.</div>
          ) : visibleFeeds.map((feed) => {
            const installed = installedUrls.has(feed.url)
            const savedFeed = feeds.find((item) => item.url === feed.url)
            return (
              <div key={feed.url} className={clsx('rounded-2xl border p-4 transition', installed ? 'border-brand-200 bg-brand-50/30 dark:border-brand-900/60 dark:bg-brand-950/20' : 'border-slate-200 dark:border-slate-800')}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge color="sky">{feed.category}</Badge>
                  <Badge>{feed.country}</Badge>
                  {installed && <Badge color={savedFeed?.status === 'active' ? 'emerald' : 'gray'}>{savedFeed?.status === 'active' ? 'Active' : 'Paused'}</Badge>}
                </div>
                <p className="font-semibold text-slate-900 dark:text-white">{savedFeed?.title || feed.title}</p>
                <p className="mt-1 truncate text-xs text-slate-400">{feed.url}</p>
                {installed && savedFeed ? (
                  <>
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      <span>{savedFeed.items_count ?? 0} fetched</span>
                      <span>{savedFeed.last_fetched_at ? `Fetched ${formatDate(savedFeed.last_fetched_at)}` : 'Not fetched yet'}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <PrebuiltFeedAction label="Edit" onClick={() => onEdit(savedFeed)}><Edit3 className="h-3.5 w-3.5" /></PrebuiltFeedAction>
                      <PrebuiltFeedAction label="Reload" disabled={busyFeedId === savedFeed.id || savedFeed.status !== 'active'} onClick={() => onRefresh(savedFeed)}><RefreshCw className={clsx('h-3.5 w-3.5', busyFeedId === savedFeed.id && 'animate-spin')} /></PrebuiltFeedAction>
                      <PrebuiltFeedAction label="Delete" tone="danger" onClick={() => onDelete(savedFeed)}><Trash2 className="h-3.5 w-3.5" /></PrebuiltFeedAction>
                    </div>
                  </>
                ) : (
                  <Button className="mt-3 w-full" size="sm" loading={busyFeedId === feed.url} disabled={busyFeedId === feed.url} onClick={() => onAdd(feed)}>
                    Add feed
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

function PrebuiltFeedAction({ label, tone = 'default', children, ...props }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
      aria-label={`${label} feed`}
      title={`${label} feed`}
      {...props}
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  )
}

function FeedEditorModal({ feed, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: feed?.id,
    title: feed?.title || '',
    url: feed?.url || '',
    country: feed?.country || 'Global',
    category: feed?.category || 'General',
    status: feed?.status || 'active',
    description: feed?.description || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (!feed) return null

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        title: form.title.trim() || null,
        url: form.url.trim(),
        country: form.country.trim() || 'Global',
        category: form.category.trim() || 'General',
      })
    } catch (saveError) {
      setError(saveError.response?.data?.message || 'Could not save this feed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={Boolean(feed)} title={feed.id ? 'Edit feed' : 'Add custom feed'} description="Save a real RSS or Atom source to this workspace." onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4 p-5">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{error}</div>}
        <Field label="Feed name" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="TechCrunch" />
        <Field label="Feed URL" value={form.url} onChange={(value) => setForm({ ...form, url: value })} placeholder="https://example.com/feed.xml" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country" value={form.country} onChange={(value) => setForm({ ...form, country: value })} placeholder="Global" />
          <Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} placeholder="News" />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save feed</Button>
        </div>
      </form>
    </Modal>
  )
}

function FeedFilterDrawer({
  open,
  filters,
  feeds,
  countries,
  categories,
  fetchFrequency,
  busyFeedId,
  setFilters,
  setFetchFrequency,
  onClose,
  onDelete,
  onEdit,
  onRefresh,
  onRefreshAll,
  refreshingAll,
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
      <button type="button" className={clsx('absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} aria-label="Close feed filters" />
      <aside className={clsx('absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Feed filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Choose sources, refresh cadence, and story metadata.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close feed filters">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <Select label="Feed source" value={filters.feed_id} onChange={(value) => setFilters({ ...filters, feed_id: value })} options={[['all', 'All connected feeds'], ...feeds.map((feed) => [String(feed.id), feed.title || feed.url])]} />
          <Select label="Country" value={filters.country} onChange={(value) => setFilters({ ...filters, country: value })} options={[['all', 'All countries'], ...countries.map((value) => [value, value])]} />
          <Select label="Category" value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={[['all', 'All categories'], ...categories.map((value) => [value, value])]} />
          <Select label="Fetch frequency" value={fetchFrequency} onChange={setFetchFrequency} options={FEED_FREQUENCIES} />
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Connected feeds</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Delete, edit, or fetch the RSS sources used here.</p>
              </div>
              <Button type="button" size="sm" variant="secondary" loading={refreshingAll} onClick={onRefreshAll}>
                <RefreshCw className={clsx('h-3.5 w-3.5', refreshingAll && 'animate-spin')} /> Fetch
              </Button>
            </div>
            <ConnectedFeedsPanel feeds={feeds} busyFeedId={busyFeedId} onDelete={onDelete} onEdit={onEdit} onRefresh={onRefresh} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-5 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={() => { setFilters({ ...filters, feed_id: 'all', country: 'all', category: 'all' }); setFetchFrequency('manual') }}>Reset</Button>
          <Button type="button" onClick={onClose}><ListFilter className="h-4 w-4" /> Apply filters</Button>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" {...props} />
    </label>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  )
}

function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString()
}
