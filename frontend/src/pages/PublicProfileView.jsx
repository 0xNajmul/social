import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, ExternalLink, Heart, Link2, Mail, MapPin, Newspaper, UserRound } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { PageLoader } from '../components/ui'
import PlatformBadge, { PLATFORMS } from '../components/PlatformBadge'
import { mediaUrl } from '../lib/media'

const TEMPLATE_COMPONENTS = {
  spotlight: SpotlightTemplate,
  links: LinkHubTemplate,
  portfolio: PortfolioTemplate,
  press: PressKitTemplate,
}

export default function PublicProfileView() {
  const { handle } = useParams()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    api.get(`/public/profiles/${handle}`)
      .then(({ data }) => setProfile(normalizeProfile(data.data || {})))
      .catch(() => setProfile(false))
  }, [handle])

  if (profile === null) return <PageLoader />
  if (profile === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase text-slate-400">Profile not found</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">This public profile is not available.</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"><ArrowLeft className="h-4 w-4" /> Back home</Link>
        </div>
      </main>
    )
  }

  return <PublicProfileCanvas profile={profile} />
}

export function PublicProfileCanvas({ embedded = false, profile }) {
  const normalizedProfile = normalizeProfile(profile || {})
  const Template = TEMPLATE_COMPONENTS[normalizedProfile.template] || SpotlightTemplate
  const theme = themeClasses(normalizedProfile.theme)

  return (
    <main className={clsx(embedded ? 'min-h-full' : 'min-h-screen', theme.page)}>
      <Template embedded={embedded} profile={normalizedProfile} theme={theme} />
    </main>
  )
}

function SpotlightTemplate({ embedded = false, profile, theme }) {
  const accent = profile.accent_color || '#4f46e5'
  return (
    <section className={clsx('mx-auto flex w-full max-w-6xl flex-col px-5 py-6 sm:px-8', embedded ? 'min-h-full' : 'min-h-screen')}>
      <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
        <article className={clsx('overflow-hidden rounded-lg border shadow-2xl', theme.surface)}>
          <Cover profile={profile} accent={accent} className="h-64 sm:h-80" />
          <div className="p-5 sm:p-8">
            <Avatar profile={profile} className="-mt-20 h-28 w-28 border-4" />
            <ProfileIntro profile={profile} accent={accent} titleClassName="text-4xl sm:text-5xl" />
          </div>
        </article>

        <aside className="space-y-3">
          <LinkList profile={profile} links={profile.featured_links} featured />
          <LinkList profile={profile} links={profile.links} />
          <EmptyLinks profile={profile} />
        </aside>
      </div>
      <PublicFooter theme={theme} />
    </section>
  )
}

function LinkHubTemplate({ embedded = false, profile, theme }) {
  const accent = profile.accent_color || '#4f46e5'
  return (
    <section className={clsx('mx-auto flex w-full max-w-xl flex-col px-5 py-6', embedded ? 'min-h-full' : 'min-h-screen')}>
      <div className={clsx('mt-6 overflow-hidden rounded-lg border shadow-xl', theme.surface)}>
        <Cover profile={profile} accent={accent} className="h-36" />
        <div className="px-5 pb-6 text-center">
          <Avatar profile={profile} className="-mt-14 mx-auto h-24 w-24 border-4" />
          <ProfileIntro profile={profile} accent={accent} centered titleClassName="text-3xl" />
          <div className="mt-6 space-y-3 text-left">
            <LinkList profile={profile} links={profile.featured_links} featured />
            <LinkList profile={profile} links={profile.links} />
            <EmptyLinks profile={profile} />
          </div>
        </div>
      </div>
      <PublicFooter theme={theme} />
    </section>
  )
}

function PortfolioTemplate({ embedded = false, profile, theme }) {
  const accent = profile.accent_color || '#4f46e5'
  return (
    <section className={clsx('mx-auto flex w-full max-w-6xl flex-col px-5 py-6 sm:px-8', embedded ? 'min-h-full' : 'min-h-screen')}>
      <div className="grid gap-6 py-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className={clsx('h-fit rounded-lg border p-5 shadow-xl lg:sticky lg:top-6', theme.surface)}>
          <Avatar profile={profile} className="h-24 w-24 border-4" />
          <ProfileIntro profile={profile} accent={accent} titleClassName="text-3xl" />
        </aside>

        <div className="space-y-6">
          <article className={clsx('overflow-hidden rounded-lg border shadow-xl', theme.surface)}>
            <Cover profile={profile} accent={accent} className="h-72" />
          </article>

          <PublicPanel icon={Briefcase} title="Featured actions" theme={theme}>
            <LinkGrid profile={profile} links={profile.featured_links} featured />
            {!profile.featured_links.length && <EmptyPanelText theme={theme}>No featured actions yet.</EmptyPanelText>}
          </PublicPanel>

          <PublicPanel icon={Link2} title="Links and profiles" theme={theme}>
            <LinkGrid profile={profile} links={profile.links} />
            {!profile.links.length && <EmptyPanelText theme={theme}>No public links yet.</EmptyPanelText>}
          </PublicPanel>
        </div>
      </div>
      <PublicFooter theme={theme} />
    </section>
  )
}

