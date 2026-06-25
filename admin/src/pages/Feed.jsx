import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Filter, Plus, RefreshCw, Rss, Search, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader } from '../components/ui'

const INITIAL_FORM = { workspace_id: '', title: '', url: '', country: 'Global', category: 'News', status: 'active', description: '' }
const INITIAL_FILTERS = { search: '', country: '', category: '', status: '', workspace_id: '' }

export default function Feed() {
  const [feeds, setFeeds] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyFeedId, setBusyFeedId] = useState(null)
  const [error, setError] = useState('')

  const loadFeeds = useCallback(() => {
    return api.get('/admin/feeds', {
      params: {
        per_page: 100,
        search: filters.search || undefined,
        country: filters.country || undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
        workspace_id: filters.workspace_id || undefined,
      },
    })
      .then(({ data }) => setFeeds(data.data || []))
      .catch((loadError) => {
        setFeeds([])
        setError(loadError.response?.data?.message || 'Could not load feeds.')
      })
  }, [filters])

  const loadWorkspaces = useCallback(() => {
    api.get('/admin/workspaces', { params: { per_page: 100 } })
      .then(({ data }) => setWorkspaces(data.data || []))
      .catch(() => setWorkspaces([]))
  }, [])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  useEffect(() => {
    const timer = window.setTimeout(loadFeeds, 200)
    return () => window.clearTimeout(timer)
  }, [loadFeeds])

  const countries = useMemo(() => unique((feeds || []).map((feed) => feed.country)), [feeds])
  const categories = useMemo(() => unique((feeds || []).map((feed) => feed.category)), [feeds])

  const saveFeed = async (payload) => {
    setError('')
    const request = payload.id
      ? api.put(`/admin/feeds/${payload.id}`, payload)
      : api.post('/admin/feeds', payload)
    await request
    setEditing(null)
    await loadFeeds()
  }

  const refreshFeed = async (feed) => {
    setBusyFeedId(feed.id)
    setError('')
    try {
      await api.post(`/admin/feeds/${feed.id}/refresh`)
      await loadFeeds()
    } catch (refreshError) {
      setError(refreshError.response?.data?.message || 'Could not refresh this feed.')
    } finally {
      setBusyFeedId(null)
    }
  }

  const deleteFeed = async (feed) => {
    if (!window.confirm(`Delete ${feed.title || feed.url}? This also deletes saved feed items.`)) return
    setBusyFeedId(feed.id)
    setError('')
    try {
      await api.delete(`/admin/feeds/${feed.id}`)
      await loadFeeds()
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || 'Could not delete this feed.')
    } finally {
      setBusyFeedId(null)
    }
  }

  if (feeds === null) return <PageLoader />

  const activeFilterCount = ['country', 'category', 'status', 'workspace_id'].filter((key) => filters[key]).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feed</h1>
          <p className="mt-1 text-sm text-slate-400">Manage real RSS feeds used for workspace content discovery.</p>
        </div>
        <form onSubmit={(event) => event.preventDefault()} className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Search feeds or workspaces..."
              className="pl-9 pr-9"
            />
            {filters.search && (
              <button type="button" onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-700 hover:text-white" aria-label="Clear feed search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="button" size="sm" variant={activeFilterCount ? 'primary' : 'secondary'} onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4" /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          <Button type="button" size="sm" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" /> New feed
          </Button>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm font-medium text-rose-300">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-800/40 uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Feed</th>
                <th className="px-3 py-2 font-semibold">Workspace</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Items</th>
                <th className="px-3 py-2 font-semibold">Fetched</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {feeds.map((feed) => (
                <tr key={feed.id} className="text-slate-300 transition hover:bg-slate-800/35">
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setEditing(feed)} className="flex max-w-xl items-center gap-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300"><Rss className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-white">{feed.title || feed.url}</span>
                        <span className="block truncate text-[11px] text-slate-500">{feed.url}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{feed.workspace?.name || `Workspace #${feed.workspace_id}`}</td>
                  <td className="px-3 py-2"><Badge color="sky">{feed.category || 'General'}</Badge></td>
                  <td className="px-3 py-2"><Badge>{feed.country || 'Global'}</Badge></td>
                  <td className="px-3 py-2"><Badge color={feed.status === 'active' ? 'emerald' : 'gray'}>{feed.status === 'active' ? 'Active' : 'Paused'}</Badge></td>
                  <td className="px-3 py-2 text-slate-400">{feed.items_count ?? 0}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{feed.last_fetched_at ? new Date(feed.last_fetched_at).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <IconButton label="Refresh feed" disabled={busyFeedId === feed.id || feed.status !== 'active'} onClick={() => refreshFeed(feed)}>
                        <RefreshCw className={clsx('h-3.5 w-3.5', busyFeedId === feed.id && 'animate-spin')} />
                      </IconButton>
                      <IconButton label="Edit feed" onClick={() => setEditing(feed)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Delete feed" tone="danger" disabled={busyFeedId === feed.id} onClick={() => deleteFeed(feed)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {feeds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    <Search className="mx-auto mb-2 h-8 w-8" />No feeds found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <FeedEditorModal key={editing?.id || (editing ? 'new' : 'closed')} feed={editing} workspaces={workspaces} onClose={() => setEditing(null)} onSave={saveFeed} />
      <FilterDrawer
        categories={categories}
        countries={countries}
        workspaces={workspaces}
        filters={filters}
        open={filterOpen}
        setFilters={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  )
}

function IconButton({ label, tone = 'default', children, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'border-rose-800/60 bg-rose-950/50 text-rose-300 hover:bg-rose-900/70'
          : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700',
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function FeedEditorModal({ feed, workspaces, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    ...(feed || {}),
    workspace_id: feed?.workspace_id || workspaces[0]?.id || '',
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
        workspace_id: Number(form.workspace_id),
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
    <Modal open={Boolean(feed)} title={feed.id ? 'Edit feed' : 'New feed'} description="Add a real RSS or Atom feed to a workspace." onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4 p-5">
        {error && <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">{error}</div>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Workspace</span>
          <select value={form.workspace_id} onChange={(event) => setForm({ ...form, workspace_id: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" required>
            <option value="" disabled>Select workspace</option>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </label>
        <Input label="Feed name" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="TechCrunch" />
        <Input label="Feed URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com/feed.xml" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Country" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} placeholder="Global" />
          <Input label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="News" />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">Status</span>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save feed</Button>
        </div>
      </form>
    </Modal>
  )
}

function FilterDrawer({ categories, countries, workspaces, filters, open, setFilters, onClose }) {
  return (
    <div className={clsx('fixed inset-0 z-50 transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button type="button" className={clsx('absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} aria-label="Close filters" />
      <aside className={clsx('absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-800 bg-slate-900 shadow-2xl transition-transform duration-300', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Feed filters</h2>
            <p className="mt-1 text-sm text-slate-400">Narrow admin feed records.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <Select label="Workspace" value={filters.workspace_id} onChange={(value) => setFilters({ ...filters, workspace_id: value })} options={[['', 'All workspaces'], ...workspaces.map((workspace) => [String(workspace.id), workspace.name])]} />
          <Select label="Status" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={[['', 'All statuses'], ['active', 'Active'], ['paused', 'Paused']]} />
          <Select label="Country" value={filters.country} onChange={(value) => setFilters({ ...filters, country: value })} options={[['', 'All countries'], ...countries.map((value) => [value, value])]} />
          <Select label="Category" value={filters.category} onChange={(value) => setFilters({ ...filters, category: value })} options={[['', 'All categories'], ...categories.map((value) => [value, value])]} />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-800 p-5">
          <Button type="button" size="sm" variant="ghost" onClick={() => setFilters(INITIAL_FILTERS)}>Reset</Button>
          <Button type="button" size="sm" onClick={onClose}><Filter className="h-4 w-4" /> Apply filters</Button>
        </div>
      </aside>
    </div>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30">
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  )
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
