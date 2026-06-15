import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Wand2, Hash, Sparkles, Send, CalendarClock, Save, AlertCircle, FolderOpen } from 'lucide-react'
import api from '../lib/api'
import { normalizeAccounts } from '../lib/accounts'
import { Card, Button, Textarea, EmptyState } from '../components/ui'
import { AccountIcon } from '../components/PlatformBadge'
import MediaDropzone from '../components/composer/MediaDropzone'
import MediaLibraryPicker from '../components/composer/MediaLibraryPicker'
import YouTubePlatformFields, { isYouTubeAccount, defaultYouTubeOptions } from '../components/composer/YouTubePlatformFields'
import TikTokPlatformFields from '../components/composer/TikTokPlatformFields'
import { isTikTokAccount, defaultTikTokOptions } from '../components/composer/tikTokOptions'
import RedditPlatformFields from '../components/composer/RedditPlatformFields'
import { defaultRedditOptions, isRedditAccount } from '../components/composer/redditOptions'
import PlatformPostPreview from '../components/composer/PlatformPostPreview'
import { inferPostType, partitionAccounts } from '../lib/platformMedia'
import { useAuth } from '../context/AuthContext'

export function ComposerContent({ modal = false, onDone, initialScheduledAt = null }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { activeWorkspace } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [selected, setSelected] = useState([])
  const [content, setContent] = useState('')
  const [mediaItems, setMediaItems] = useState([])
  const [scheduledAt, setScheduledAt] = useState(() => toLocalDateTimeInput(initialScheduledAt || searchParams.get('scheduled_at')))
  const [aiBusy, setAiBusy] = useState(null)
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState({})
  const [lastSkipped, setLastSkipped] = useState([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [platformOptions, setPlatformOptions] = useState({})

  useEffect(() => {
    api.get('/social/accounts').then(({ data }) => {
      setAccounts(normalizeAccounts(data.data.filter((a) => a.status === 'active')))
    })
    api.get('/social/platforms').then(({ data }) => setPlatforms(data.data))
  }, [])

  const toggle = (id) => {
    setSelected((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
      if (!s.includes(id)) {
        const acc = accounts.find((a) => a.id === id)
        if (isYouTubeAccount(acc)) {
          setPlatformOptions((opts) => ({ ...opts, [id]: opts[id] || defaultYouTubeOptions() }))
        }
        if (isTikTokAccount(acc)) {
          setPlatformOptions((opts) => ({ ...opts, [id]: opts[id] || defaultTikTokOptions() }))
        }
        if (isRedditAccount(acc)) {
          setPlatformOptions((opts) => ({ ...opts, [id]: opts[id] || defaultRedditOptions(acc) }))
        }
      }
      return next
    })
  }

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id))
  const { eligible, skipped } = useMemo(
    () => partitionAccounts(selectedAccounts, mediaItems, platforms),
    [selectedAccounts, mediaItems, platforms],
  )

  const mediaUploading = mediaItems.some((m) => m.uploading)

  const runAi = async (type) => {
    if (!content && type !== 'ideas') return
    setAiBusy(type)
    try {
      const { data } = await api.post('/ai/generate', { type, topic: content, content, tone: 'friendly' })
      if (type === 'hashtags') {
        setContent((c) => `${c}\n\n${data.result.join(' ')}`)
      } else if (type === 'caption' || type === 'hook') {
        setContent(data.result)
      }
    } catch (e) {
      alert(e.response?.data?.message || 'AI error')
    } finally {
      setAiBusy(null)
    }
  }

  const approvalRequired = Boolean(activeWorkspace?.settings?.approval_required)

  const buildPayload = (mode) => ({
    content,
    type: inferPostType(mediaItems),
    media_ids: mediaItems.filter((m) => !m.uploading && typeof m.id === 'number').map((m) => m.id),
    targets: eligible.map((a) => ({
      social_account_id: a.id,
      options: platformOptions[a.id] || undefined,
    })),
    scheduled_at: scheduledAt || null,
    requires_approval: approvalRequired && mode !== 'draft',
    options: approvalRequired && mode !== 'draft' ? { approval_action: mode } : {},
  })

  const addFromLibrary = (assets) => {
    setMediaItems((current) => {
      const ids = new Set(current.map((m) => m.id))
      return [...current, ...assets.filter((a) => !ids.has(a.id))]
    })
  }

  const validateBeforeSubmit = () => {
    for (const acc of eligible) {
      if (isYouTubeAccount(acc)) {
        const opts = platformOptions[acc.id] || {}
        if (!opts.title?.trim()) {
          return `YouTube requires a video title for "${acc.name}".`
        }
        if (!mediaItems.some((m) => m.type === 'video')) {
          return 'YouTube requires a video file. Upload or pick one from the library.'
        }
      }
      if (isTikTokAccount(acc)) {
        const opts = platformOptions[acc.id] || {}
        const videos = mediaItems.filter((item) => item.type === 'video')
        if (videos.length !== 1 || mediaItems.length !== 1) {
          return 'TikTok requires exactly one video file.'
        }
        if (!opts.privacy_level) {
          return `Choose a TikTok privacy setting for "${acc.name}".`
        }
        if (!opts.tiktok_consent) {
          return `Confirm TikTok publishing consent for "${acc.name}".`
        }
      }
      if (isRedditAccount(acc)) {
        const opts = platformOptions[acc.id] || {}
        if (!opts.subreddit?.trim()) {
          return `Choose a subreddit for "${acc.name}".`
        }
        if (!opts.reddit_title?.trim()) {
          return `Reddit requires a post title for "${acc.name}".`
        }
        if (opts.reddit_title.trim().length > 300) {
          return 'Reddit titles cannot exceed 300 characters.'
        }
        if (opts.reddit_post_type === 'link') {
          try {
            new URL(opts.reddit_url)
          } catch {
            return 'Enter a valid URL for the Reddit link post.'
          }
        }
        if (opts.reddit_post_type === 'image') {
          const images = mediaItems.filter((item) => item.type === 'image' || item.type === 'gif')
          if (images.length !== 1 || mediaItems.length !== 1) {
            return 'Reddit image posts require exactly one image.'
          }
        }
      }
    }
    return null
  }

  const createPost = async (mode) => {
    const { data } = await api.post('/posts', buildPayload(mode))
    setValidation(data.validation || {})
    setLastSkipped(data.skipped_targets || [])
    return data.data
  }

  const finish = (post) => {
    if (onDone) onDone(post)
    else navigate('/app/organizer')
  }

  const action = async (mode) => {
    if (selected.length === 0) return alert('Select at least one account.')
    if (eligible.length === 0) {
      return alert('None of the selected accounts support this media. Remove files or change accounts.')
    }
    if (mediaUploading) return alert('Wait for uploads to finish.')
    const err = validateBeforeSubmit()
    if (err) return alert(err)
    const hasRedditOnlyContent = eligible.length > 0
      && eligible.every(isRedditAccount)
      && eligible.every((account) => (platformOptions[account.id]?.reddit_title || '').trim())
    if (!content.trim() && mediaItems.length === 0 && !hasRedditOnlyContent) return alert('Add text or media.')

    setSaving(true)
    try {
      const post = await createPost(mode)
      if (skipped.length > 0 || (lastSkipped?.length ?? 0) > 0) {
        const names = skipped.map((a) => a.name).join(', ')
        if (names) console.info(`Skipped incompatible accounts: ${names}`)
      }
      if (approvalRequired && mode !== 'draft') {
        await api.post(`/posts/${post.id}/request-approval`)
        finish(post)
        return
      }
      if (mode === 'schedule') {
        if (!scheduledAt) {
          alert('Pick a date/time to schedule.')
          setSaving(false)
          return
        }
        await api.post(`/posts/${post.id}/schedule`, { scheduled_at: scheduledAt })
      } else if (mode === 'publish') {
        await api.post(`/posts/${post.id}/publish`)
      }
      finish(post)
    } catch (e) {
      const v = e.response?.data?.validation
      if (v) setValidation(v)
      else alert(e.response?.data?.message || 'Could not save post')
    } finally {
      setSaving(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="Connect an account first"
        description="You need at least one connected social account to compose a post."
        action={<Button onClick={() => navigate('/app/accounts')}>Connect account</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      {!modal && <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compose</h1>
        <p className="text-sm text-slate-500">Upload once — we only publish to platforms that support your media.</p>
      </div>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Account picker */}
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Publish to</h2>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const isSelected = selected.includes(a.id)
                const skipReason = isSelected
                  ? partitionAccounts([a], mediaItems, platforms).skipped[0]?.skipReason
                  : null
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`relative flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                      isSelected && !skipReason
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                        : isSelected && skipReason
                          ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-900/20'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                    title={skipReason || undefined}
                  >
                    <AccountIcon
                      platform={a.platform}
                      avatarUrl={a.avatar_url}
                      name={a.name}
                      size="xs"
                    />
                    <span className="text-slate-700 dark:text-slate-200">{a.name}</span>
                    {isSelected && skipReason && (
                      <span className="rounded bg-amber-200 px-1 text-[9px] font-bold uppercase text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                        skip
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {skipped.length > 0 && mediaItems.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {skipped.length} account{skipped.length > 1 ? 's' : ''} will be skipped (media not supported).{' '}
                {eligible.length} will receive this post.
              </p>
            )}
          </Card>

          {/* Media */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Media</h2>
              <Button size="sm" variant="secondary" onClick={() => setLibraryOpen(true)}>
                <FolderOpen className="h-3.5 w-3.5" /> Grab from library
              </Button>
            </div>
            <MediaDropzone items={mediaItems} onChange={setMediaItems} disabled={saving} />
          </Card>

          {/* Platform-specific options */}
          {selectedAccounts.filter(isYouTubeAccount).map((acc) => (
            <Card key={acc.id} className="p-5">
              <YouTubePlatformFields
                account={acc}
                options={platformOptions[acc.id] || defaultYouTubeOptions()}
                onChange={(opts) => setPlatformOptions((prev) => ({ ...prev, [acc.id]: opts }))}
              />
            </Card>
          ))}

          {selectedAccounts.filter(isTikTokAccount).map((acc) => (
            <Card key={acc.id} className="p-5">
              <TikTokPlatformFields
                account={acc}
                options={platformOptions[acc.id] || defaultTikTokOptions()}
                onChange={(opts) => setPlatformOptions((prev) => ({ ...prev, [acc.id]: opts }))}
              />
            </Card>
          ))}

          {selectedAccounts.filter(isRedditAccount).map((acc) => (
            <Card key={acc.id} className="p-5">
              <RedditPlatformFields
                account={acc}
                options={platformOptions[acc.id] || defaultRedditOptions(acc)}
                onChange={(opts) => setPlatformOptions((prev) => ({ ...prev, [acc.id]: opts }))}
              />
            </Card>
          ))}

          {/* Editor */}
          <Card className="p-5">
            <Textarea rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your caption or message…" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => runAi('caption')} loading={aiBusy === 'caption'}><Wand2 className="h-3.5 w-3.5" /> AI caption</Button>
              <Button size="sm" variant="secondary" onClick={() => runAi('hook')} loading={aiBusy === 'hook'}><Sparkles className="h-3.5 w-3.5" /> Hook</Button>
              <Button size="sm" variant="secondary" onClick={() => runAi('hashtags')} loading={aiBusy === 'hashtags'}><Hash className="h-3.5 w-3.5" /> Hashtags</Button>
              <span className="ml-auto text-xs text-slate-400">{content.length} chars · {mediaItems.length} file{mediaItems.length !== 1 ? 's' : ''}</span>
            </div>
          </Card>

          {Object.keys(validation).length > 0 && (
            <Card className="border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Platform warnings</p>
              {Object.entries(validation).map(([p, errs]) => (
                <div key={p} className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  <strong>{p}:</strong> {errs.join(' ')}
                </div>
              ))}
            </Card>
          )}

          <Card className="p-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Schedule for</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => action('schedule')} loading={saving} disabled={mediaUploading || eligible.length === 0}>
                <CalendarClock className="h-4 w-4" /> {approvalRequired ? 'Submit schedule' : 'Schedule'} ({eligible.length})
              </Button>
              <Button variant="secondary" onClick={() => action('publish')} loading={saving} disabled={mediaUploading || eligible.length === 0}>
                <Send className="h-4 w-4" /> {approvalRequired ? 'Submit for approval' : 'Publish now'} ({eligible.length})
              </Button>
              <Button variant="ghost" onClick={() => action('draft')} loading={saving} disabled={mediaUploading}>
                <Save className="h-4 w-4" /> Save draft
              </Button>
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Platform previews</h2>
          {selectedAccounts.length === 0 && (
            <p className="text-sm text-slate-400">Select accounts to see how your post will look on each network.</p>
          )}
          {selectedAccounts.map((a) => {
            const skip = skipped.find((s) => s.id === a.id)
            return (
              <PlatformPostPreview
                key={a.id}
                account={a}
                content={content}
                media={mediaItems.filter((m) => !m.uploading)}
                platforms={platforms}
                options={platformOptions[a.id]}
                skipped={Boolean(skip)}
                skipReason={skip?.skipReason}
              />
            )
          })}
        </div>
      </div>

      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdd={addFromLibrary}
        existingIds={mediaItems.filter((m) => typeof m.id === 'number').map((m) => m.id)}
      />
    </div>
  )
}

export default function Composer() {
  return <ComposerContent />
}

function toLocalDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
