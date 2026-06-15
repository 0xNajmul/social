import { useEffect, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, Input, PageLoader } from '../components/ui'

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['scheduled', 'Scheduled'],
  ['published', 'Published'],
  ['draft', 'Draft'],
  ['pending_approval', 'Pending approval'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
]

export default function Posts() {
  const [posts, setPosts] = useState(null)
  const [filters, setFilters] = useState({ status: '', search: '', workspace: '', author: '', from: '', to: '' })
  const [filterOpen, setFilterOpen] = useState(false)

  const load = (params) => {
    api.get('/admin/posts', { params: { ...params, per_page: 100 } }).then(({ data }) => setPosts(data.data))
  }

  useEffect(() => {
    api.get('/admin/posts', { params: { per_page: 100 } }).then(({ data }) => setPosts(data.data))
  }, [])

  const applyFilters = (event) => {
    event.preventDefault()
    load(filters)
    setFilterOpen(false)
  }

  const applySearch = (event) => {
    event.preventDefault()
    load(filters)
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
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
          <Button type="button" onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4" /> Filters
          </Button>
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-4">Post</th>
                <th className="p-4">Status</th>
                <th className="p-4">Workspace</th>
                <th className="p-4">Author</th>
                <th className="p-4">Platforms</th>
                <th className="p-4">Scheduled</th>
                <th className="p-4">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {posts.map((post) => (
                <tr key={post.id} className="text-slate-300 transition hover:bg-slate-800/35">
                  <td className="p-4"><p className="max-w-md truncate font-medium text-white">{post.title || post.content || 'Untitled post'}</p><p className="max-w-md truncate text-xs text-slate-500">{post.content}</p></td>
                  <td className="p-4"><Badge color={post.status_color}>{post.status_label}</Badge></td>
                  <td className="p-4">{post.workspace?.name || '-'}</td>
                  <td className="p-4"><p>{post.author?.name || '-'}</p><p className="text-xs text-slate-500">{post.author?.email}</p></td>
                  <td className="p-4"><div className="flex flex-wrap gap-1">{(post.variants || []).slice(0, 5).map((variant) => <Badge key={variant.id}>{variant.platform}</Badge>)}</div></td>
                  <td className="p-4 text-slate-500">{post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '-'}</td>
                  <td className="p-4 text-slate-500">{post.published_at ? new Date(post.published_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {posts.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-slate-500"><Search className="mx-auto mb-2 h-8 w-8" />No posts found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <FilterDrawer
        open={filterOpen}
        filters={filters}
        setFilters={setFilters}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
      />
    </div>
  )
}

function FilterDrawer({ open, filters, setFilters, onClose, onApply }) {
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
            <p className="mt-1 text-sm text-slate-400">Narrow posts by status, owner, workspace, and date.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onApply} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <Select label="Status" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={STATUS_OPTIONS} />
            <Input label="Search" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Title or content" />
            <Input label="Workspace" value={filters.workspace} onChange={(event) => setFilters({ ...filters, workspace: event.target.value })} placeholder="Workspace name" />
            <Input label="Author" value={filters.author} onChange={(event) => setFilters({ ...filters, author: event.target.value })} placeholder="Name or email" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="From" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
              <Input label="To" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 p-5">
            <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit"><Filter className="h-4 w-4" /> Apply filters</Button>
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
