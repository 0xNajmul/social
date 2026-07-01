import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Eye,
  ExternalLink,
  Globe2,
  ImagePlus,
  LayoutTemplate,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Palette,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, Input, PageLoader, Textarea } from '../components/ui'
import PlatformBadge, { PLATFORMS } from '../components/PlatformBadge'
import { mediaUrl } from '../lib/media'
import { PublicProfileCanvas } from './PublicProfileView'

const PROFILE_TEMPLATES = [
  {
    key: 'spotlight',
    name: 'Spotlight',
    description: 'A polished creator profile with an image-led intro and clear calls to action.',
  },
  {
    key: 'links',
    name: 'Link Hub',
    description: 'A compact mobile-first page for social bios, offers, calendars, and content links.',
  },
  {
    key: 'portfolio',
    name: 'Portfolio',
    description: 'A professional profile with bio, credibility details, and organized link groups.',
  },
  {
    key: 'press',
    name: 'Press Kit',
    description: 'A clean public page for contact, press, speaking, and collaboration links.',
  },
]

const THEMES = [
  ['studio', 'Studio dark'],
  ['minimal', 'Minimal light'],
  ['bold', 'Bold contrast'],
  ['creator', 'Creator teal'],
]

const BUTTON_STYLES = [
  ['solid', 'Solid'],
  ['outline', 'Outline'],
  ['soft', 'Soft'],
]

const SOCIAL_ICON_OPTIONS = [
  ['link', 'Website'],
  ['facebook_page', 'Facebook'],
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['twitter', 'X'],
  ['linkedin_profile', 'LinkedIn'],
  ['pinterest', 'Pinterest'],
  ['reddit', 'Reddit'],
  ['threads', 'Threads'],
  ['bluesky', 'Bluesky'],
  ['mastodon', 'Mastodon'],
  ['telegram', 'Telegram'],
  ['discord', 'Discord'],
  ['whatsapp', 'WhatsApp'],
  ['snapchat', 'Snapchat'],
]

