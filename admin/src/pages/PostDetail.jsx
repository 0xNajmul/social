import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit3, Eye, Save, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, PageLoader, Textarea } from '../components/ui'
import DateTimeField from '../components/DateTimeField'

const STATUS_OPTIONS = [
  ['draft', 'Draft'],
  ['pending_approval', 'Pending approval'],
  ['approved', 'Approved'],
  ['scheduled', 'Scheduled'],
  ['publishing', 'Publishing'],
  ['published', 'Published'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
]

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const startInEditMode = searchParams.get('edit') === '1'
  const [post, setPost] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const load = () => api.get(`/admin/posts/${id}`).then(({ data }) => {
    setPost(data.data)
    setForm(toForm(data.data))
    setEditing(startInEditMode)
  }).catch(() => setPost(false))

  useEffect(() => { load() }, [id, startInEditMode])

  const payload = useMemo(() => {
    if (!form) return {}
    return {
      ...form,
      hashtags: splitList(form.hashtags),
      mentions: splitList(form.mentions),
      requires_approval: Boolean(form.requires_approval),
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    }
  }, [form])

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const { data } = await api.put(`/admin/posts/${id}`, payload)
      setPost(data.data)
      setForm(toForm(data.data))
      setEditing(false)
      setMessage({ type: 'success', text: 'Post updated.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not update post.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setBusy(true)
    try {
      await api.delete(`/admin/posts/${id}`)
      navigate('/posts')
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete post.' })
      setBusy(false)
    }
  }

  if (post === null) return <PageLoader />
  if (post === false) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold text-white">Post not found</p>
        <Link to="/posts" className="mt-4 inline-block"><Button variant="secondary">Back to posts</Button></Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link to="/posts" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-brand-300">
            <ArrowLeft className="h-4 w-4" /> Back to posts
          </Link>
          <h1 className="text-2xl font-bold text-white">Post #{post.id}</h1>
          <p className="mt-1 text-sm text-slate-400">Manage post content, lifecycle, schedule, workspace, and platform variants.</p>
        </div>
        <div className="flex gap-2">
          <ActionIcon tone="view" label="View mode" onClick={() => setEditing(false)}><Eye className="h-4 w-4" /></ActionIcon>
          <ActionIcon tone="edit" label="Edit post" onClick={() => setEditing(true)}><Edit3 className="h-4 w-4" /></ActionIcon>
          <ActionIcon tone="delete" label="Delete post" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4" /></ActionIcon>
        </div>
      </div>

      {message && <Notice message={message} />}

      <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">Post content</h2>
                <p className="mt-1 text-xs text-slate-500">Update the source post used by all platform variants.</p>
              </div>
              <Badge color={post.status_color}>{post.status_label}</Badge>
            </div>
            {editing ? (
              <div className="space-y-4">
                <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Post title" />
                <Textarea label="Content" rows={10} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
                <Input label="Link URL" value={form.link_url} onChange={(event) => setForm({ ...form, link_url: event.target.value })} placeholder="https://example.com" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Hashtags" value={form.hashtags} onChange={(event) => setForm({ ...form, hashtags: event.target.value })} placeholder="launch, product" />
                  <Input label="Mentions" value={form.mentions} onChange={(event) => setForm({ ...form, mentions: event.target.value })} placeholder="@brand, @partner" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</p>
                  <p className="mt-1 text-lg font-semibold text-white">{post.title || 'Untitled post'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Content</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">{post.content || 'No content.'}</p>
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-semibold text-white">Platform variants</h2>
              <p className="mt-1 text-xs text-slate-500">Review platform status, accounts, attempts and provider data.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-slate-800/40 uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Platform</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Scheduled</th><th className="px-3 py-2">Published</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Error</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(post.variants || []).map((variant) => (
                    <tr key={variant.id} className="text-slate-300">
                      <td className="px-3 py-2"><Badge>{variant.platform}</Badge></td>
                      <td className="px-3 py-2">{variant.social_account?.name || '-'}</td>
                      <td className="px-3 py-2">{variant.status}</td>
                      <td className="px-3 py-2 text-slate-500">{variant.scheduled_at ? new Date(variant.scheduled_at).toLocaleString() : '-'}</td>
                      <td className="px-3 py-2 text-slate-500">{variant.published_at ? new Date(variant.published_at).toLocaleString() : '-'}</td>
                      <td className="px-3 py-2">{variant.attempts ?? 0}</td>
                      <td className="px-3 py-2 text-rose-300">{variant.error_message || '-'}</td>
                    </tr>
                  ))}
                  {(post.variants || []).length === 0 && <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No variants.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-white">Admin controls</h2>
            {editing ? (
              <>
                <Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={STATUS_OPTIONS} />
                <Input label="Type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
                <DateTimeField label="Scheduled at" type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} />
                <DateTimeField label="Published at" type="datetime-local" value={form.published_at} onChange={(event) => setForm({ ...form, published_at: event.target.value })} />
                <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                  <input type="checkbox" checked={form.requires_approval} onChange={(event) => setForm({ ...form, requires_approval: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-slate-600 text-brand-600" />
                  <span><span className="block text-sm font-medium text-slate-200">Requires approval</span><span className="text-xs text-slate-500">Keep review workflow enabled for this post.</span></span>
                </label>
                <Button type="submit" loading={busy} className="w-full"><Save className="h-4 w-4" /> Save post</Button>
              </>
            ) : (
              <div className="grid gap-3 text-sm">
                <Detail label="Status" value={post.status_label} />
                <Detail label="Type" value={post.type || '-'} />
                <Detail label="Scheduled" value={post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '-'} />
                <Detail label="Published" value={post.published_at ? new Date(post.published_at).toLocaleString() : '-'} />
                <Detail label="Approval" value={post.requires_approval ? 'Required' : 'Not required'} />
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-white">Ownership</h2>
            <Detail label="Workspace" value={post.workspace?.name || '-'} />
            <Detail label="Workspace slug" value={post.workspace?.slug || '-'} />
            <Detail label="Author" value={post.author?.name || '-'} />
            <Detail label="Author email" value={post.author?.email || '-'} />
            <Detail label="Created" value={post.created_at ? new Date(post.created_at).toLocaleString() : '-'} />
            <Detail label="Updated" value={post.updated_at ? new Date(post.updated_at).toLocaleString() : '-'} />
          </Card>
        </aside>
      </form>
    </div>
  )
}

function toForm(post) {
  return {
    title: post.title || '',
    content: post.content || '',
    type: post.type || 'text',
    status: post.status || 'draft',
    link_url: post.link_url || '',
    hashtags: (post.hashtags || []).join(', '),
    mentions: (post.mentions || []).join(', '),
    scheduled_at: toDateTimeInput(post.scheduled_at),
    published_at: toDateTimeInput(post.published_at),
    requires_approval: Boolean(post.requires_approval),
  }
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30">
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  )
}

function Detail({ label, value }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-200">{value}</p></div>
}

function Notice({ message }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div>
}

function ActionIcon({ tone, label, children, ...props }) {
  const tones = {
    view: 'border-sky-800/60 bg-sky-950/50 text-sky-300 hover:bg-sky-900/70',
    edit: 'border-amber-800/60 bg-amber-950/50 text-amber-300 hover:bg-amber-900/70',
    delete: 'border-rose-800/60 bg-rose-950/50 text-rose-300 hover:bg-rose-900/70',
  }

  return <button type="button" className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-60 ${tones[tone]}`} aria-label={label} title={label} {...props}>{children}</button>
}