function PressKitTemplate({ embedded = false, profile, theme }) {
  const accent = profile.accent_color || '#4f46e5'
  return (
    <section className={clsx('mx-auto flex w-full max-w-6xl flex-col px-5 py-6 sm:px-8', embedded ? 'min-h-full' : 'min-h-screen')}>
      <div className={clsx('mt-8 overflow-hidden rounded-lg border shadow-2xl', theme.surface)}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="p-6 sm:p-8">
            <Avatar profile={profile} className="h-24 w-24 border-4" />
            <ProfileIntro profile={profile} accent={accent} showBio={false} titleClassName="text-4xl sm:text-5xl" />
          </div>
          <Cover profile={profile} accent={accent} className="min-h-72 lg:h-full" />
        </div>
      </div>

      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <PublicPanel icon={Newspaper} title="Profile brief" theme={theme}>
          <p className={clsx('whitespace-pre-wrap text-sm leading-7', theme.muted)}>{profile.bio || 'Profile details will appear here.'}</p>
        </PublicPanel>

        <PublicPanel icon={Mail} title="Contact and links" theme={theme}>
          <div className="space-y-3">
            <LinkList profile={profile} links={profile.featured_links} featured />
            <LinkList profile={profile} links={profile.links} />
            <EmptyLinks profile={profile} />
          </div>
        </PublicPanel>
      </div>
      <PublicFooter theme={theme} />
    </section>
  )
}

function PublicFooter({ theme }) {
  return (
    <footer className="mt-auto pb-2 pt-6 text-center">
      <div className={clsx('inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border px-4 py-2 text-sm font-semibold', theme.nav)}>
        <span className="inline-flex items-center gap-1.5 opacity-80">
          Made with <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> by Postflow.
        </span>
        <Link to="/" className="text-brand-500 transition hover:text-brand-400 hover:underline dark:text-brand-300 dark:hover:text-brand-200">
          Create your own link
        </Link>
      </div>
    </footer>
  )
}

function Cover({ accent, className, profile }) {
  const coverUrl = profile.cover_preview_url || profile.cover_url
  return (
    <div
      className={clsx('bg-slate-200 dark:bg-slate-800', className)}
      style={{
        background: coverUrl ? `url(${coverUrl}) center/cover` : accent,
      }}
    />
  )
}

function Avatar({ className, profile }) {
  const avatarUrl = mediaUrl(profile.avatar_preview_url || profile.avatar_url)

  return (
    <div className={clsx('flex items-center justify-center overflow-hidden rounded-full border-current bg-white text-slate-800 shadow-xl dark:bg-slate-900 dark:text-white', className)}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-contain" /> : <UserRound className="h-10 w-10" />}
    </div>
  )
}

function ProfileIntro({ accent, centered = false, profile, showBio = true, titleClassName }) {
  return (
    <div className={clsx('mt-5', centered && 'text-center')}>
      <h1 className={clsx('font-black leading-tight', titleClassName)}>{profile.display_name}</h1>
      {profile.headline && <p className="mt-4 max-w-2xl text-lg font-semibold leading-7" style={{ color: accent }}>{profile.headline}</p>}
      {profile.location && <p className={clsx('mt-4 inline-flex items-center gap-2 text-sm opacity-70', centered && 'justify-center')}><MapPin className="h-4 w-4" /> {profile.location}</p>}
      {showBio && profile.bio && <p className="mt-5 max-w-2xl whitespace-pre-wrap text-base leading-8 opacity-80">{profile.bio}</p>}
    </div>
  )
}

function PublicPanel({ children, icon: Icon, theme, title }) {
  return (
    <section className={clsx('rounded-lg border p-5 shadow-xl', theme.surface)}>
      <div className="mb-4 flex items-center gap-3">
        <span className={clsx('flex h-10 w-10 items-center justify-center rounded-lg', theme.icon)}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function LinkList({ featured = false, links, profile }) {
  return (
    <>
      {(links || []).map((link) => <ProfileLink key={`${featured ? 'featured' : 'link'}-${link.label}-${link.url}`} link={link} profile={profile} featured={featured} />)}
    </>
  )
}

function LinkGrid({ featured = false, links, profile }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(links || []).map((link) => <ProfileLink key={`${featured ? 'featured' : 'link'}-${link.label}-${link.url}`} link={link} profile={profile} featured={featured} />)}
    </div>
  )
}

