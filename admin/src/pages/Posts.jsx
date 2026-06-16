import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Edit3, Eye, Filter, Search, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, Input, PageLoader } from '../components/ui'
import DateTimeField from '../components/DateTimeField'

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['draft', 'Draft'],
  ['pending_approval', 'Pending approval'],
  ['approved', 'Approved'],
  ['scheduled', 'Scheduled'],
  ['publishing', 'Publishing'],
  ['published', 'Published'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
]

const COLUMN_OPTIONS = [
  { key: 'post', label: 'Post' },
  { key: 'status', label: 'Status' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'author', label: 'Author' },
  { key: 'platforms', label: 'Platforms' },
  { key: 'type', label: 'Type' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'approval', label: 'Approval' },
  { key: 'variants', label: 'Variants' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
  { key: 'actions', label: 'Actions' },
]

const DEFAULT_COLUMNS = ['post', 'status', 'workspace', 'author', 'platforms', 'scheduled', 'published', 'actions']

export default function Posts() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState(null)
  const [filters, setFilters] = useState({ status: '', search: '', workspace: '', author: '', from: '', to: '' })
  const [filterOpen, setFilterOpen] = useState(false)
  const [busyPost, setBusyPost] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState(() => readColumns())

  useEffect(() => {
    localStorage.setItem('admin_posts_columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  const load = (params = filters) => (
    api.get('/admin/posts', { params: { ...params, per_page: 100 } }).then(({ data }) => setPosts(data.data))
  )

  useEffect(() => { load({ status: '', search: '', workspace: '', author: '', from: '', to: '' }) }, [])

  const enabledColumns = useMemo(() => (
    COLUMN_OPTIONS.filter((column) => visibleColumns.includes(column.key))
  ), [visibleColumns])

  const applyFilters = (event) => {
    event.preventDefault()
    load(filters)
    setFilterOpen(false)
  }

  const applySearch = (event) => {
    event.preventDefault()
    load(filters)
  }

  const toggleColumn = (key) => {
    setVisibleColumns((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((column) => column !== key)
      }

      return [...current, key]
    })
  }

  const remove = async (post, event) => {
    event.stopPropagation()
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setBusyPost(post.id)
    try {
      await api.delete(`/admin/posts/${post.id}`)
      await load(filters)
    } finally {
      setBusyPost(null)
    }
  }

  if (!posts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Posts</h1>
          <p className="mt-1 text-sm text-slate-400">View scheduled, published and draft posts across all users and workspaces.</p>
        </div>
        <form onSubmit={applySearch} className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Search posts..."
              className="pl-9 pr-9"
            />
            {filters.search && (
              <button type="button" onClick={() => setFilters({ ...filters, search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-700 hover:text-white" aria-label="Clear post search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" variant="secondary">Search</Button>
          <Button type="button" size="sm" onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4" /> Filters
          </Button>
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead className="bg-slate-800/40 uppercase tracking-wide text-slate-500">
              <tr>
                {enabledColumns.map((column) => (
                  <th key={column.key} className={clsx('px-3 py-2 font-semibold', column.key === 'actions' && 'text-right')}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {posts.map((post) => (
                <tr
                  key={post.id}
                  onClick={() => navigate(`/posts/${post.id}`)}
                  className="cursor-pointer text-slate-300 transition hover:bg-slate-800/35"
                >
                  {visibleColumns.includes('post') && (
                    <td className="px-3 py-2">
                      <p className="max-w-xs truncate font-medium text-white">{post.title || post.content || 'Untitled post'}</p>
                      <p className="max-w-xs truncate text-[11px] text-slate-500">{post.content}</p>
                    </td>
                  )}
                  {visibleColumns.includes('status') && <td className="px-3 py-2"><Badge color={post.status_color}>{post.status_label}</Badge></td>}
                  {visibleColumns.includes('workspace') && (
                    <td className="px-3 py-2">
                      <p className="max-w-[11rem] truncate text-slate-200">{post.workspace?.name || '-'}</p>
                      <p className="max-w-[11rem] truncate text-[11px] text-slate-500">{post.workspace?.slug}</p>
                    </td>
                  )}
                  {visibleColumns.includes('author') && (
                    <td className="px-3 py-2">
                      <p className="max-w-[12rem] truncate">{post.author?.name || '-'}</p>
                      <p className="max-w-[12rem] truncate text-[11px] text-slate-500">{post.author?.email}</p>
                    </td>
                  )}
                  {visibleColumns.includes('platforms') && (
                    <td className="px-3 py-2">
                      <div className="flex max-w-[12rem] flex-wrap gap-1">
                        {(post.variants || []).slice(0, 5).map((variant) => <Badge key={variant.id}>{variant.platform}</Badge>)}
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('type') && <td className="px-3 py-2 capitalize text-slate-400">{post.type || '-'}</td>}
                  {visibleColumns.includes('scheduled') && <td className="whitespace-nowrap px-3 py-2 text-slate-500">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '-'}</td>}
                  {visibleColumns.includes('published') && <td className="whitespace-nowrap px-3 py-2 text-slate-500">{post.published_at ? new Date(post.published_at).toLocaleString() : '-'}</td>}
                  {visibleColumns.includes('approval') && <td className="px-3 py-2">{post.requires_approval ? <Badge color="amber">Required</Badge> : <Badge>Not required</Badge>}</td>}
                  {visibleColumns.includes('variants') && <td className="px-3 py-2 text-slate-400">{post.variants?.length ?? 0}</td>}
                  {visibleColumns.includes('created') && <td className="whitespace-nowrap px-3 py-2 text-slate-500">{post.created_at ? new Date(post.created_at).toLocaleString() : '-'}</td>}
                  {visibleColumns.includes('updated') && <td className="whitespace-nowrap px-3 py-2 text-slate-500">{post.updated_at ? new Date(post.updated_at).toLocaleString() : '-'}</td>}
                  {visibleColumns.includes('actions') && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/posts/${post.id}`} onClick={(event) => event.stopPropagation()}>
                          <ActionIcon tone="view" label="View post"><Eye className="h-3.5 w-3.5" /></ActionIcon>
                        </Link>
                        <Link to={`/posts/${post.id}?edit=1`} onClick={(event) => event.stopPropagation()}>
                          <ActionIcon tone="edit" label="Edit post"><Edit3 className="h-3.5 w-3.5" /></ActionIcon>
                        </Link>
                        <ActionIcon tone="delete" label="Delete post" disabled={busyPost === post.id} onClick={(event) => remove(post, event)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </ActionIcon>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={enabledColumns.length} className="px-3 py-10 text-center text-slate-500">
                    <Search className="mx-auto mb-2 h-8 w-8" />No posts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <FilterDrawer
        open={filterOpen}
        filters={filters}
        setFilters={setFilters}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
      />
    </div>
  )
}

function FilterDrawer({ open, filters, setFilters, visibleColumns, toggleColumn, onClose, onApply }) {
  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  const reset = () => setFilters({ status: '', search: '', workspace: '', author: '', from: '', to: '' })

  return (
    <div className={clsx('fixed inset-0 z-50 transition', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <button type="button" className={clsx('absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} aria-label="Close filters" />
      <aside className={clsx('absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 shadow-2xl transition-transform duration-300', open ? 'translate-x-0' : 'translate-x-full')}>
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Post filters</h2>
            <p className="mt-1 text-sm text-slate-400">Narrow posts and choose which database fields appear in the table.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onApply} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="space-y-4">
              <Select label="Status" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={STATUS_OPTIONS} />
              <Input label="Search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Title or content" />
              <Input label="Workspace" value={filters.workspace} onChange={(event) => setFilters({ ...filters, workspace: event.target.value })} placeholder="Workspace name or slug" />
              <Input label="Author" value={filters.author} onChange={(event) => setFilters({ ...filters, author: event.target.value })} placeholder="Name or email" />
              <div className="grid gap-3 sm:grid-cols-2">
                <DateTimeField label="From" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                <DateTimeField label="To" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold text-white">Table columns</h3>
              <p className="mt-1 text-xs text-slate-500">Show or hide post fields from the database.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {COLUMN_OPTIONS.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                      className="h-3.5 w-3.5 rounded border-slate-600 text-brand-600"
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 p-5">
            <Button type="button" size="sm" variant="ghost" onClick={reset}>Reset</Button>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm"><Filter className="h-4 w-4" /> Apply filters</Button>
            </div>
          </div>
        </form>
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

function ActionIcon({ tone, label, children, ...props }) {
  const tones = {
    view: 'border-sky-800/60 bg-sky-950/50 text-sky-300 hover:bg-sky-900/70',
    edit: 'border-amber-800/60 bg-amber-950/50 text-amber-300 hover:bg-amber-900/70',
    delete: 'border-rose-800/60 bg-rose-950/50 text-rose-300 hover:bg-rose-900/70 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600',
  }

  return (
    <button
      type="button"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  )
}

function readColumns() {
  try {
    const parsed = JSON.parse(localStorage.getItem('admin_posts_columns') || 'null')
    const allowed = COLUMN_OPTIONS.map((column) => column.key)
    const filtered = Array.isArray(parsed) ? parsed.filter((column) => allowed.includes(column)) : []
    return filtered.length ? filtered : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}
