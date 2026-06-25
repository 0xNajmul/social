import { useEffect, useState } from 'react'
import { CalendarClock, Check, ExternalLink, Image as ImageIcon, Save, Trash2, UserRound, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { broadcastDataChanged } from '../../lib/appEvents'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '../../lib/datetime'
import { Badge, Button, ConfirmDialog, Modal, ModalLoading } from '../ui'
import DateTimeField from '../DateTimeField'
import PlatformBadge from '../PlatformBadge'
import MediaPreviewModal from '../media/MediaPreviewModal'

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

export default function PostDetailsModal({ post, postId, open = Boolean(post || postId), onClose, onChanged, onDeleted }) {
  const { activeWorkspace } = useAuth()
  const seedId = post?.id || postId
  const [detail, setDetail] = useState(post || null)
  const [form, setForm] = useState(() => postForm(post))
  const [loading, setLoading] = useState(Boolean(open && seedId && !post?.media))
  const [saving, setSaving] = useState(false)
  const [reviewBusy, setReviewBusy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewMedia, setPreviewMedia] = useState(null)

  useEffect(() => {
    if (!open || !seedId) return undefined

    let active = true
    const timer = window.setTimeout(() => {
      if (post) {
        setDetail(post)
        setForm(postForm(post))
      }
      setLoading(true)
      api.get(`/posts/${seedId}`)
        .then(({ data }) => {
          if (!active) return
          setDetail(data.data)
          setForm(postForm(data.data))
        })
        .catch(() => {
          if (!active && !post) return
          setDetail(post || null)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, post, seedId])

  const variants = detail?.variants || []
  const media = detail?.media || []
  const categories = detail?.options?.categories || []
  const tags = detail?.options?.tags || []
  const tagColors = detail?.options?.tag_colors || {}
  const canDelete = detail && detail.status !== 'publishing'
  const canApprove = ['owner', 'admin', 'manager'].includes(activeWorkspace?.role)
  const showReviewActions = canApprove && detail?.status === 'pending_approval'
  const visibleTitle = detail?.title || contentTitle(detail?.content) || 'Post details'

  const scheduleLabel = formatDate(detail?.scheduled_at)

  const save = async (event) => {
    event.preventDefault()
    if (!detail) return
    setSaving(true)
    try {
      const { data } = await api.put(`/posts/${detail.id}/status`, {
        status: form.status,
        scheduled_at: fromLocalDateTimeInput(form.scheduled_at),
      })
      const updated = { ...data.data, kind: 'post' }
      setDetail(updated)
      setForm(postForm(updated))
      onChanged?.(updated)
      broadcastDataChanged({ resource: 'posts', action: 'updated', item: updated })
    } catch (error) {
      window.alert(error.response?.data?.message || 'Could not save this post.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!detail) return
    setSaving(true)
    try {
      await api.delete(`/posts/${detail.id}`)
      onDeleted?.(detail)
      broadcastDataChanged({ resource: 'posts', action: 'deleted', item: detail })
      setConfirmDelete(false)
      onClose?.()
    } catch (error) {
      window.alert(error.response?.data?.message || 'Could not delete this post.')
    } finally {
      setSaving(false)
    }
  }

  const review = async (decision) => {
    if (!detail) return
    setReviewBusy(decision)
    try {
      await api.post(`/posts/${detail.id}/review`, { decision })
      const { data } = await api.get(`/posts/${detail.id}`)
      const updated = { ...data.data, kind: 'post' }
      setDetail(updated)
      setForm(postForm(updated))
      onChanged?.(updated)
      broadcastDataChanged({ resource: 'posts', action: 'reviewed', item: updated })
    } catch (error) {
      window.alert(error.response?.data?.message || 'Could not review this post.')
    } finally {
      setReviewBusy('')
    }
  }

  return (
    <Modal
      open={open}
      title={visibleTitle}
      description={detail ? `Post #${detail.id} details, channels, media, status, and schedule.` : 'Loading post details.'}
      onClose={onClose}
      size="xl"
      fullscreenable
    >
      {loading && !detail ? (
        <ModalLoading label="Loading post details..." />
      ) : (
        <form onSubmit={save} className="space-y-5 p-5">
          {loading && detail && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              Refreshing latest post data...
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge color={detail?.status_color || 'slate'}>{detail?.status_label || detail?.status || 'Status'}</Badge>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <CalendarClock className="h-3.5 w-3.5" /> {scheduleLabel}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {detail?.content || 'No text content.'}
                </p>
                <PostTerms categories={categories} tags={tags} tagColors={tagColors} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <DateTimeField
                  label="Schedule"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(event) => setForm((current) => ({ ...current, scheduled_at: event.target.value }))}
                />
              </div>

              {showReviewActions && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Approval required</p>
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">Approve this post here before it can continue to schedule or publish.</p>
                  </div>
                  <Button type="button" size="sm" loading={reviewBusy === 'approved'} disabled={Boolean(reviewBusy)} onClick={() => review('approved')}><Check className="h-3.5 w-3.5" /> Approve</Button>
                  <Button type="button" size="sm" variant="secondary" loading={reviewBusy === 'rejected'} disabled={Boolean(reviewBusy)} onClick={() => review('rejected')}><X className="h-3.5 w-3.5" /> Reject</Button>
                </div>
              )}

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Media</h3>
                {media.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {media.slice(0, 6).map((item) => (
                      <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
                        {item.type === 'image' ? (
                          <button type="button" onClick={() => setPreviewMedia(item)} className="block w-full" aria-label={`Preview ${item.original_name || 'image'}`}>
                            <img src={item.thumbnail_url || item.url} alt={item.original_name || ''} className="aspect-video w-full object-cover transition hover:scale-[1.02]" />
                          </button>
                        ) : (
                          <div className="flex aspect-video items-center justify-center text-slate-400"><ImageIcon className="h-6 w-6" /></div>
                        )}
                        <p className="truncate px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">{item.original_name || `Media #${item.id}`}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-800">No media attached.</p>
                )}
              </section>
            </section>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Publish to</h3>
                <div className="mt-3 space-y-2">
                  {variants.map((variant) => (
                    <div key={variant.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
                      <PlatformBadge platform={variant.platform} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{variant.social_account?.name || variant.platform}</p>
                        <p className="truncate text-xs text-slate-400">{variant.status || 'draft'}</p>
                      </div>
                      {variant.permalink && (
                        <a href={variant.permalink} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Open published post">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                  {!variants.length && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-800">No channels selected.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Info</h3>
                <div className="mt-3 grid gap-2 text-sm">
                  <InfoRow label="Owner" value={detail?.author?.name || 'Unknown'} icon={<UserRound className="h-3.5 w-3.5" />} />
                  <InfoRow label="Type" value={detail?.type || 'post'} />
                  <InfoRow label="Created" value={formatDate(detail?.created_at)} />
                  <InfoRow label="Updated" value={formatDate(detail?.updated_at)} />
                </div>
              </section>
            </aside>
          </div>

          <div className="sticky bottom-0 z-20 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" className={clsx('text-rose-600 dark:text-rose-400', !canDelete && 'opacity-50')} disabled={!canDelete || saving} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
              <Button type="submit" loading={saving} disabled={!detail}><Save className="h-4 w-4" /> Save changes</Button>
            </div>
          </div>

          <ConfirmDialog
            open={confirmDelete}
            title="Delete post"
            description={`Delete "${visibleTitle}"? This action cannot be undone.`}
            confirmLabel="Delete post"
            loading={saving}
            onClose={() => setConfirmDelete(false)}
            onConfirm={remove}
          />
          <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
        </form>
      )}
    </Modal>
  )
}

function postForm(post) {
  return {
    status: post?.status || 'draft',
    scheduled_at: toLocalDateTimeInput(post?.scheduled_at || ''),
  }
}

function InfoRow({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-slate-700 dark:text-slate-200">{value || 'Unknown'}</span>
    </div>
  )
}

function PostTerms({ categories = [], tags = [], tagColors = {} }) {
  const terms = [
    ...categories.map((value) => ({ value, color: 'sky', prefix: '' })),
    ...tags.map((value) => ({ value, color: 'violet', prefix: '#', style: tagColorStyle(tagColors?.[value]) })),
  ]
  if (!terms.length) return null

  return (
    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
      {terms.slice(0, 8).map((term) => (
        <Badge key={`${term.prefix}${term.value}`} color={term.color} className={term.style ? '!text-white' : ''} style={term.style}>{term.prefix}{term.value}</Badge>
      ))}
      {terms.length > 8 && <Badge>+{terms.length - 8}</Badge>}
    </div>
  )
}

function contentTitle(content) {
  const clean = String(content || '').trim().replace(/\s+/g, ' ')
  if (!clean) return ''
  return clean.length > 68 ? `${clean.slice(0, 68)}...` : clean
}

function tagColorStyle(value) {
  if (!/^#[0-9a-f]{6}$/i.test(String(value || ''))) return undefined
  return { backgroundColor: value }
}

function formatDate(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}