function ProfileLink({ featured = false, link, profile }) {
  const accent = profile.accent_color || '#4f46e5'
  const styleType = profile.button_style || 'solid'
  const solid = styleType === 'solid' && featured
  const soft = styleType === 'soft'
  const platform = socialPlatformForLink(link)

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="group flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{
        borderColor: accent,
        backgroundColor: solid ? accent : soft ? `${accent}22` : 'transparent',
        color: solid ? '#fff' : accent,
      }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/10 text-current">
        {platform ? <PlatformBadge platform={platform} size="sm" className="!h-9 !w-9 !rounded-lg !p-2 shadow-none" /> : <Link2 className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{link.label}</span>
      <ExternalLink className="h-4 w-4 shrink-0 opacity-60 transition group-hover:opacity-100" />
    </a>
  )
}

function EmptyLinks({ profile }) {
  if ((profile.links || []).length || (profile.featured_links || []).length) return null
  return <p className="rounded-lg border border-current/10 p-5 text-sm opacity-60">No public links yet.</p>
}

function EmptyPanelText({ children, theme }) {
  return <p className={clsx('rounded-lg border border-current/10 p-4 text-sm', theme.muted)}>{children}</p>
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
    avatar_preview_url: '',
    cover_url: '',
    cover_preview_url: '',
    template: 'spotlight',
    theme: 'studio',
    accent_color: '#4f46e5',
    button_style: 'solid',
    links: [],
    featured_links: [],
    ...data,
  }
}

function socialPlatformForLink(link) {
  const raw = String(link?.icon || '').toLowerCase().trim()
  const iconAliases = {
    facebook: 'facebook_page',
    fb: 'facebook_page',
    instagram: 'instagram',
    ig: 'instagram',
    tiktok: 'tiktok',
    youtube: 'youtube',
    yt: 'youtube',
    x: 'twitter',
    twitter: 'twitter',
    linkedin: 'linkedin_profile',
    pinterest: 'pinterest',
    reddit: 'reddit',
    threads: 'threads',
    bluesky: 'bluesky',
    mastodon: 'mastodon',
    telegram: 'telegram',
    discord: 'discord',
    whatsapp: 'whatsapp',
    snapchat: 'snapchat',
  }
  if (PLATFORMS[raw]) return raw
  if (iconAliases[raw]) return iconAliases[raw]

  const url = String(link?.url || '').toLowerCase()
  if (url.includes('facebook.com')) return 'facebook_page'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
  if (url.includes('linkedin.com')) return 'linkedin_profile'
  if (url.includes('pinterest.')) return 'pinterest'
  if (url.includes('reddit.com')) return 'reddit'
  if (url.includes('threads.net')) return 'threads'
  if (url.includes('bsky.app')) return 'bluesky'
  if (url.includes('mastodon.')) return 'mastodon'
  if (url.includes('t.me') || url.includes('telegram.')) return 'telegram'
  if (url.includes('discord.')) return 'discord'
  if (url.includes('wa.me') || url.includes('whatsapp.')) return 'whatsapp'
  if (url.includes('snapchat.com')) return 'snapchat'
  return ''
}

function themeClasses(theme) {
  return {
    studio: {
      page: 'bg-slate-950 text-white',
      surface: 'border-white/10 bg-white/10',
      muted: 'text-slate-300',
      nav: 'border-white/10 bg-white/10 text-white',
      icon: 'bg-white/10 text-white',
    },
    minimal: {
      page: 'bg-slate-50 text-slate-950',
      surface: 'border-slate-200 bg-white',
      muted: 'text-slate-600',
      nav: 'border-slate-200 bg-white text-slate-700',
      icon: 'bg-slate-100 text-slate-700',
    },
    bold: {
      page: 'bg-zinc-950 text-white',
      surface: 'border-white/10 bg-zinc-900',
      muted: 'text-zinc-300',
      nav: 'border-white/10 bg-white/10 text-white',
      icon: 'bg-white/10 text-white',
    },
    creator: {
      page: 'bg-teal-950 text-white',
      surface: 'border-white/10 bg-white/10',
      muted: 'text-teal-100',
      nav: 'border-white/10 bg-white/10 text-white',
      icon: 'bg-white/10 text-white',
    },
  }[theme] || {
    page: 'bg-slate-950 text-white',
    surface: 'border-white/10 bg-white/10',
    muted: 'text-slate-300',
    nav: 'border-white/10 bg-white/10 text-white',
    icon: 'bg-white/10 text-white',
  }
}