export default function PublicProfileEditor() {
  const avatarInputRef = useRef(null)
  const coverInputRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState('small')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    api.get('/public-profile')
      .then(({ data }) => setProfile(normalizeProfile(data.data || {})))
      .catch(() => setProfile(normalizeProfile({})))
  }, [])

  useEffect(() => () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
  }, [avatarPreviewUrl])

  useEffect(() => () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl)
  }, [coverPreviewUrl])

  useEffect(() => {
    if (!copied) return undefined
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  const publicUrl = useMemo(() => {
    if (!profile?.handle || typeof window === 'undefined') return ''
    return `${window.location.origin}/${profile.handle}`
  }, [profile?.handle])
  const publicUrlBase = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/`
  }, [])

  const visibleLinkCount = (profile?.featured_links?.length || 0) + (profile?.links?.length || 0)

  const update = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }))
    setMessage(null)
    if (key !== 'enabled') setCopied(false)
  }

  const updateLink = (collection, index, patch) => {
    setProfile((current) => ({
      ...current,
      [collection]: current[collection].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
    setMessage(null)
  }

  const addLink = (collection) => {
    setProfile((current) => ({
      ...current,
      [collection]: collection === 'featured_links' && current[collection].length
        ? current[collection]
        : [
          ...current[collection],
        {
          label: collection === 'featured_links' ? 'Book a call' : 'New link',
          url: 'https://example.com',
          icon: collection === 'featured_links' ? 'calendar' : 'link',
        },
        ],
    }))
    setMessage(null)
  }

  const removeLink = (collection, index) => {
    setProfile((current) => ({
      ...current,
      [collection]: current[collection].filter((_, itemIndex) => itemIndex !== index),
    }))
    setMessage(null)
  }

  const copyUrl = async () => {
    if (!publicUrl) return
    setCopied(true)
    await copyText(publicUrl)
    setMessage({ type: 'success', text: 'Public profile URL copied.' })
  }

  const uploadProfileImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Choose an image file for the profile image.' })
      event.target.value = ''
      return
    }

    const localUrl = URL.createObjectURL(file)
    setAvatarPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return localUrl
    })
    setAvatarUploading(true)
    setMessage(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/media', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const uploadedUrl = data.data?.url || data.data?.thumbnail_url
      if (!uploadedUrl) throw new Error('Upload returned no image URL.')
      setProfile((current) => ({ ...current, avatar_url: uploadedUrl }))
      setAvatarPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return ''
      })
      setMessage({ type: 'success', text: 'Profile image uploaded. Save your profile to publish it.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not upload profile image.' })
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  const uploadCover = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Choose an image file for the cover.' })
      event.target.value = ''
      return
    }

    const localUrl = URL.createObjectURL(file)
    setCoverPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return localUrl
    })
    setCoverUploading(true)
    setMessage(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/media', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const uploadedUrl = data.data?.url || data.data?.thumbnail_url
      if (!uploadedUrl) throw new Error('Upload returned no image URL.')
      setProfile((current) => ({ ...current, cover_url: uploadedUrl }))
      setCoverPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return ''
      })
      setMessage({ type: 'success', text: 'Cover image uploaded. Save your profile to publish it.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not upload cover image.' })
    } finally {
      setCoverUploading(false)
      event.target.value = ''
    }
  }

  const removeProfileImage = () => {
    setProfile((current) => ({ ...current, avatar_url: '' }))
    setAvatarPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
    setMessage(null)
  }

  const removeCover = () => {
    setProfile((current) => ({ ...current, cover_url: '' }))
    setCoverPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
    setMessage(null)
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const { data } = await api.put('/public-profile', profilePayload(profile))
      setProfile(normalizeProfile(data.data || profile))
      setMessage({ type: 'success', text: data.message || 'Public profile saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || error.response?.data?.errors?.handle?.[0] || 'Could not save public profile.' })
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <PageLoader />
  const previewProfile = { ...profile, avatar_preview_url: avatarPreviewUrl, cover_preview_url: coverPreviewUrl }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                <Globe2 className="h-5 w-5" />
              </span>
              <Badge color={profile.enabled ? 'emerald' : 'gray'}>{profile.enabled ? 'Live profile' : 'Draft profile'}</Badge>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-950 dark:text-white">Public Profile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Build a professional public page for your bio, links, content, booking actions, and social profiles.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={copyUrl}
              className={clsx(copied && 'border-emerald-300 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300')}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Link copied' : 'Copy URL'}
            </Button>
            <a href={publicUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <ExternalLink className="h-4 w-4" /> Open public page
            </a>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPreviewMode('small')
                setPreviewOpen(true)
              }}
            >
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button type="submit" loading={saving}><Save className="h-4 w-4" /> Save</Button>
          </div>
        </div>

        <div className="grid border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-3">
          <StatusMetric icon={UserRound} label="Profile" value={profile.display_name || 'Unnamed'} />
          <StatusMetric icon={Link2} label="Links" value={`${visibleLinkCount} visible`} />
          <StatusMetric icon={LayoutTemplate} label="Template" value={templateName(profile.template)} />
        </div>
      </section>

      {message && (
        <div className={clsx(
          'rounded-xl border px-4 py-3 text-sm font-semibold',
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
        )}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeader icon={Sparkles} title="Publish settings" description="Set the public URL and the first details visitors will see." />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PublicUrlField baseUrl={publicUrlBase} value={profile.handle} onChange={(value) => update('handle', cleanHandle(value))} />
              <Input label="Display name" value={profile.display_name} onChange={(event) => update('display_name', event.target.value)} />
              <Input label="Headline" value={profile.headline} onChange={(event) => update('headline', event.target.value)} placeholder="Creator, founder, storyteller" />
              <Input label="Location" value={profile.location} onChange={(event) => update('location', event.target.value)} placeholder="Dhaka, Bangladesh" />
              <div className="sm:col-span-2">
                <ProfileImageUploader
                  busy={avatarUploading}
                  inputRef={avatarInputRef}
                  previewUrl={avatarPreviewUrl || profile.avatar_url}
                  onRemove={removeProfileImage}
                  onSelect={uploadProfileImage}
                  onUploadClick={() => avatarInputRef.current?.click()}
                />
              </div>
              <div className="sm:col-span-2">
                <CoverImageUploader
                  busy={coverUploading}
                  inputRef={coverInputRef}
                  previewUrl={coverPreviewUrl || profile.cover_url}
                  onRemove={removeCover}
                  onSelect={uploadCover}
                  onUploadClick={() => coverInputRef.current?.click()}
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea label="Bio" rows={6} value={profile.bio} onChange={(event) => update('bio', event.target.value)} />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader icon={LayoutTemplate} title="Template" description="Choose the public page structure that best fits your audience." />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {PROFILE_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => update('template', template.key)}
                  className={clsx(
                    'group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md',
                    profile.template === template.key
                      ? 'border-brand-400 bg-brand-50 text-brand-900 ring-2 ring-brand-500/20 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700',
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-bold">{template.name}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</span>
                    </span>
                    <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', profile.template === template.key ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-300 text-transparent dark:border-slate-700')}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <TemplateMiniature template={template.key} accent={profile.accent_color} />
                </button>
              ))}
            </div>
          </Card>

          <LinkEditor title="Featured action" description="Add one primary button for booking, offers, downloads, newsletters, or your main visitor action." collection="featured_links" items={profile.featured_links.slice(0, 1)} onAdd={addLink} onUpdate={updateLink} onRemove={removeLink} single />
          <LinkEditor title="Social links" description="Add social profiles and choose matching icons for the public page." collection="links" items={profile.links} onAdd={addLink} onUpdate={updateLink} onRemove={removeLink} social />
        </div>

        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card className="p-5">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
              <span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Publish profile</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Make your public URL available.</span>
              </span>
              <ToggleSwitch checked={Boolean(profile.enabled)} onChange={(value) => update('enabled', value)} />
            </label>
            <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
              <SectionHeader icon={Palette} title="Style" description="Tune the visual mood without changing your content." compact />
            </div>
            <div className="mt-5 space-y-4">
              <Select label="Theme" value={profile.theme} options={THEMES} onChange={(value) => update('theme', value)} />
              <Select label="Button style" value={profile.button_style} options={BUTTON_STYLES} onChange={(value) => update('button_style', value)} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Accent color</span>
                <div className="flex gap-2">
                  <input type="color" value={profile.accent_color || '#4f46e5'} onChange={(event) => update('accent_color', event.target.value)} className="h-11 w-14 rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" />
                  <Input value={profile.accent_color} onChange={(event) => update('accent_color', event.target.value)} className="flex-1" />
                </div>
              </label>
            </div>
          </Card>
          <Button type="submit" loading={saving} className="w-full"><Save className="h-4 w-4" /> Save public profile</Button>
        </aside>
      </div>

      <PreviewPopup
        mode={previewMode}
        onClose={() => setPreviewOpen(false)}
        onModeChange={setPreviewMode}
        open={previewOpen}
        profile={previewProfile}
      />
    </form>
  )
}

function SectionHeader({ compact = false, description, icon: Icon, title }) {
  return (
    <div className="flex items-start gap-3">
      <span className={clsx('flex shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300', compact ? 'h-9 w-9' : 'h-10 w-10')}>
        <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  )
}

function StatusMetric({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-slate-200 px-5 py-4 dark:border-slate-800 sm:border-r sm:last:border-r-0">
      <Icon className="h-4 w-4 shrink-0 text-brand-500" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  )
}

function PublicUrlField({ baseUrl, onChange, value }) {
  return (
    <label className="block sm:col-span-2">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Site address</span>
      <span className="flex min-h-11 overflow-hidden rounded-xl border border-slate-300 bg-white text-sm shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800">
        <span className="flex max-w-[58%] items-center truncate border-r border-slate-200 bg-slate-50 px-3 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {baseUrl || 'https://your-site.com/'}
        </span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="najmul"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </span>
      <span className="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">Choose the username used in your public profile URL.</span>
    </label>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <span className={clsx('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition', checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
        aria-label={checked ? 'Turn public profile off' : 'Turn public profile on'}
      />
      <span className={clsx('h-5 w-5 rounded-full bg-white shadow transition', checked && 'translate-x-5')} />
    </span>
  )
}

function ProfileImageUploader({ busy, inputRef, onRemove, onSelect, onUploadClick, previewUrl }) {
  const resolvedPreview = mediaUrl(previewUrl)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Profile image</span>
        {resolvedPreview && (
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-rose-500 hover:text-rose-600">
            Remove
          </button>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-200 text-slate-400 shadow-lg dark:border-slate-900 dark:bg-slate-800">
            {resolvedPreview ? (
              <img src={resolvedPreview} alt="Profile preview" className="h-full w-full object-contain" />
            ) : (
              <UserRound className="h-10 w-10" />
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">Upload one profile image for the public page. The preview keeps the full image visible.</p>
            <Button type="button" size="sm" variant="secondary" loading={busy} onClick={onUploadClick} className="mt-3">
              <ImagePlus className="h-4 w-4" /> {resolvedPreview ? 'Replace image' : 'Upload image'}
            </Button>
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onSelect} />
    </div>
  )
}

function CoverImageUploader({ busy, inputRef, onRemove, onSelect, onUploadClick, previewUrl }) {
  const resolvedPreview = mediaUrl(previewUrl)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cover image</span>
        {resolvedPreview && (
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-rose-500 hover:text-rose-600">
            Remove
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="relative h-44 bg-slate-200 dark:bg-slate-800">
          {resolvedPreview ? (
            <img src={resolvedPreview} alt="Cover preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <ImagePlus className="h-10 w-10" />
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">Upload one cover image for the public page.</p>
          <Button type="button" size="sm" variant="secondary" loading={busy} onClick={onUploadClick}>
            <ImagePlus className="h-4 w-4" /> {resolvedPreview ? 'Replace image' : 'Upload image'}
          </Button>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onSelect} />
    </div>
  )
}

function LinkEditor({ collection, description, items, onAdd, onRemove, onUpdate, single = false, social = false, title }) {
  const canAdd = !single || items.length === 0

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <SectionHeader icon={Link2} title={title} description={description} compact />
        {canAdd && <Button type="button" size="sm" variant="secondary" onClick={() => onAdd(collection)}><Plus className="h-4 w-4" /> Add</Button>}
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${collection}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_8rem_auto]">
            <Input label="Label" value={item.label} onChange={(event) => onUpdate(collection, index, { label: event.target.value })} />
            <Input label="URL" value={item.url} onChange={(event) => onUpdate(collection, index, { url: event.target.value })} />
            {social ? (
              <SocialIconSelect value={item.icon || 'link'} onChange={(value) => onUpdate(collection, index, { icon: value })} />
            ) : (
              <Input label="Icon" value={item.icon || ''} onChange={(event) => onUpdate(collection, index, { icon: event.target.value })} />
            )}
            <button type="button" onClick={() => onRemove(collection, index)} className="self-end inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label="Remove link"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No links yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add the destinations visitors should find first.</p>
            <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={() => onAdd(collection)}><Plus className="h-4 w-4" /> {single ? 'Add featured action' : 'Add link'}</Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function SocialIconSelect({ onChange, value }) {
  const platform = PLATFORMS[value] ? value : ''

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Icon</span>
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          {platform ? <PlatformBadge platform={platform} size="sm" /> : <Link2 className="h-4 w-4 text-slate-500" />}
        </span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          {SOCIAL_ICON_OPTIONS.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
      </div>
    </label>
  )
}

function PreviewPopup({ mode, onClose, onModeChange, open, profile }) {
  const [layout, setLayout] = useState(() => previewPopupLayout())

  useEffect(() => {
    const syncLayout = () => setLayout(previewPopupLayout())
    syncLayout()
    window.addEventListener('resize', syncLayout)
    window.addEventListener('storage', syncLayout)
    window.addEventListener('postflow:sidebar-toggled', syncLayout)
    return () => {
      window.removeEventListener('resize', syncLayout)
      window.removeEventListener('storage', syncLayout)
      window.removeEventListener('postflow:sidebar-toggled', syncLayout)
    }
  }, [])

  if (!open) return null
  const contentMode = mode === 'screen'
  const fullMode = mode === 'full'
  const contentLeft = layout.desktop && !layout.sidebarHidden ? '16rem' : '0px'
  const stageLabel = mode === 'screen' ? 'Open fullscreen' : mode === 'full' ? 'Exit fullscreen' : 'Open in content area'

  return (
    <div
      className={clsx(
        'fixed z-[180] flex overflow-y-auto transition-[background-color,backdrop-filter,opacity] duration-300 ease-out',
        contentMode && 'bottom-0 right-0 top-16 items-stretch justify-stretch bg-transparent p-0',
        fullMode && 'inset-0 z-[195] items-stretch justify-stretch bg-slate-950/70 p-0 backdrop-blur-sm',
        !contentMode && !fullMode && 'inset-0 items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6',
      )}
      style={contentMode ? { left: contentLeft } : undefined}
      onMouseDown={(event) => event.target === event.currentTarget && !contentMode && onClose()}
    >
      <section
        className={clsx(
          'relative flex min-w-0 w-full flex-col overflow-hidden bg-white shadow-2xl transition-[width,height,max-width,max-height,border-radius,transform,opacity,box-shadow] duration-300 ease-out dark:bg-slate-900',
          contentMode && 'h-full max-h-none max-w-none rounded-none border-0 shadow-none',
          fullMode && 'h-full max-h-none max-w-none rounded-none border-0 shadow-none',
          !contentMode && !fullMode && 'my-auto rounded-2xl border border-slate-200 dark:border-slate-800',
          !contentMode && !fullMode && previewModeClass(mode),
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Public profile preview"
      >
        <div className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Preview</p>
            <h2 className="truncate text-sm font-bold text-slate-950 dark:text-white">{templateName(profile.template)}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange(nextPreviewMode(mode))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label={stageLabel}
              title={stageLabel}
            >
              {fullMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 dark:bg-slate-950">
          <PublicProfileCanvas embedded profile={profile} />
        </div>
      </section>
    </div>
  )
}

function TemplateMiniature({ accent, template }) {
  return (
    <span className="mt-4 grid h-20 grid-cols-3 gap-2 rounded-lg border border-current/10 bg-white/70 p-2 dark:bg-slate-950/40">
      <span className={clsx('rounded-md', template === 'links' ? 'col-span-3' : 'col-span-2')} style={{ backgroundColor: `${accent || '#4f46e5'}22` }} />
      <span className={clsx('rounded-md bg-slate-200 dark:bg-slate-700', template === 'portfolio' && 'row-span-2')} />
      <span className="rounded-md bg-slate-100 dark:bg-slate-800" />
      <span className={clsx('rounded-md', template === 'press' ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-100 dark:bg-slate-800')} />
      <span className="rounded-md" style={{ backgroundColor: accent || '#4f46e5' }} />
    </span>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function normalizeProfile(data) {
  return {
    enabled: false,
    handle: '',
    display_name: '',
    headline: '',
    bio: '',
    location: '',
    avatar_url: '',
    cover_url: '',
    template: 'spotlight',
    theme: 'studio',
    accent_color: '#4f46e5',
    button_style: 'solid',
    links: [],
    featured_links: [],
    ...data,
  }
}

function profilePayload(profile) {
  return {
    ...profile,
    avatar_preview_url: undefined,
    cover_preview_url: undefined,
    featured_links: (profile.featured_links || []).slice(0, 1),
    links: profile.links || [],
  }
}

function cleanHandle(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
}

async function copyText(value) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable.')
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    if (typeof document === 'undefined') return false
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  }
}

function templateName(value) {
  return PROFILE_TEMPLATES.find((template) => template.key === value)?.name || 'Spotlight'
}

function previewModeClass(mode) {
  return {
    small: 'h-[min(520px,calc(100vh-7rem))] w-[min(360px,calc(100vw-2rem))]',
    content: 'h-[min(760px,calc(100vh-7rem))] w-[min(760px,calc(100vw-2rem))]',
    wide: 'h-[min(780px,calc(100vh-7rem))] w-[min(1180px,calc(100vw-2rem))]',
  }[mode] || 'h-[min(520px,calc(100vh-7rem))] w-[min(360px,calc(100vw-2rem))]'
}

function nextPreviewMode(mode) {
  if (mode === 'screen') return 'full'
  if (mode === 'full') return 'small'
  return 'screen'
}

function previewPopupLayout() {
  if (typeof window === 'undefined') return { desktop: false, sidebarHidden: true }
  return {
    desktop: window.matchMedia('(min-width: 1024px)').matches,
    sidebarHidden: localStorage.getItem('postflow_sidebar_hidden') === 'true',
  }
}
