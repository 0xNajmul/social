import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CalendarClock, Clock3, Edit3, ExternalLink, Eye, FileText, Hash,
  Image as ImageIcon, Link2, MessageSquare, Save, Share2, Sparkles, Trash2, Users,
} from 'lucide-react'
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

  const load = useCallback(() => api.get(`/admin/posts/${id}`).then(({ data }) => {
    setPost(data.data)
    setForm(toForm(data.data))
    setEditing(startInEditMode)
  }).catch(() => setPost(false)), [id, startInEditMode])

  useEffect(() => { load() }, [load])

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

      <PostSummary post={post} />

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
                <ContentTokens post={post} />
              </div>
            )}
          </Card>

          <ContentFeaturePanel post={post} />

          <MediaGallery media={post.media || []} />

          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-semibold text-white">Platform variants</h2>
              <p className="mt-1 text-xs text-slate-500">Review platform status, accounts, attempts and provider data.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-800/40 uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Platform</th><th className="px-3 py-2">Account</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Variant copy</th><th className="px-3 py-2">Timing</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Result</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(post.variants || []).map((variant) => (
                    <tr key={variant.id} className="text-slate-300">
                      <td className="px-3 py-2"><Badge>{variant.platform}</Badge></td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-200">{variant.social_account?.name || '-'}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{variant.social_account?.username || variant.provider_post_id || '-'}</p>
                      </td>
                      <td className="px-3 py-2"><VariantStatusBadge status={variant.status} /></td>
                      <td className="px-3 py-2">
                        <p className="line-clamp-2 max-w-sm text-slate-300">{variant.content || post.content || '-'}</p>
                        {(variant.hashtags || []).length > 0 && <p className="mt-1 text-[11px] text-brand-300">{variant.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        <p>Scheduled: {formatDate(variant.scheduled_at)}</p>
                        <p>Published: {formatDate(variant.published_at)}</p>
                      </td>
                      <td className="px-3 py-2">{variant.attempts ?? 0}</td>
                      <td className="px-3 py-2">
                        {variant.permalink ? (
                          <a href={variant.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-300 hover:text-brand-200">
                            Open post <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className={variant.error_message ? 'text-rose-300' : 'text-slate-500'}>{variant.error_message || '-'}</span>
                        )}
                      </td>
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

function PostSummary({ post }) {
  const variants = post.variants || []
  const media = post.media || []
  const publishedCount = variants.filter((variant) => variant.status === 'published').length
  const failedCount = variants.filter((variant) => variant.status === 'failed').length

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={FileText} label="Post type" value={post.type || 'text'} hint={`${countWords(post.content)} words`} />
      <MetricCard icon={Share2} label="Channels" value={variants.length} hint={`${publishedCount} published, ${failedCount} failed`} />
      <MetricCard icon={ImageIcon} label="Media" value={media.length} hint={media.length ? media.map((item) => item.type).slice(0, 3).join(', ') : 'No attachments'} />
      <MetricCard icon={CalendarClock} label="Schedule" value={post.scheduled_at ? 'Scheduled' : post.published_at ? 'Published' : 'Not scheduled'} hint={formatDate(post.scheduled_at || post.published_at)} />
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  )
}

function ContentTokens({ post }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <InfoPanel icon={Link2} label="Link">
        {post.link_url ? (
          <a href={post.link_url} target="_blank" rel="noreferrer" className="line-clamp-2 break-all text-brand-300 hover:text-brand-200">
            {post.link_url}
          </a>
        ) : (
          <span className="text-slate-500">No link attached.</span>
        )}
      </InfoPanel>
      <InfoPanel icon={Hash} label="Hashtags">
        <TokenList items={post.hashtags || []} prefix="#" empty="No hashtags." />
      </InfoPanel>
      <InfoPanel icon={Users} label="Mentions">
        <TokenList items={post.mentions || []} prefix="@" empty="No mentions." />
      </InfoPanel>
    </div>
  )
}

function ContentFeaturePanel({ post }) {
  const options = Object.entries(post.options || {}).slice(0, 8)
  const variants = post.variants || []

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-brand-300">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-white">Content review</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Fast admin context for copy length, approval state, platform coverage and saved publishing options.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReviewStat icon={MessageSquare} label="Characters" value={String(post.content || '').length} />
        <ReviewStat icon={Clock3} label="Approval" value={post.requires_approval ? 'Required' : 'Not required'} />
        <ReviewStat icon={Share2} label="Ready variants" value={variants.filter((variant) => !['failed', 'cancelled'].includes(variant.status)).length} />
        <ReviewStat icon={Link2} label="Link attached" value={post.link_url ? 'Yes' : 'No'} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publishing options</p>
        {options.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {options.map(([key, value]) => (
              <div key={key} className="rounded-lg bg-slate-900 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{key.replace(/_/g, ' ')}</p>
                <p className="mt-1 break-words text-sm text-slate-200">{formatOptionValue(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No custom options saved for this post.</p>
        )}
      </div>
    </Card>
  )
}

function ReviewStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  )
}

function MediaGallery({ media }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Media attachments</h2>
          <p className="mt-1 text-xs text-slate-500">Preview attached assets, dimensions, file size and alternate text.</p>
        </div>
        <Badge color={media.length ? 'indigo' : 'slate'}>{media.length} files</Badge>
      </div>
      {media.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {media.map((item) => <MediaPreview key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          <ImageIcon className="mx-auto mb-2 h-8 w-8" />No media attached to this post.
        </div>
      )}
    </Card>
  )
}

function MediaPreview({ item }) {
  const isImage = ['image', 'gif'].includes(item.type)

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
      <div className="flex aspect-video items-center justify-center bg-slate-950">
        {isImage && item.url ? (
          <img src={item.url} alt={item.alt_text || item.original_name || ''} className="h-full w-full object-cover" />
        ) : (
          <div className="text-center text-slate-500">
            <ImageIcon className="mx-auto h-9 w-9" />
            <p className="mt-2 text-xs font-medium uppercase tracking-wide">{item.type || 'asset'}</p>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3 text-xs">
        <p className="truncate font-semibold text-slate-200">{item.original_name || `Asset #${item.id}`}</p>
        <p className="text-slate-500">{item.mime_type || '-'} - {formatBytes(item.size)}</p>
        <p className="text-slate-500">{item.width && item.height ? `${item.width} x ${item.height}` : 'Dimensions unavailable'}</p>
        {item.alt_text && <p className="line-clamp-2 text-slate-400">{item.alt_text}</p>}
      </div>
    </div>
  )
}

function InfoPanel({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <div className="text-sm text-slate-300">{children}</div>
    </div>
  )
}

function TokenList({ items, prefix, empty }) {
  if (!items.length) return <span className="text-slate-500">{empty}</span>

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const text = String(item)
        return <span key={text} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">{text.startsWith(prefix) ? text : `${prefix}${text}`}</span>
      })}
    </div>
  )
}

function VariantStatusBadge({ status }) {
  return <Badge color={statusColor(status)}>{String(status || 'unknown').replace(/_/g, ' ')}</Badge>
}

function statusColor(status) {
  return {
    published: 'emerald',
    scheduled: 'indigo',
    approved: 'sky',
    pending_approval: 'amber',
    failed: 'rose',
    cancelled: 'slate',
  }[status] || 'slate'
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

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function formatBytes(value) {
  const size = Number(value || 0)
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return `${(size / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function countWords(value) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  return words.length
}

function formatOptionValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '-')
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
