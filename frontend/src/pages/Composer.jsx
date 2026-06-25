import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Wand2, Hash, Sparkles, Send, CalendarClock, Save, AlertCircle, FolderOpen, PlugZap, Smile, CheckCircle2, BarChart3, ExternalLink, RotateCcw, Search, X, List, Tags } from 'lucide-react'
import api from '../lib/api'
import { normalizeAccounts } from '../lib/accounts'
import { Card, Button, Textarea, EmptyState, Modal } from '../components/ui'
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
import DateTimeField from '../components/DateTimeField'
import TermPickerField from '../components/TermPickerField'
import { broadcastDataChanged } from '../lib/appEvents'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '../lib/datetime'

export function ComposerContent({ modal = false, onDone, initialScheduledAt = null, onDirtyChange }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { activeWorkspace } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [platforms, setPlatforms] = useState([])
  const [selected, setSelected] = useState([])
  const [content, setContent] = useState('')
  const [mediaItems, setMediaItems] = useState([])
  const [scheduledAt, setScheduledAt] = useState(() => toLocalDateTimeInput(initialScheduledAt || searchParams.get('scheduled_at')))
  const [categories, setCategories] = useState('')
  const [tags, setTags] = useState('')
  const [aiBusy, setAiBusy] = useState(null)
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState({})
  const [lastSkipped, setLastSkipped] = useState([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [platformOptions, setPlatformOptions] = useState({})
  const [sideTab, setSideTab] = useState('preview')
  const [contentTool, setContentTool] = useState(null)
  const [completedPost, setCompletedPost] = useState(null)
  const [termPickerOpen, setTermPickerOpen] = useState(null)
  const [customCategories, setCustomCategories] = useState(() => loadPlannerTerms('post_custom_categories'))
  const [customTags, setCustomTags] = useState(() => loadPlannerTerms('post_custom_tags'))
  const [tagColors, setTagColors] = useState(() => loadTermColors('post_tag_colors'))

  useEffect(() => {
    api.get('/social/accounts').then(({ data }) => {
      const hiddenAccountIds = loadHiddenComposeAccountIds()
      setAccounts(normalizeAccounts(data.data.filter((a) => a.status === 'active' && !hiddenAccountIds.includes(String(a.id)))))
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
  const workspaceKey = activeWorkspace?.slug || activeWorkspace?.id || 'default-workspace'
  const installedIntegrations = useMemo(() => getInstalledIntegrationLabels(workspaceKey), [workspaceKey])

  useEffect(() => {
    onDirtyChange?.(!completedPost && Boolean(
      content.trim()
      || mediaItems.length
      || selected.length
      || categories.trim()
      || tags.trim()
      || scheduledAt
      || Object.keys(platformOptions).length,
    ))
  }, [categories, completedPost, content, mediaItems.length, onDirtyChange, platformOptions, scheduledAt, selected.length, tags])

  useEffect(() => {
    storePlannerTerms('post_custom_categories', customCategories)
  }, [customCategories])

  useEffect(() => {
    storePlannerTerms('post_custom_tags', customTags)
  }, [customTags])

  useEffect(() => {
    storeTermColors('post_tag_colors', tagColors)
  }, [tagColors])

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

  const addEmoji = (emoji) => {
    setContent((current) => `${current}${emoji}`)
  }

  const insertIntegrationToken = (name) => {
    setContent((current) => `${current}${current.endsWith(' ') || current.length === 0 ? '' : ' '}[${name}] `)
    setContentTool(null)
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
    scheduled_at: mode === 'schedule' ? fromLocalDateTimeInput(scheduledAt) : null,
    requires_approval: approvalRequired && mode !== 'draft',
    options: {
      ...(approvalRequired && mode !== 'draft' ? { approval_action: mode } : {}),
      categories: splitList(categories),
      tags: splitList(tags),
      tag_colors: pickTermColors(splitList(tags), tagColors),
    },
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

  const finish = (post, mode) => {
    setCompletedPost({
      ...post,
      completedMode: mode,
      approvalRequired: approvalRequired && mode !== 'draft',
      targetNames: eligible.map((account) => account.name),
      mediaCount: mediaItems.filter((item) => !item.uploading).length,
      categoryNames: splitList(categories),
      tagNames: splitList(tags),
      scheduledAt: mode === 'schedule' ? (scheduledAt || post.scheduled_at || null) : null,
      contentPreview: content,
    })
    broadcastDataChanged({ resource: 'posts', action: mode, item: post })
    onDirtyChange?.(false)
  }

  const resetForAnotherPost = () => {
    setSelected([])
    setContent('')
    setMediaItems([])
    setScheduledAt('')
    setCategories('')
    setTags('')
    setValidation({})
    setLastSkipped([])
    setPlatformOptions({})
    setContentTool(null)
    setCompletedPost(null)
    setSideTab('preview')
    onDirtyChange?.(false)
  }

  const navigateFromSuccess = (path) => {
    const post = completedPost
    setCompletedPost(null)
    onDone?.(post)
    navigate(path)
  }

  const action = async (mode) => {
    if (selected.length === 0) return alert('Select at least one account.')
    if (eligible.length === 0) {
      return alert('None of the selected accounts support this media. Remove files or change accounts.')
    }
    if (mediaUploading) return alert('Wait for uploads to finish.')
    if (mode === 'schedule' && !scheduledAt) return alert('Pick a date/time to schedule.')
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
        finish(post, mode)
        return
      }
      if (mode === 'schedule') {
        await api.post(`/posts/${post.id}/schedule`, { scheduled_at: fromLocalDateTimeInput(scheduledAt) })
      } else if (mode === 'publish') {
        await api.post(`/posts/${post.id}/publish`)
      }
      finish(post, mode)
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
          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Publish to</h2>
            <div className="flex flex-wrap gap-1.5">
              {accounts.map((a) => {
                const isSelected = selected.includes(a.id)
                const skipReason = isSelected
                  ? partitionAccounts([a], mediaItems, platforms).skipped[0]?.skipReason
                  : null
                return (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className={`relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
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
                    <span className="max-w-28 truncate text-slate-700 dark:text-slate-200">{a.name}</span>
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

          {/* Editor */}
          <Card className="p-5">
            <Textarea rows={7} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your caption or message..." />
            <div className="relative mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => runAi('caption')} loading={aiBusy === 'caption'}><Wand2 className="h-3.5 w-3.5" /> AI caption</Button>
              <Button size="sm" variant="secondary" onClick={() => runAi('hook')} loading={aiBusy === 'hook'}><Sparkles className="h-3.5 w-3.5" /> Hook</Button>
              <Button size="sm" variant="secondary" onClick={() => runAi('hashtags')} loading={aiBusy === 'hashtags'}><Hash className="h-3.5 w-3.5" /> Hashtags</Button>
              <span className="relative inline-flex">
                <Button size="sm" variant="secondary" onClick={() => setContentTool((tool) => tool === 'emoji' ? null : 'emoji')}><Smile className="h-3.5 w-3.5" /> Emoji</Button>
                {contentTool === 'emoji' && <EmojiPanel onSelect={addEmoji} onClose={() => setContentTool(null)} />}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setContentTool((tool) => tool === 'integrations' ? null : 'integrations')}><PlugZap className="h-3.5 w-3.5" /> Integrations</Button>
              <span className="ml-auto text-xs text-slate-400">{content.length} chars · {mediaItems.length} file{mediaItems.length !== 1 ? 's' : ''}</span>
              {contentTool === 'integrations' && <IntegrationPanel integrations={installedIntegrations} onSelect={insertIntegrationToken} />}
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

          <Card className="p-5">
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <TermPickerField
                label="Categories"
                icon={List}
                open={termPickerOpen === 'categories'}
                onOpen={() => setTermPickerOpen((current) => current === 'categories' ? null : 'categories')}
                onClose={() => setTermPickerOpen(null)}
                selected={splitList(categories)}
                terms={uniqueTerms([...customCategories, ...splitList(categories)])}
                onChange={(terms) => setCategories(terms.join(', '))}
                onAdd={(term) => setCustomCategories((current) => uniqueTerms([...current, term]))}
                onDelete={(term) => {
                  setCustomCategories((current) => current.filter((item) => item !== term))
                  setCategories((current) => splitList(current).filter((item) => item !== term).join(', '))
                }}
                placeholder="Select or add categories"
              />
              <TermPickerField
                label="Tags"
                icon={Tags}
                prefix="#"
                open={termPickerOpen === 'tags'}
                onOpen={() => setTermPickerOpen((current) => current === 'tags' ? null : 'tags')}
                onClose={() => setTermPickerOpen(null)}
                selected={splitList(tags)}
                terms={uniqueTerms([...customTags, ...splitList(tags)])}
                termColors={tagColors}
                onChange={(terms) => setTags(terms.join(', '))}
                onAdd={(term) => setCustomTags((current) => uniqueTerms([...current, term]))}
                onDelete={(term) => {
                  setCustomTags((current) => current.filter((item) => item !== term))
                  setTags((current) => splitList(current).filter((item) => item !== term).join(', '))
                  setTagColors((current) => {
                    const next = { ...current }
                    delete next[term]
                    return next
                  })
                }}
                onColorChange={(term, color) => setTagColors((current) => ({ ...current, [term]: color }))}
                placeholder="Select or add tags"
              />
            </div>
            <DateTimeField
              label="Schedule for"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
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
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {[
              ['preview', 'Platform preview'],
              ['ai', 'AI assistant'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSideTab(key)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${sideTab === key ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {sideTab === 'preview' ? (
            <>
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
            </>
          ) : (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">AI assistant</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use the current caption as context and generate better hooks, captions, or hashtags.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2">
                <Button variant="secondary" onClick={() => runAi('caption')} loading={aiBusy === 'caption'}><Wand2 className="h-4 w-4" /> Rewrite caption</Button>
                <Button variant="secondary" onClick={() => runAi('hook')} loading={aiBusy === 'hook'}><Sparkles className="h-4 w-4" /> Generate hook</Button>
                <Button variant="secondary" onClick={() => runAi('hashtags')} loading={aiBusy === 'hashtags'}><Hash className="h-4 w-4" /> Add hashtags</Button>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Context</p>
                <p className="mt-2 line-clamp-6 text-sm leading-6 text-slate-600 dark:text-slate-300">{content || 'Write a caption first, then ask AI to improve it.'}</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ComposerActionFooter
        modal={modal}
        approvalRequired={approvalRequired}
        eligibleCount={eligible.length}
        mediaUploading={mediaUploading}
        saving={saving}
        onAction={action}
      />

      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onAdd={addFromLibrary}
        existingIds={mediaItems.filter((m) => typeof m.id === 'number').map((m) => m.id)}
      />

      <PostSuccessModal
        post={completedPost}
        onClose={() => setCompletedPost(null)}
        onPostAnother={resetForAnotherPost}
        onViewOrganizer={() => navigateFromSuccess('/app/organizer')}
        onViewAnalytics={() => navigateFromSuccess('/app/analytics')}
      />
    </div>
  )
}

function ComposerActionFooter({ modal, approvalRequired, eligibleCount, mediaUploading, saving, onAction }) {
  const className = modal
    ? 'sticky bottom-0 z-30 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95'
    : 'flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'

  return (
    <div className={className}>
      <Button onClick={() => onAction('schedule')} loading={saving} disabled={mediaUploading || eligibleCount === 0}>
        <CalendarClock className="h-4 w-4" /> {approvalRequired ? 'Submit schedule' : 'Schedule'} ({eligibleCount})
      </Button>
      <Button variant="secondary" onClick={() => onAction('publish')} loading={saving} disabled={mediaUploading || eligibleCount === 0}>
        <Send className="h-4 w-4" /> {approvalRequired ? 'Submit for approval' : 'Publish now'} ({eligibleCount})
      </Button>
      <Button variant="ghost" onClick={() => onAction('draft')} loading={saving} disabled={mediaUploading}>
        <Save className="h-4 w-4" /> Save draft
      </Button>
    </div>
  )
}

function PostSuccessModal({ post, onClose, onPostAnother, onViewOrganizer, onViewAnalytics }) {
  if (!post) return null

  const status = postSuccessStatus(post)
  const scheduled = post.scheduledAt ? formatDateTime(post.scheduledAt) : null
  const targets = post.targetNames?.length ? post.targetNames.join(', ') : 'No target accounts'
  const categories = post.categoryNames?.length ? post.categoryNames.join(', ') : 'No categories'
  const tags = post.tagNames?.length ? post.tagNames.map((tag) => `#${tag}`).join(', ') : 'No tags'

  return (
    <Modal
      open={Boolean(post)}
      title="Congratulations"
      description={status.description}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-5 p-5">
        <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">{status.title}</p>
            <p className="mt-1 text-sm leading-6 text-emerald-700 dark:text-emerald-200">{status.detail}</p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <SuccessStat label="Post ID" value={post.id ? `#${post.id}` : 'Created'} />
          <SuccessStat label="Targets" value={`${post.targetNames?.length || 0} account${post.targetNames?.length === 1 ? '' : 's'}`} />
          <SuccessStat label="Media" value={`${post.mediaCount || 0} file${post.mediaCount === 1 ? '' : 's'}`} />
          <SuccessStat label="Schedule" value={scheduled || (post.completedMode === 'publish' ? 'Published now' : 'Not scheduled')} />
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase text-slate-400">Post info</p>
          <dl className="mt-3 space-y-2 text-sm">
            <InfoRow label="Publish to" value={targets} />
            <InfoRow label="Categories" value={categories} />
            <InfoRow label="Tags" value={tags} />
            <InfoRow label="Content" value={post.contentPreview?.trim() || 'Media-only post'} />
          </dl>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onPostAnother}>
            <RotateCcw className="h-4 w-4" /> Post another
          </Button>
          <Button type="button" variant="secondary" onClick={onViewAnalytics}>
            <BarChart3 className="h-4 w-4" /> Check analytics
          </Button>
          <Button type="button" onClick={onViewOrganizer}>
            <ExternalLink className="h-4 w-4" /> View in organizer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SuccessStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)]">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="line-clamp-3 min-w-0 font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  )
}

function postSuccessStatus(post) {
  if (post.approvalRequired) {
    return {
      title: 'Post submitted for approval',
      description: 'Your post is saved and waiting for workspace approval.',
      detail: 'Approvers can review it before it goes live.',
    }
  }
  if (post.completedMode === 'schedule') {
    return {
      title: 'Post scheduled successfully',
      description: 'Your post is ready for its scheduled publish time.',
      detail: 'It will appear in the organizer with the selected date and target accounts.',
    }
  }
  if (post.completedMode === 'draft') {
    return {
      title: 'Draft saved successfully',
      description: 'Your post draft has been saved.',
      detail: 'You can return to it from the organizer when you are ready to publish.',
    }
  }
  return {
    title: 'Post published successfully',
    description: 'Your post was published without leaving this page.',
    detail: 'You can continue posting, review it in the organizer, or inspect analytics.',
  }
}

function EmojiPanel({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const groups = useMemo(() => {
    if (!normalizedQuery) return EMOJI_GROUPS
    return EMOJI_GROUPS.map((group) => ({
      ...group,
      emojis: group.emojis.filter((item) => `${item.emoji} ${item.name} ${item.keywords}`.toLowerCase().includes(normalizedQuery)),
    })).filter((group) => group.emojis.length > 0)
  }, [normalizedQuery])

  return (
    <div className="absolute left-0 top-full z-[85] mt-2 w-[min(22rem,calc(100vw_-_2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 dark:border-slate-700">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Emoji</p>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Close emoji picker">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emoji..."
            className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.name}>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">{group.name}</p>
              <div className="grid grid-cols-8 gap-1">
                {group.emojis.map((item) => (
                  <button
                    key={`${group.name}-${item.emoji}-${item.name}`}
                    type="button"
                    onClick={() => onSelect(item.emoji)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                    title={item.name}
                    aria-label={item.name}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
              No emoji found.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function IntegrationPanel({ integrations, onSelect }) {
  return (
    <div className="absolute left-24 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Installed integrations</p>
      <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
        {integrations.map((integration) => (
          <button
            key={integration}
            type="button"
            onClick={() => onSelect(integration)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <PlugZap className="h-4 w-4 text-brand-500" />
            {integration}
          </button>
        ))}
        {integrations.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400 dark:border-slate-700">
            No integrations installed in this workspace.
          </p>
        )}
      </div>
    </div>
  )
}

export default function Composer() {
  return <ComposerContent />
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function loadHiddenComposeAccountIds() {
  try {
    const value = JSON.parse(localStorage.getItem('postflow_hidden_compose_accounts') || '[]')
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

function loadPlannerTerms(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? uniqueTerms(value) : []
  } catch {
    return []
  }
}

function storePlannerTerms(key, terms) {
  localStorage.setItem(key, JSON.stringify(uniqueTerms(terms)))
}

function loadTermColors(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function storeTermColors(key, colors) {
  localStorage.setItem(key, JSON.stringify(colors || {}))
}

function pickTermColors(terms, colors) {
  return (terms || []).reduce((picked, term) => {
    if (colors?.[term]) picked[term] = colors[term]
    return picked
  }, {})
}

function uniqueTerms(terms) {
  const seen = new Set()
  return (terms || []).reduce((items, value) => {
    const term = cleanTerm(value)
    const key = term.toLowerCase()
    if (!term || seen.has(key)) return items
    seen.add(key)
    return [...items, term]
  }, [])
}

function cleanTerm(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

const EMOJI_GROUPS = [
  {
    name: 'Smileys',
    emojis: [
      emojiItem('😀', 'Grinning face', 'happy smile joy'),
      emojiItem('😃', 'Big smile', 'happy excited'),
      emojiItem('😄', 'Laughing smile', 'happy laugh'),
      emojiItem('😁', 'Beaming face', 'happy grin'),
      emojiItem('😆', 'Laughing', 'lol funny'),
      emojiItem('😂', 'Joy', 'laugh tears funny'),
      emojiItem('🤣', 'Rolling laugh', 'funny laugh'),
      emojiItem('😊', 'Warm smile', 'happy soft'),
      emojiItem('😍', 'Heart eyes', 'love excited'),
      emojiItem('🥰', 'Loved face', 'love hearts'),
      emojiItem('😎', 'Cool', 'sunglasses confident'),
      emojiItem('🤩', 'Star struck', 'wow excited'),
      emojiItem('🥳', 'Party face', 'celebrate launch'),
      emojiItem('😇', 'Angel', 'thanks kind'),
      emojiItem('🙂', 'Slight smile', 'friendly'),
      emojiItem('😉', 'Wink', 'playful'),
      emojiItem('😌', 'Relieved', 'calm'),
      emojiItem('🤔', 'Thinking', 'question idea'),
      emojiItem('🤯', 'Mind blown', 'wow surprise'),
      emojiItem('😅', 'Sweat smile', 'relief nervous'),
      emojiItem('😭', 'Crying', 'sad emotional'),
      emojiItem('😤', 'Determined', 'focus strong'),
      emojiItem('🙌', 'Raised hands', 'celebrate success'),
      emojiItem('🙏', 'Folded hands', 'thanks please'),
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      emojiItem('👍', 'Thumbs up', 'approve yes like'),
      emojiItem('👎', 'Thumbs down', 'no dislike'),
      emojiItem('👏', 'Clap', 'applause great'),
      emojiItem('🤝', 'Handshake', 'deal partnership'),
      emojiItem('💪', 'Flex', 'strong power'),
      emojiItem('👊', 'Fist bump', 'team win'),
      emojiItem('✌️', 'Peace', 'victory'),
      emojiItem('👌', 'Okay', 'perfect yes'),
      emojiItem('👀', 'Eyes', 'look watch'),
      emojiItem('👉', 'Point right', 'cta direction'),
      emojiItem('👇', 'Point down', 'cta direction'),
      emojiItem('☝️', 'Point up', 'note'),
      emojiItem('🤙', 'Call me', 'contact'),
      emojiItem('🫶', 'Heart hands', 'love support'),
      emojiItem('👐', 'Open hands', 'welcome'),
      emojiItem('🙋', 'Raised hand', 'question volunteer'),
    ],
  },
  {
    name: 'Marketing',
    emojis: [
      emojiItem('🔥', 'Fire', 'hot trending'),
      emojiItem('✨', 'Sparkles', 'new magic'),
      emojiItem('🚀', 'Rocket', 'launch growth'),
      emojiItem('💡', 'Light bulb', 'idea tip'),
      emojiItem('✅', 'Check mark', 'done approved'),
      emojiItem('🎯', 'Target', 'goal focus'),
      emojiItem('📣', 'Megaphone', 'announcement marketing'),
      emojiItem('⭐', 'Star', 'favorite rating'),
      emojiItem('📌', 'Pin', 'important save'),
      emojiItem('💬', 'Speech bubble', 'comment message'),
      emojiItem('💥', 'Collision', 'impact'),
      emojiItem('🏆', 'Trophy', 'winner achievement'),
      emojiItem('🎁', 'Gift', 'offer giveaway'),
      emojiItem('🛍️', 'Shopping bags', 'shop sale'),
      emojiItem('🧲', 'Magnet', 'lead attraction'),
      emojiItem('📈', 'Chart up', 'growth analytics'),
      emojiItem('📊', 'Bar chart', 'report analytics'),
      emojiItem('💰', 'Money bag', 'sales revenue'),
      emojiItem('🧠', 'Brain', 'strategy knowledge'),
      emojiItem('📝', 'Memo', 'note plan'),
      emojiItem('🔔', 'Bell', 'notification reminder'),
      emojiItem('⏰', 'Alarm clock', 'time deadline'),
      emojiItem('🔗', 'Link', 'url connection'),
      emojiItem('🎬', 'Movie camera', 'video content'),
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      emojiItem('❤️', 'Red heart', 'love'),
      emojiItem('🧡', 'Orange heart', 'love'),
      emojiItem('💛', 'Yellow heart', 'love'),
      emojiItem('💚', 'Green heart', 'love'),
      emojiItem('💙', 'Blue heart', 'love'),
      emojiItem('💜', 'Purple heart', 'love'),
      emojiItem('🖤', 'Black heart', 'love'),
      emojiItem('🤍', 'White heart', 'love'),
      emojiItem('💖', 'Sparkling heart', 'love'),
      emojiItem('💕', 'Two hearts', 'love'),
      emojiItem('💯', 'Hundred', 'perfect'),
      emojiItem('💫', 'Dizzy star', 'magic'),
      emojiItem('🌟', 'Glowing star', 'highlight'),
      emojiItem('⚡', 'Lightning', 'fast energy'),
      emojiItem('🌈', 'Rainbow', 'bright pride'),
      emojiItem('☀️', 'Sun', 'bright'),
    ],
  },
  {
    name: 'Objects',
    emojis: [
      emojiItem('📱', 'Phone', 'mobile social'),
      emojiItem('💻', 'Laptop', 'work tech'),
      emojiItem('⌨️', 'Keyboard', 'typing'),
      emojiItem('🎧', 'Headphones', 'audio podcast'),
      emojiItem('📷', 'Camera', 'photo image'),
      emojiItem('🎤', 'Microphone', 'voice podcast'),
      emojiItem('📚', 'Books', 'learn education'),
      emojiItem('🔍', 'Search', 'discover'),
      emojiItem('🧰', 'Toolbox', 'tools'),
      emojiItem('⚙️', 'Gear', 'settings'),
      emojiItem('🗓️', 'Calendar', 'schedule'),
      emojiItem('📅', 'Date calendar', 'schedule'),
      emojiItem('📎', 'Paperclip', 'attachment'),
      emojiItem('📍', 'Location pin', 'location'),
      emojiItem('✉️', 'Envelope', 'email message'),
      emojiItem('🔒', 'Lock', 'secure privacy'),
    ],
  },
  {
    name: 'Nature',
    emojis: [
      emojiItem('🌱', 'Seedling', 'growth new'),
      emojiItem('🌿', 'Herb', 'fresh'),
      emojiItem('🍀', 'Clover', 'luck'),
      emojiItem('🌻', 'Sunflower', 'bright'),
      emojiItem('🌊', 'Wave', 'flow'),
      emojiItem('🏔️', 'Mountain', 'goal journey'),
      emojiItem('🌍', 'Earth', 'global world'),
      emojiItem('🌙', 'Moon', 'night'),
      emojiItem('☁️', 'Cloud', 'cloud'),
      emojiItem('❄️', 'Snowflake', 'cool unique'),
      emojiItem('🍕', 'Pizza', 'food fun'),
      emojiItem('☕', 'Coffee', 'work energy'),
      emojiItem('🍰', 'Cake', 'celebrate'),
      emojiItem('🍿', 'Popcorn', 'watch'),
      emojiItem('🍓', 'Strawberry', 'fresh'),
      emojiItem('🥗', 'Salad', 'healthy'),
    ],
  },
]

function emojiItem(emoji, name, keywords) {
  return { emoji, name, keywords }
}

const INTEGRATION_LABELS = {
  'google-sheets': 'Google Sheets',
  'google-drive': 'Google Drive',
  airtable: 'Airtable',
  notion: 'Notion',
  n8n: 'n8n',
  csv: 'CSV Importer',
  rss: 'RSS Feeds',
  wordpress: 'WordPress',
  webhooks: 'Webhooks',
  'public-api': 'Public API',
  zapier: 'Zapier',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  box: 'Box',
  'aws-s3': 'AWS S3',
  figma: 'Figma',
  canva: 'Canva',
  slack: 'Slack',
  discord: 'Discord',
  'microsoft-teams': 'Microsoft Teams',
}

function getInstalledIntegrationLabels(workspaceKey) {
  try {
    const raw = localStorage.getItem(`postflow_integration_grants:${workspaceKey}`) || localStorage.getItem(`postflow_integrations:${workspaceKey}`)
    const ids = JSON.parse(raw || '[]')
    if (!Array.isArray(ids)) return []
    return ids.map((id) => INTEGRATION_LABELS[id]).filter(Boolean)
  } catch {
    return []
  }
}
