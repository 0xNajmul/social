import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Edit3, Eye, FileText, Image as ImageIcon, Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader, Textarea } from '../components/ui'

const EMPTY = {
  title: '',
  slug: '',
  summary: '',
  author: '',
  body: '',
  category: '',
  hero_image_url: '',
  hero_image_file: null,
  status: 'draft',
  published_at: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
}

export default function News() {
  const [posts, setPosts] = useState(null)
  const [meta, setMeta] = useState({})
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', category: '', page: 1 })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filePreview, setFilePreview] = useState('')

  const load = async () => {
    const params = {
      search: filters.search || undefined,
      status: filters.status || undefined,
      category: filters.category || undefined,
      page: filters.page,
      per_page: 12,
    }
    const { data } = await api.get('/admin/news', { params })
    setPosts(data.data || [])
    setMeta(data.meta || {})
    setCategories(data.filters?.categories || [])
  }

  useEffect(() => {
    load().catch(() => {
      setPosts([])
      setMessage({ type: 'error', text: 'Could not load news posts.' })
    })
  }, [filters])

  useEffect(() => {
    if (!form.hero_image_file) {
      setFilePreview('')
      return undefined
    }

    const url = URL.createObjectURL(form.hero_image_file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [form.hero_image_file])

  const stats = useMemo(() => ({
    published: posts?.filter((post) => post.status === 'published').length || 0,
    draft: posts?.filter((post) => post.status === 'draft').length || 0,
  }), [posts])
  const heroPreview = filePreview || form.hero_image_url

  const openCreate = () => {
    setEditing('new')
    setForm({ ...EMPTY, author: 'Postflow Team' })
    setErrors({})
  }

  const openEdit = (post) => {
    setEditing(post)
    setForm({
      title: post.title || '',
      slug: post.slug || '',
      summary: post.summary || '',
      author: post.author || '',
      body: post.body || '',
      category: post.category || '',
      hero_image_url: post.hero_image_url || '',
      hero_image_file: null,
      status: post.status || 'draft',
      published_at: post.published_at ? toDateTimeLocal(post.published_at) : '',
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || '',
      meta_keywords: (post.meta_keywords || []).join(', '),
    })
    setErrors({})
  }

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage(null)
    try {
      const data = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'hero_image_file') return
        data.append(key, value ?? '')
      })
      if (form.hero_image_file) data.append('hero_image', form.hero_image_file)

      if (editing === 'new') {
        await api.post('/admin/news', data)
      } else {
        data.append('_method', 'PUT')
        await api.post(`/admin/news/${editing.slug}`, data)
      }

      setMessage({ type: 'success', text: editing === 'new' ? 'News post created.' : 'News post updated.' })
      setEditing(null)
      await load()
    } catch (error) {
      setErrors(error.response?.data?.errors || {})
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save news post.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (post) => {
    setBusy(true)
    try {
      await api.delete(`/admin/news/${post.slug}`)
      setMessage({ type: 'success', text: 'News post deleted.' })
      setConfirmDelete(null)
      await load()
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete news post.' })
    } finally {
      setBusy(false)
    }
  }

  if (!posts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">News</h1>
          <p className="mt-1 text-sm text-slate-400">Create public news, announcements, changelogs, and SEO-ready articles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Stat label="Published" value={stats.published} />
          <Stat label="Drafts" value={stats.draft} />
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add news</Button>
        </div>
      </div>

      {message && <Notice message={message} />}

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
              placeholder="Search title, summary, author, or category"
              className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <Select value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value, page: 1 }))} options={[['', 'All statuses'], ['published', 'Published'], ['draft', 'Draft']]} />
          <Select value={filters.category} onChange={(value) => setFilters((current) => ({ ...current, category: value, page: 1 }))} options={[['', 'All categories'], ...categories.map((category) => [category, category])]} />
          <Button type="button" variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.id} className="flex flex-col overflow-hidden">
            <div className="aspect-[16/9] bg-slate-950">
              {post.hero_image_url ? <img src={post.hero_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-600"><ImageIcon className="h-10 w-10" /></div>}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">{post.category || 'News'}</p>
                  <h2 className="mt-1 line-clamp-2 text-lg font-bold text-white">{post.title}</h2>
                </div>
                <Badge color={post.status === 'published' ? 'emerald' : 'amber'}>{post.status}</Badge>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{post.summary || post.body}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Not published'}</span>
                <span>{post.author || 'No author'}</span>
              </div>
              <div className="mt-5 flex gap-2 border-t border-slate-800 pt-4">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(post)}><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
                <a href={userPublicUrl(`/news/${post.slug}`)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"><Eye className="h-3.5 w-3.5" /></a>
                <Button size="sm" variant="ghost" className="text-rose-400 hover:bg-rose-950/30" onClick={() => setConfirmDelete(post)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-500" />
          <h2 className="mt-3 text-lg font-semibold text-white">No news posts yet</h2>
          <p className="mt-1 text-sm text-slate-400">Create the first public update for your homepage news section.</p>
          <Button className="mt-5" onClick={openCreate}><Plus className="h-4 w-4" /> Add news</Button>
        </Card>
      )}

      {meta.last_page > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button>
          <span className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-400">Page {meta.current_page} of {meta.last_page}</span>
          <Button variant="secondary" disabled={filters.page >= meta.last_page} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</Button>
        </div>
      )}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Create news' : `Edit ${editing?.title || 'news'}`} description="Draft, preview, and publish public news from one editor." onClose={() => setEditing(null)} size="xl">
        <form onSubmit={save} className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="News title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} error={errors.title?.[0]} required />
              <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} placeholder="auto-generated" error={errors.slug?.[0]} />
              <Textarea label="Summary" value={form.summary} rows={3} onChange={(event) => setForm({ ...form, summary: event.target.value })} error={errors.summary?.[0]} className="sm:col-span-2" />
              <Input label="Author" value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} />
              <Input label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Product updates" />
              <Textarea label="News details" value={form.body} rows={10} onChange={(event) => setForm({ ...form, body: event.target.value })} error={errors.body?.[0]} className="sm:col-span-2" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Hero image URL" value={form.hero_image_url} onChange={(event) => setForm({ ...form, hero_image_url: event.target.value })} error={errors.hero_image_url?.[0]} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">Upload hero image</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setForm({ ...form, hero_image_file: event.target.files?.[0] || null })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-slate-100" />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[['draft', 'Draft'], ['published', 'Published']]} />
              <Input label="Publish date" type="datetime-local" value={form.published_at} onChange={(event) => setForm({ ...form, published_at: event.target.value })} />
              <Input label="Meta title" value={form.meta_title} onChange={(event) => setForm({ ...form, meta_title: event.target.value })} className="sm:col-span-2" />
              <Textarea label="Meta description" value={form.meta_description} rows={3} onChange={(event) => setForm({ ...form, meta_description: event.target.value })} className="sm:col-span-2" />
              <Input label="Meta keywords/tags" value={form.meta_keywords} onChange={(event) => setForm({ ...form, meta_keywords: event.target.value })} placeholder="news, social media, updates" className="sm:col-span-2" />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="button" variant="secondary" onClick={() => setForm({ ...form, status: 'draft' })}>Save draft</Button>
              <Button type="submit" loading={busy}><Send className="h-4 w-4" /> {form.status === 'published' ? 'Publish news' : 'Save news'}</Button>
            </div>
          </div>

          <aside className="border-t border-slate-800 bg-slate-950/40 p-5 lg:border-l lg:border-t-0">
            <p className="mb-3 text-sm font-semibold text-white">Live preview</p>
            <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="aspect-[16/9] bg-slate-950">
                {heroPreview ? <img src={heroPreview} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-600"><ImageIcon className="h-10 w-10" /></div>}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge color={form.status === 'published' ? 'emerald' : 'amber'}>{form.status}</Badge>
                  <span className="text-xs text-slate-500">{form.category || 'News'}</span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-white">{form.title || 'News title'}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{form.summary || 'Short summary will appear here for public cards and previews.'}</p>
                <div className="mt-4 border-t border-slate-800 pt-4 text-sm leading-7 text-slate-300 whitespace-pre-line">{form.body || 'News details preview...'}</div>
              </div>
            </article>
          </aside>
        </form>
      </Modal>

      <Modal open={Boolean(confirmDelete)} title="Delete news post" description="This removes the post from the public news pages." onClose={() => setConfirmDelete(null)} size="md">
        <div className="p-5">
          <p className="text-sm text-slate-300">Delete <strong className="text-white">{confirmDelete?.title}</strong>?</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => remove(confirmDelete)}>Delete news</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Stat({ label, value }) {
  return <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400">{label}: <strong className="text-white">{value}</strong></span>
}

function Select({ label, value, options, onChange }) {
  const control = (
    <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30">
      {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  )

  if (!label) return control
  return <label><span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>{control}</label>
}

function Notice({ message }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div>
}

function toDateTimeLocal(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function userPublicUrl(path) {
  if (typeof window === 'undefined') return path
  const { protocol, hostname, port } = window.location
  if (port === '5174') return `${protocol}//${hostname === '127.0.0.1' ? 'localhost' : hostname}:5173${path}`
  return path
}
