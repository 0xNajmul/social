import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, BellRing, Bot, CalendarDays, Check, CheckCircle2,
  Building2, ChevronDown, ChevronRight, Clock3, FileCheck2, Gauge, Image as ImageIcon,
  Layers3, LogOut, Menu, Play, Send, ShieldCheck,
  Sparkles, Users, WandSparkles, Workflow, X, Zap,
} from 'lucide-react'
import api from '../lib/api'
import PlatformBadge, { PLATFORMS } from '../components/PlatformBadge'
import { useAuth } from '../context/AuthContext'
import { mediaUrl } from '../lib/media'

const PRODUCT_PILLARS = [
  {
    icon: WandSparkles,
    eyebrow: 'Create',
    title: 'Turn one idea into content for every channel',
    desc: 'Draft once, generate platform-specific variations, add media, links and hashtags, then preview each network before anything goes live.',
    className: 'lg:col-span-7',
    visual: 'composer',
  },
  {
    icon: CalendarDays,
    eyebrow: 'Publish',
    title: 'See the whole month at a glance',
    desc: 'Drag posts to a better day, open details in place and keep scheduled, draft and published work easy to spot.',
    className: 'lg:col-span-5',
    visual: 'calendar',
  },
  {
    icon: Workflow,
    eyebrow: 'Automate',
    title: 'Build a content engine that keeps moving',
    desc: 'Trigger repeatable workflows, recycle evergreen posts and keep your publishing queue active while your team focuses on the work that needs judgment.',
    className: 'min-h-[430px] lg:col-span-5',
    visual: 'automation',
  },
  {
    icon: BarChart3,
    eyebrow: 'Understand',
    title: 'Replace scattered numbers with one clear view',
    desc: 'Compare publishing activity and performance across accounts, campaigns and time periods without stitching together spreadsheets.',
    className: 'lg:col-span-7',
    visual: 'analytics',
  },
]

const WORKFLOW_STEPS = [
  { icon: Layers3, number: '01', title: 'Connect your channels', desc: 'Bring profiles, pages, boards and communities into one secure workspace.' },
  { icon: WandSparkles, number: '02', title: 'Create once', desc: 'Write the core message, attach media and tailor the details that matter per platform.' },
  { icon: CalendarDays, number: '03', title: 'Plan the rollout', desc: 'Publish now or place every variation into a visual content calendar.' },
  { icon: Gauge, number: '04', title: 'Learn and improve', desc: 'Follow publishing status and performance from the same command center.' },
]

const AUDIENCES = [
  {
    title: 'Creators',
    desc: 'Stay consistent without turning content management into a second full-time job.',
    bullets: ['Save and shape content ideas', 'Cross-post without copy-paste', 'Plan weeks ahead'],
    gradient: 'from-violet-500/20 to-fuchsia-500/5',
  },
  {
    title: 'Growing teams',
    desc: 'Give everyone a clear place to create, review, approve and publish.',
    bullets: ['Shared workspaces and roles', 'Approval-ready workflows', 'Activity history and alerts'],
    gradient: 'from-sky-500/20 to-cyan-500/5',
  },
  {
    title: 'Agencies',
    desc: 'Keep client channels organized while your team moves quickly across campaigns.',
    bullets: ['Multiple workspaces', 'Granular account access', 'Scalable plans and reporting'],
    gradient: 'from-amber-500/20 to-orange-500/5',
  },
]

const FAQS = [
  ['Which social networks can I connect?', 'Postflow is designed for a broad mix of major and emerging channels, including Facebook, Instagram, TikTok, YouTube, LinkedIn, Pinterest, Reddit, Bluesky, Mastodon, Telegram and more. Available publishing formats depend on each network API.'],
  ['Can I customize a post for each platform?', 'Yes. Start with one shared idea, then adjust the copy, media and platform-specific options for each destination before scheduling or publishing.'],
  ['Does Postflow support teams and approvals?', 'Yes. Workspaces, roles, invitations, activity history and approval-oriented workflows help teams move quickly without losing control.'],
  ['Can I schedule and reschedule posts visually?', 'Yes. The calendar shows publishing status and lets you move scheduled content by date, open details, update timing and remove posts.'],
  ['How are connected account credentials protected?', 'Provider tokens are encrypted at rest, hidden from API responses and handled by the backend rather than exposed in the browser.'],
]

const PLATFORM_KEYS = [
  'facebook_page', 'instagram', 'tiktok', 'youtube', 'linkedin_profile', 'pinterest',
  'reddit', 'threads', 'bluesky', 'mastodon', 'google_business', 'telegram', 'discord',
]

const FALLBACK_PLANS = [
  { id: 'free', name: 'Free', description: 'Explore the essentials.', price_monthly: 0, price_yearly: 0, features: ['3 social accounts', '10 scheduled posts', 'Basic analytics', '1 automation'] },
  { id: 'starter', name: 'Starter', description: 'For consistent solo creators.', price_monthly: 19, price_yearly: 190, features: ['10 social accounts', '100 scheduled posts', 'AI assistant', 'Calendar and analytics'] },
  { id: 'pro', name: 'Pro', description: 'For growing teams and agencies.', price_monthly: 49, price_yearly: 490, is_featured: true, features: ['30 social accounts', 'Approval workflows', 'Advanced analytics', 'API and webhooks'] },
  { id: 'business', name: 'Business', description: 'For larger organizations.', price_monthly: 99, price_yearly: 990, features: ['Unlimited scale', 'Priority support', 'SSO and audit logs', 'Dedicated success manager'] },
]

const MENU_ICON_COMPONENTS = {
  analytics: BarChart3,
  automation: Workflow,
  automations: Workflow,
  bot: Bot,
  calendar: CalendarDays,
  content: FileCheck2,
  dashboard: Gauge,
  image: ImageIcon,
  media: ImageIcon,
  plan: CalendarDays,
  planner: CalendarDays,
  security: ShieldCheck,
  sparkle: Sparkles,
  team: Users,
  users: Users,
  workflow: Workflow,
}

export default function Landing() {
  const { user, activeWorkspace, logout } = useAuth()
  const [plans, setPlans] = useState([])
  const [latestNews, setLatestNews] = useState([])
  const [settings, setSettings] = useState(null)
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [previewTab, setPreviewTab] = useState('calendar')
  const [showCookieConsent, setShowCookieConsent] = useState(() => localStorage.getItem('postflow_cookie_consent') !== 'accepted')
  const accountMenuRef = useRef(null)

  useEffect(() => {
    document.title = 'Postflow - Plan, publish and grow everywhere'
    api
      .get('/public/settings')
      .then(({ data }) => {
        const publicSettings = data?.data || data || {}
        setSettings(publicSettings)
        const name = publicSettings?.general?.site_name || publicSettings?.platform_name || 'Postflow'
        document.title = publicSettings?.seo?.meta_title || `${name} - Plan, publish and grow everywhere`
      })
      .catch(() => {})
    api
      .get('/plans')
      .then(({ data }) => setPlans(Array.isArray(data.data) && data.data.length ? data.data : FALLBACK_PLANS))
      .catch(() => setPlans(FALLBACK_PLANS))
    api
      .get('/public/news', { params: { limit: 3 } })
      .then(({ data }) => setLatestNews(Array.isArray(data.data) ? data.data : []))
      .catch(() => setLatestNews([]))
  }, [])

  useEffect(() => {
    const revealItems = document.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }),
      { threshold: 0.12 },
    )
    revealItems.forEach((item) => observer.observe(item))

    return () => observer.disconnect()
  }, [latestNews.length, plans.length])

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setAccountOpen(false)
        setMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', closeAccountMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeAccountMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const displayedPlans = plans.length ? plans : FALLBACK_PLANS
  const hasLifetimePlans = displayedPlans.some((plan) => plan.lifetime_enabled)
  const primaryHref = user ? '/app' : '/register'
  const primaryLabel = user ? 'Open dashboard' : 'Start for free'
  const brandName = settings?.general?.site_name || settings?.platform_name || 'Postflow'
  const logoUrl = settings?.general?.logo_url
  const navigationItems = menuItemsFromSettings(settings?.main_menu?.items)
  const footerTopText = publicFooterText(settings?.footer?.top_text)
  const footerBottomText = publicFooterText(settings?.footer?.bottom_text)
  const footerColumns = footerColumnsFromSettings(settings?.footer?.columns)
  const hasFooterContent = Boolean(
    footerTopText
      || footerBottomText
      || footerColumns.some((column) => column.title || column.widgets.length),
  )
  const footerGridTemplate = ['minmax(0,1.4fr)', ...footerColumns.map((column) => column.width || '1fr')].join(' ')
  const workspaceName = activeWorkspace?.name || 'Workspace'
  const currentPlanName = activeWorkspace?.subscription?.plan?.name || activeWorkspace?.subscription?.plan_name || (user ? 'Free' : '')
  const planRenewDate = activeWorkspace?.subscription?.renews_at || activeWorkspace?.subscription?.ends_at || activeWorkspace?.subscription?.trial_ends_at
  const normalizePlan = (value) => String(value || '').trim().toLowerCase()
  const handleLogout = async () => {
    await logout()
    setAccountOpen(false)
  }
  const acceptCookieConsent = () => {
    localStorage.setItem('postflow_cookie_consent', 'accepted')
    setShowCookieConsent(false)
  }

  return (
    <div className="landing min-h-screen overflow-hidden bg-[#f7f7f5] text-slate-950 selection:bg-indigo-200 dark:bg-[#090c12] dark:text-white dark:selection:bg-indigo-700">

      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-900/5 bg-[#f8f7f3]/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#080b12]/75">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            {navigationItems.length > 0 && (
              <button
                className="rounded-xl border border-slate-900/10 p-2 text-slate-700 dark:border-white/10 dark:text-slate-200 lg:hidden"
                onClick={() => {
                  setMobileOpen(true)
                  setAccountOpen(false)
                }}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <Link to="/" className="flex items-center gap-2.5" aria-label={`${brandName} home`}>
              <LogoMark logoUrl={logoUrl} />
              <span className="text-lg font-extrabold tracking-[-0.035em]">{brandName}</span>
            </Link>
          </div>

          {navigationItems.length > 0 && (
            <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 dark:text-slate-300 lg:flex">
              {navigationItems.map((item) => (
                <DesktopNavItem key={`${item.label}-${item.href}`} item={item} />
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            {!user && <Link to="/login" className="hidden px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline-flex">Log in</Link>}
            {user ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-slate-900/10 bg-white/70 px-2.5 py-1.5 text-left shadow-sm backdrop-blur transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black uppercase text-white">{user.name?.[0] || 'U'}</span>
                  )}
                  <span className="hidden max-w-36 truncate text-sm font-semibold text-slate-700 dark:text-slate-200 sm:block">{user.name}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-900/10 bg-white p-1.5 shadow-2xl shadow-slate-900/15 dark:border-white/10 dark:bg-slate-900" role="menu">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{user.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      <p className="mt-2 flex items-center gap-1.5 truncate text-xs font-semibold text-indigo-600 dark:text-indigo-300" title={workspaceName}>
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{workspaceName}</span>
                      </p>
                    </div>
                    <div className="my-1 border-t border-slate-100 dark:border-white/10" />
                    <Link to="/app" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5" role="menuitem">
                      <Gauge className="h-4 w-4" /> Dashboard
                    </Link>
                    <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" role="menuitem">
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to={primaryHref} className="landing-button-primary px-3.5 py-2.5 text-xs sm:px-5 sm:text-sm">
                <span className="sm:hidden">Get started</span><span className="hidden sm:inline">{primaryLabel}</span> <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

      </header>

      {navigationItems.length > 0 && (
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className="absolute inset-y-0 flex w-[min(22rem,86vw)] flex-col border-r border-slate-900/10 bg-[#f8f7f3] shadow-2xl transition-[left] duration-300 ease-out dark:border-white/10 dark:bg-[#080b12]"
          style={{
            left: mobileOpen ? '0px' : '-100vw',
            transform: 'none',
            translate: 'none',
          }}
        >
          <div className="flex h-16 items-center gap-2.5 border-b border-slate-900/5 px-5 dark:border-white/10">
            <LogoMark logoUrl={logoUrl} />
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-[-0.035em]">{brandName}</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            {navigationItems.map((item) => (
              <div key={`${item.label}-${item.href}`}>
                <a href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold hover:bg-slate-900/5 dark:hover:bg-white/5">
                  {item.label} {item.items && <ChevronRight className="h-4 w-4 text-slate-400" />}
                </a>
                {item.items && (
                  <div className="ml-3 border-l border-slate-900/10 pl-3 dark:border-white/10">
                    {item.items.map((child) => {
                      const navChild = normalizeNavChild(child)
                      return (
                      <a key={navChild.label} href={navChild.href} onClick={() => setMobileOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm hover:bg-slate-900/5 dark:hover:bg-white/5">
                        <span className="flex items-center gap-2 font-semibold"><MenuIcon name={navChild.icon} className="h-4 w-4 text-indigo-500" />{navChild.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{navChild.description}</span>
                      </a>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {!user && <Link to="/login" className="rounded-xl px-3 py-3 text-sm font-semibold">Log in</Link>}
          </nav>
        </aside>
      </div>
      )}

      <main>
        <section className="relative pt-16">
          <div className="landing-orb landing-orb-one" />
          <div className="landing-orb landing-orb-two" />
          <div className="mx-auto grid min-h-[700px] max-w-7xl items-center gap-10 px-5 py-14 lg:grid-cols-[0.88fr_1.12fr] lg:px-8 lg:py-18">
            <div className="relative z-10 pt-8 lg:pt-0">
              <div className="landing-hero-in landing-delay-1 inline-flex items-center gap-2 rounded-full border border-indigo-300/50 bg-white/75 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-400/20 dark:bg-white/5 dark:text-indigo-300">
                <Sparkles className="h-3.5 w-3.5" /> One workspace. Every social channel.
              </div>
              <h1 className="landing-hero-in landing-delay-2 mt-6 max-w-3xl text-[clamp(3rem,6.4vw,5.7rem)] font-black leading-[0.94] tracking-[-0.06em]">
                Make social feel
                <span className="landing-gradient-text block pb-2">less scattered.</span>
              </h1>
              <p className="landing-hero-in landing-delay-3 mt-6 max-w-xl text-[17px] leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                Plan, create, approve and publish content across your channels from one calm workspace. Postflow keeps the details organized so your ideas can move faster.
              </p>
              <div className="landing-hero-in landing-delay-4 mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={primaryHref} className="landing-button-primary px-5 py-3 text-sm">
                  {primaryLabel} <ArrowRight className="h-5 w-5" />
                </Link>
                <a href="#product" className="landing-button-secondary px-5 py-3 text-sm">
                  <Play className="h-4 w-4 fill-current" /> Explore the product
                </a>
              </div>
              <div className="landing-hero-in landing-delay-5 mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {['Free plan available', 'No credit card required', 'Encrypted account tokens'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {item}</span>
                ))}
              </div>
            </div>

            <HeroProductPreview activeTab={previewTab} onTabChange={setPreviewTab} />
          </div>
        </section>

        <section id="platforms" className="border-y border-slate-900/10 bg-white/55 py-7 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 lg:flex-row lg:px-8">
            <p className="shrink-0 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400 lg:text-left">Built for the channels<br className="hidden lg:block" /> your audience uses</p>
            <div className="landing-marquee-mask min-w-0 flex-1 overflow-hidden">
              <div className="landing-marquee-track flex w-max items-center gap-3">
                {[...PLATFORM_KEYS, ...PLATFORM_KEYS].map((key, index) => (
                  <div key={`${key}-${index}`} className="flex items-center gap-2 rounded-full border border-slate-900/8 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <PlatformBadge platform={key} size="xs" />
                    <span className="whitespace-nowrap text-xs font-semibold text-slate-600 dark:text-slate-300">{PLATFORMS[key]?.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div data-reveal className="landing-reveal grid overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 text-white shadow-2xl shadow-indigo-950/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['19', 'network types in one registry'],
              ['1', 'visual calendar for every campaign'],
              ['24/7', 'scheduled publishing pipeline'],
              ['100%', 'encrypted provider credentials'],
            ].map(([number, label], index) => (
              <div key={label} className={`p-6 lg:p-7 ${index > 0 ? 'border-t border-white/10 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 lg:border-l' : ''}`}>
                <div className="text-3xl font-black tracking-[-0.05em] text-indigo-300">{number}</div>
                <p className="mt-1.5 max-w-44 text-xs leading-5 text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="mx-auto max-w-7xl px-5 py-18 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="The Postflow workspace"
            title="Everything between the idea and the result."
            body="The best social tools turn a noisy, multi-step job into a simple operating rhythm. Postflow brings the core workflow together without making the interface feel heavy."
          />

          <div className="mt-11 grid gap-4 lg:grid-cols-12">
            {PRODUCT_PILLARS.map((pillar, index) => (
              <article
                key={pillar.title}
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` }}
                className={`landing-reveal group relative min-h-[390px] overflow-hidden rounded-[1.6rem] border border-slate-900/10 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.045] sm:p-8 ${pillar.className}`}
              >
                <div className="relative z-10 max-w-lg">
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                    <pillar.icon className="h-4 w-4" /> {pillar.eyebrow}
                  </div>
                  <h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.04em] sm:text-3xl">{pillar.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{pillar.desc}</p>
                </div>
                <PillarVisual type={pillar.visual} />
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="relative border-y border-slate-900/10 bg-[#111827] py-18 text-white dark:border-white/10 lg:py-24">
          <div className="landing-grid-bg absolute inset-0 opacity-20" />
          <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div data-reveal className="landing-reveal lg:sticky lg:top-32 lg:self-start">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">One clear workflow</p>
                <h2 className="mt-4 max-w-xl text-3xl font-black leading-[1.04] tracking-[-0.05em] sm:text-4xl">From disconnected accounts to a repeatable publishing system.</h2>
                <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Connect the channels once. After that, every idea follows a visible path from draft to live post.</p>
              </div>
              <div className="space-y-4">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step.number} data-reveal style={{ '--reveal-delay': `${index * 70}ms` }} className="landing-reveal group grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-5 sm:grid-cols-[58px_1fr] sm:p-6">
                    <div className="flex h-13 w-13 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-300 transition group-hover:bg-indigo-400/25">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black tracking-[0.18em] text-slate-500">STEP {step.number}</span>
                      <h3 className="mt-1.5 text-xl font-bold tracking-tight">{step.title}</h3>
                      <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-300">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-18 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Fits the way you work"
            title="Start simple. Add structure as you grow."
            body="Postflow is useful when one person owns every post and when a whole team shares the responsibility."
          />
          <div className="mt-11 grid gap-4 lg:grid-cols-3">
            {AUDIENCES.map((audience, index) => (
              <article key={audience.title} data-reveal style={{ '--reveal-delay': `${index * 70}ms` }} className={`landing-reveal relative overflow-hidden rounded-[1.6rem] border border-slate-900/10 bg-gradient-to-br ${audience.gradient} p-7 dark:border-white/10 dark:from-white/[0.08] dark:to-white/[0.025]`}>
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border-[22px] border-white/40 dark:border-white/5" />
                <h3 className="relative text-2xl font-black tracking-[-0.04em]">{audience.title}</h3>
                <p className="relative mt-3 min-h-16 text-sm leading-6 text-slate-600 dark:text-slate-300">{audience.desc}</p>
                <ul className="relative mt-6 space-y-2.5">
                  {audience.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2.5 text-sm font-semibold"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-18 lg:px-8 lg:pb-24">
          <div data-reveal className="landing-reveal grid overflow-hidden rounded-[2.2rem] border border-slate-900/10 bg-white shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-white/[0.045] lg:grid-cols-2">
            <div className="p-7 sm:p-10 lg:p-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><ShieldCheck className="h-6 w-6" /></div>
              <h2 className="mt-6 text-3xl font-black tracking-[-0.05em]">Control without bottlenecks.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">Keep credentials protected, give teammates the right level of access and maintain a clear activity trail across workspaces.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {['Encrypted social tokens', 'Workspace roles', 'Approval workflows', 'Activity history', 'Two-factor authentication', 'Admin controls'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold dark:bg-white/5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {item}</div>
                ))}
              </div>
            </div>
            <div className="relative min-h-[410px] overflow-hidden bg-slate-950 p-7 text-white sm:p-9">
              <div className="landing-grid-bg absolute inset-0 opacity-20" />
              <div className="relative flex items-center justify-between">
                <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Live activity</p><p className="mt-1 font-bold">Workspace controls</p></div>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">All systems normal</span>
              </div>
              <div className="relative mt-8 space-y-3">
                {[
                  [FileCheck2, 'Campaign approved', 'Maya approved 6 platform variations', '2m'],
                  [Send, 'Post published', 'Pinterest board: Product Launches', '18m'],
                  [Users, 'Teammate invited', 'Editor access added to Brand workspace', '1h'],
                  [BellRing, 'Schedule updated', 'Launch post moved to Thursday, 10:30', '3h'],
                ].map(([Icon, title, detail, time], index) => (
                  <div key={title} className="landing-activity-in flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4" style={{ animationDelay: `${index * 140}ms` }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-300"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 truncate text-xs text-slate-400">{detail}</p></div>
                    <span className="text-xs text-slate-500">{time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-slate-900/10 bg-white/55 py-18 dark:border-white/10 dark:bg-white/[0.025] lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHeading
              eyebrow="Straightforward pricing"
              title="A plan for the system you need today."
              body="Begin with the essentials, then add accounts, automation and team controls when your operation grows."
            />
            <div className="mt-8 flex justify-center">
              <div className="inline-flex flex-wrap justify-center rounded-full border border-slate-900/10 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
                <button onClick={() => setBillingCycle('monthly')} className={`rounded-full px-5 py-2 text-sm font-bold transition ${billingCycle === 'monthly' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Monthly</button>
                <button onClick={() => setBillingCycle('yearly')} className={`rounded-full px-5 py-2 text-sm font-bold transition ${billingCycle === 'yearly' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Yearly <span className="ml-1 text-emerald-500">save 20%</span></button>
                {hasLifetimePlans && <button onClick={() => setBillingCycle('lifetime')} className={`rounded-full px-5 py-2 text-sm font-bold transition ${billingCycle === 'lifetime' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Lifetime</button>}
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {displayedPlans.map((plan, index) => {
                const rawPrice = Number(billingCycle === 'lifetime' ? (plan.price_lifetime ?? 0) : billingCycle === 'yearly' ? (plan.price_yearly ?? 0) : (plan.price_monthly ?? 0))
                const price = billingCycle === 'yearly' && rawPrice > 0 ? Math.round((rawPrice / 12) * 100) / 100 : rawPrice
                const isCurrent = Boolean(user && currentPlanName && normalizePlan(plan.name) === normalizePlan(currentPlanName))
                const lifetimeUnavailable = billingCycle === 'lifetime' && !plan.lifetime_enabled
                return (
                  <article key={plan.id} data-reveal style={{ '--reveal-delay': `${index * 60}ms` }} className={`landing-reveal relative flex flex-col rounded-[1.5rem] border p-6 ${plan.is_featured ? 'border-indigo-500 bg-slate-950 text-white shadow-xl shadow-indigo-500/10' : 'border-slate-900/10 bg-white dark:border-white/10 dark:bg-white/[0.045]'} ${isCurrent ? 'ring-2 ring-emerald-400/80' : ''} ${lifetimeUnavailable ? 'opacity-60' : ''}`}>
                    {plan.is_featured && <span className="absolute right-5 top-5 rounded-full bg-indigo-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-200">Most popular</span>}
                    {isCurrent && <span className="absolute left-5 top-5 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Current plan</span>}
                    <h3 className={`text-xl font-black ${isCurrent ? 'mt-7' : ''}`}>{plan.name}</h3>
                    <p className={`mt-2 min-h-11 text-sm leading-6 ${plan.is_featured ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>{plan.description}</p>
                    <div className="mt-7 flex items-end gap-1">
                      <span className="text-4xl font-black tracking-[-0.06em]">${price}</span>
                      <span className={`pb-1.5 text-sm ${plan.is_featured ? 'text-slate-400' : 'text-slate-500'}`}>{billingCycle === 'lifetime' ? 'one-time' : '/mo'}</span>
                    </div>
                    {billingCycle === 'yearly' && rawPrice > 0 && <p className={`mt-1 text-xs ${plan.is_featured ? 'text-indigo-300' : 'text-emerald-600 dark:text-emerald-400'}`}>${rawPrice} billed yearly</p>}
                    {lifetimeUnavailable && <p className={`mt-1 text-xs ${plan.is_featured ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>Lifetime deal not available on this plan</p>}
                    <div className={`my-7 h-px ${plan.is_featured ? 'bg-white/10' : 'bg-slate-900/10 dark:bg-white/10'}`} />
                    <ul className="flex-1 space-y-3 text-sm">
                      {(plan.features || []).map((feature) => (
                        <li key={feature} className={`flex items-start gap-2.5 ${plan.is_featured ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}><Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.is_featured ? 'text-indigo-300' : 'text-emerald-500'}`} /> {feature}</li>
                      ))}
                    </ul>
                    <Link to={user ? '/app/pricing-plan' : '/register'} className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${isCurrent ? 'bg-emerald-500 text-white hover:bg-emerald-600' : plan.is_featured ? 'bg-white text-slate-950 hover:bg-indigo-50' : 'border border-slate-900/15 hover:bg-slate-950 hover:text-white dark:border-white/15 dark:hover:bg-white dark:hover:text-slate-950'}`}>
                      {isCurrent ? 'Current plan' : user ? 'Manage plan' : Number(rawPrice) === 0 ? 'Get started' : billingCycle === 'lifetime' ? 'Get lifetime deal' : 'Start free trial'} <ArrowRight className="h-4 w-4" />
                    </Link>
                    {isCurrent && planRenewDate && <p className={`mt-2 text-center text-[11px] ${plan.is_featured ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>Renews {new Date(planRenewDate).toLocaleDateString()}</p>}
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-18 lg:grid-cols-[0.7fr_1.3fr] lg:px-8 lg:py-24">
          <div data-reveal className="landing-reveal">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Questions, answered</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl">The useful details before you start.</h2>
            <p className="mt-5 leading-7 text-slate-600 dark:text-slate-300">Postflow is built to make multi-channel publishing easier without hiding the controls that teams need.</p>
          </div>
          <div className="divide-y divide-slate-900/10 border-y border-slate-900/10 dark:divide-white/10 dark:border-white/10">
            {FAQS.map(([question, answer]) => (
              <details key={question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-lg font-bold">
                  {question}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-900/10 transition group-open:rotate-45 dark:border-white/10"><X className="h-4 w-4 rotate-45" /></span>
                </summary>
                <p className="max-w-2xl pb-6 pr-12 leading-7 text-slate-600 dark:text-slate-300">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        {latestNews.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-18 lg:px-8">
            <div data-reveal className="landing-reveal flex flex-col justify-between gap-4 border-b border-slate-900/10 pb-6 dark:border-white/10 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">Latest news</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">Updates from Postflow.</h2>
              </div>
              <Link to="/news" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 transition hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-100">View all news <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {latestNews.map((post, index) => (
                <Link key={post.id} to={`/news/${post.slug}`} data-reveal style={{ '--reveal-delay': `${index * 80}ms` }} className="landing-reveal group overflow-hidden rounded-[1.5rem] border border-slate-900/10 bg-white transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10 dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="aspect-[16/9] bg-slate-100 dark:bg-white/5">
                    {post.hero_image_url ? <img src={post.hero_image_url} alt="" className="h-full w-full object-cover" /> : <div className="landing-grid-bg h-full opacity-25" />}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-black uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{post.category || 'News'}</span>
                      <span>{post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Published'}</span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-lg font-black tracking-[-0.03em]">{post.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{post.summary}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-300">Read update <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="px-5 pb-8 lg:px-8">
          <div data-reveal className="landing-reveal relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-indigo-600 px-6 py-16 text-center text-white shadow-xl shadow-indigo-600/15 sm:px-12 lg:py-20">
            <div className="landing-grid-bg absolute inset-0 opacity-20" />
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" />
            <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-cyan-300/25 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-200">Your next campaign can be calmer</p>
              <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-black leading-[1.04] tracking-[-0.055em] sm:text-5xl">Put every channel on the same page.</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-indigo-100">Create your workspace, connect the accounts you use and start building a publishing rhythm your team can actually maintain.</p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50">{primaryLabel} <ArrowRight className="h-5 w-5" /></Link>
                <a href="#pricing" className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/15">Compare plans</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {hasFooterContent && (
        <footer className="mx-auto max-w-7xl px-5 pb-8 pt-12 lg:px-8">
          <div className="grid gap-8 border-b border-slate-900/10 pb-12 dark:border-white/10 md:grid-cols-2 lg:grid-cols-[var(--footer-columns)]" style={{ '--footer-columns': footerGridTemplate || '1fr' }}>
            {(footerTopText || brandName || logoUrl) && (
              <div>
                <div className="flex items-center gap-2.5"><LogoMark logoUrl={logoUrl} /><span className="text-lg font-black tracking-[-0.04em]">{brandName}</span></div>
                {footerTopText && <p className="mt-4 max-w-sm leading-7 text-slate-500 dark:text-slate-400">{footerTopText}</p>}
              </div>
            )}
            {footerColumns.map((column) => (
              <FooterColumn key={column.id} column={column} />
            ))}
          </div>
          {footerBottomText && (
            <div className="flex flex-col gap-3 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p>{footerBottomText}</p>
            </div>
          )}
        </footer>
      )}

      {showCookieConsent && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-2xl border border-slate-900/10 bg-white/95 p-4 shadow-2xl shadow-slate-900/15 backdrop-blur dark:border-white/10 dark:bg-slate-900/95 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Privacy & GDPR</p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">We use required cookies for login and optional analytics cookies to improve the product experience.</p>
          </div>
          <div className="mt-4 flex gap-2 sm:mt-0">
            <button type="button" onClick={() => setShowCookieConsent(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/5">Later</button>
            <button type="button" onClick={acceptCookieConsent} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-600 dark:bg-white dark:text-slate-950">Accept</button>
          </div>
        </div>
      )}
    </div>
  )
}

function LogoMark({ logoUrl }) {
  if (logoUrl) {
    return (
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white text-white shadow-lg shadow-indigo-500/20 ring-1 ring-slate-900/10 dark:ring-white/10">
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
      </span>
    )
  }

  return (
    <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-slate-950 text-white shadow-lg shadow-indigo-500/20 dark:bg-white dark:text-slate-950">
      <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-indigo-500" />
      <Zap className="relative h-4.5 w-4.5 fill-current" />
    </span>
  )
}

function FooterColumn({ column }) {
  return (
    <div>
      {column.title && <p className="text-sm font-black">{column.title}</p>}
      <div className={column.title ? 'mt-4 space-y-4' : 'space-y-4'}>
        {column.widgets.map((widget) => (
          <FooterWidget key={widget.id} widget={widget} />
        ))}
      </div>
    </div>
  )
}

function FooterWidget({ widget }) {
  if (widget.type === 'text') {
    if (!widget.text) return null
    return (
      <div>
        {widget.title && <p className="mb-2 text-sm font-black">{widget.title}</p>}
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{widget.text}</p>
      </div>
    )
  }

  if (widget.type === 'menu') {
    const links = footerLinksFromWidget(widget)
    if (!links.length) return null
    return (
      <div>
        {widget.title && <p className="mb-3 text-sm font-black">{widget.title}</p>}
        <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
          {links.map((link) => (
            <li key={link.id || `${link.label}-${link.url}`}>
              <a href={link.url || '#'} className="transition hover:text-slate-950 dark:hover:text-white">{link.label}</a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (widget.type === 'image') {
    const src = mediaUrl(widget.image_url)
    if (!src) return null
    const image = <img src={src} alt={widget.alt || ''} className="max-h-28 w-auto max-w-full rounded-xl object-contain" />
    return (
      <div>
        {widget.title && <p className="mb-3 text-sm font-black">{widget.title}</p>}
        {widget.url ? <a href={widget.url}>{image}</a> : image}
      </div>
    )
  }

  if (widget.type === 'button') {
    if (!widget.label) return null
    const primary = widget.style !== 'secondary'
    return (
      <a href={widget.url || '#'} className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition ${primary ? 'bg-slate-950 text-white hover:bg-indigo-600 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-100' : 'border border-slate-900/15 text-slate-700 hover:bg-slate-950 hover:text-white dark:border-white/15 dark:text-slate-200 dark:hover:bg-white dark:hover:text-slate-950'}`}>
        {widget.label}
      </a>
    )
  }

  if (!widget.label) return null
  return (
    <a href={widget.url || '#'} className="inline-flex text-sm font-bold text-indigo-600 transition hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-100">
      {widget.label}
    </a>
  )
}

function footerColumnsFromSettings(columns) {
  if (!Array.isArray(columns)) return []
  return columns.map((column, index) => ({
    id: column.id || `footer-column-${index}`,
    title: publicFooterColumnTitle(column.title),
    width: column.width || '1fr',
    widgets: Array.isArray(column.widgets)
      ? column.widgets.map((widget, widgetIndex) => ({
        id: widget.id || `footer-widget-${index}-${widgetIndex}`,
        type: widget.type || 'text',
        ...widget,
      })).filter(hasPublicFooterWidgetContent)
      : column.links
        ? [{ id: `footer-widget-${index}-links`, type: 'menu', title: column.title || '', links: column.links }]
        : [],
  })).filter((column) => column.widgets.length)
}

function footerLinksFromWidget(widget) {
  if (Array.isArray(widget.items)) {
    const links = widget.items
      .map((item, index) => ({
        id: item.id || `footer-link-${index}`,
        label: item.label || '',
        url: item.url || '#',
      }))
      .filter((item) => item.label && !isPlaceholderFooterLink(item))
    return isOldDefaultFooterMenu(links) ? [] : links
  }

  const links = String(widget.links || '')
    .split('\n')
    .map((row, index) => {
      const [label, url = '#'] = row.split('|').map((item) => item.trim())
      return { id: `footer-link-${index}`, label, url }
    })
    .filter((item) => item.label && !isPlaceholderFooterLink(item))

  return isOldDefaultFooterMenu(links) ? [] : links
}

function publicFooterText(value) {
  return String(value || '').trim()
}

function publicFooterColumnTitle(value) {
  const text = String(value || '').trim()
  return /^new column$/i.test(text) ? '' : text
}

function hasPublicFooterWidgetContent(widget) {
  if (widget.type === 'text') return Boolean(String(widget.text || '').trim())
  if (widget.type === 'menu') return footerLinksFromWidget(widget).length > 0
  if (widget.type === 'image') return Boolean(String(widget.image_url || '').trim())
  if (widget.type === 'button') return Boolean(String(widget.label || '').trim()) && !isPlaceholderFooterButton(widget)
  return Boolean(String(widget.label || '').trim())
}

function isPlaceholderFooterLink(link) {
  return String(link.label || '').trim().toLowerCase() === 'label'
    && String(link.url || '').trim().toLowerCase() === '/url'
}

function isPlaceholderFooterButton(widget) {
  return String(widget.label || '').trim().toLowerCase() === 'get started'
    && ['#', ''].includes(String(widget.url || '').trim())
}

function isOldDefaultFooterMenu(links) {
  return false
}

function SectionHeading({ eyebrow, title, body }) {
  return (
    <div data-reveal className="landing-reveal mx-auto max-w-2xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-black leading-[1.04] tracking-[-0.05em] sm:text-4xl lg:text-5xl">{title}</h2>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">{body}</p>
    </div>
  )
}

function menuItemsFromSettings(items) {
  if (!Array.isArray(items) || items.length === 0) return []

  const childrenByParent = items.reduce((map, item) => {
    const parent = item.parent || ''
    map[parent] = [...(map[parent] || []), item]
    return map
  }, {})

  const topLevel = childrenByParent[''] || []
  if (topLevel.length === 0) return []

  return topLevel.map((item) => {
    const children = childrenByParent[item.id] || []
    return {
      label: item.label || 'Menu item',
      href: item.url || '#',
      type: item.type === 'mega' ? 'mega' : item.type === 'dropdown' ? 'dropdown' : undefined,
      columns: splitMenuColumns(item.columns),
      items: children.length ? children.map((child) => ({
        label: child.label || 'Menu item',
        description: child.description || `Open ${child.label || 'this page'}.`,
        href: child.url || '#',
        icon: child.icon || '',
        group: child.columns || '',
      })) : undefined,
    }
  })
}

function DesktopNavItem({ item }) {
  const [open, setOpen] = useState(false)

  if (!item.items) {
    return <a href={item.href} className="transition hover:text-slate-950 dark:hover:text-white">{item.label}</a>
  }

  const childItems = item.items.map(normalizeNavChild)
  const groups = item.type === 'mega' ? groupMegaItems(childItems, item.columns) : [{ label: '', items: childItems }]

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-1.5 transition hover:text-slate-950 dark:hover:text-white" aria-expanded={open} aria-haspopup="menu">
        {item.label}
        <ChevronRight className={`h-3.5 w-3.5 rotate-90 text-slate-400 transition ${open ? 'text-slate-700 dark:text-slate-200' : ''}`} />
      </button>
      <div className={`absolute top-full z-50 pt-5 transition duration-200 ${open ? 'pointer-events-auto visible translate-y-0 opacity-100' : 'pointer-events-none invisible translate-y-2 opacity-0'} ${item.type === 'mega' ? 'left-1/2 w-[520px] -translate-x-1/2' : 'left-0 w-72'}`}>
        <div className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white/95 p-2 shadow-2xl shadow-slate-900/15 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
          <div className={item.type === 'mega' ? 'grid grid-cols-2 gap-2' : 'space-y-1'}>
            {groups.map((group, index) => (
              <div key={group.label || index} className={item.type === 'mega' ? 'space-y-1' : ''}>
                {group.label && <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.label}</p>}
                {group.items.map((child) => (
                  <a key={child.label} href={child.href} className="flex gap-3 rounded-xl border-b border-slate-900/5 p-3 transition last:border-b-0 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5">
                    <MenuIcon name={child.icon} className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-300" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{child.label}</span>
                      <span className="mt-1 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{child.description}</span>
                    </span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizeNavChild(child) {
  if (Array.isArray(child)) {
    return {
      label: child[0] || 'Menu item',
      description: child[1] || '',
      href: child[2] || '#',
      icon: child[3] || '',
      group: '',
    }
  }

  return {
    label: child?.label || 'Menu item',
    description: child?.description || '',
    href: child?.href || '#',
    icon: child?.icon || '',
    group: child?.group || '',
  }
}

function splitMenuColumns(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function groupMegaItems(items, configuredColumns = []) {
  const columns = Array.isArray(configuredColumns) ? configuredColumns : splitMenuColumns(configuredColumns)
  if (columns.length === 0) {
    const midpoint = Math.ceil(items.length / 2)
    return [
      { label: '', items: items.slice(0, midpoint) },
      { label: '', items: items.slice(midpoint) },
    ].filter((group) => group.items.length)
  }

  const grouped = columns.map((column) => ({
    label: column,
    items: items.filter((item) => item.group === column),
  }))
  const uncategorized = items.filter((item) => !columns.includes(item.group))
  if (uncategorized.length) grouped.push({ label: 'More', items: uncategorized })
  return grouped.filter((group) => group.items.length)
}

function MenuIcon({ name, className }) {
  const key = String(name || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  const Icon = MENU_ICON_COMPONENTS[key] || MENU_ICON_COMPONENTS[String(name || '').trim().toLowerCase()]
  return Icon ? <Icon className={className} /> : null
}

function HeroProductPreview({ activeTab, onTabChange }) {
  return (
    <div className="landing-hero-in landing-delay-4 relative z-10 mx-auto w-full max-w-3xl lg:mx-0">
      <div className="absolute -left-8 top-20 z-20 hidden rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur sm:flex sm:items-center sm:gap-3 dark:border-white/10 dark:bg-slate-900/90 landing-float-slow">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /></span>
        <div><p className="text-xs font-bold">Published successfully</p><p className="mt-0.5 text-[10px] text-slate-400">6 channel variations</p></div>
      </div>
      <div className="absolute -right-5 bottom-16 z-20 hidden rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur sm:block dark:border-white/10 dark:bg-slate-900/90 landing-float-fast">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Engagement</p>
        <p className="mt-1 text-xl font-black text-emerald-600">+28.4%</p>
      </div>

      <div className="landing-product-shell overflow-hidden rounded-[1.5rem] border border-slate-900/10 bg-slate-950 p-2 shadow-[0_28px_70px_-34px_rgba(49,46,129,0.48)] dark:border-white/10">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
            {['calendar', 'compose', 'analytics'].map((tab) => (
              <button key={tab} onClick={() => onTabChange(tab)} className={`rounded-md px-2.5 py-1 text-[10px] font-bold capitalize transition ${activeTab === tab ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}>{tab}</button>
            ))}
          </div>
          <BellRing className="h-4 w-4 text-slate-500" />
        </div>

        <div className="grid min-h-[450px] grid-cols-[56px_1fr] overflow-hidden rounded-[1.1rem] bg-[#f7f8fb] sm:grid-cols-[138px_1fr] dark:bg-slate-900">
          <aside className="border-r border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950">
            <div className="mb-6 hidden items-center gap-2 sm:flex"><LogoMark /><span className="text-xs font-black">Postflow</span></div>
            <div className="space-y-2">
              {[CalendarDays, WandSparkles, ImageIcon, BarChart3, Workflow].map((Icon, index) => (
                <div key={index} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold ${index === 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300' : 'text-slate-400'}`}>
                  <Icon className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{['Calendar', 'Composer', 'Media', 'Analytics', 'Automations'][index]}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 hidden sm:block"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Channels</p><div className="mt-3 flex -space-x-1.5">{['instagram', 'linkedin_profile', 'pinterest', 'bluesky'].map((key) => <PlatformBadge key={key} platform={key} size="xs" className="ring-2 ring-white dark:ring-slate-950" />)}</div></div>
          </aside>
          <div className="overflow-hidden p-4 sm:p-6">
            {activeTab === 'calendar' && <CalendarPreview />}
            {activeTab === 'compose' && <ComposerPreview />}
            {activeTab === 'analytics' && <AnalyticsPreview />}
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarPreview() {
  const posts = [
    { day: 1, title: 'Product story', platform: 'linkedin_profile', tone: 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-400/10 dark:border-sky-400/20 dark:text-sky-200' },
    { day: 3, title: 'Behind the scenes', platform: 'instagram', tone: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-400/10 dark:border-fuchsia-400/20 dark:text-fuchsia-200' },
    { day: 5, title: 'Launch board', platform: 'pinterest', tone: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-400/10 dark:border-rose-400/20 dark:text-rose-200' },
    { day: 8, title: 'Feature thread', platform: 'bluesky', tone: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-400/10 dark:border-indigo-400/20 dark:text-indigo-200' },
    { day: 11, title: 'Tips carousel', platform: 'instagram', tone: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-400/10 dark:border-amber-400/20 dark:text-amber-200' },
    { day: 13, title: 'Weekly recap', platform: 'facebook_page', tone: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-400/10 dark:border-emerald-400/20 dark:text-emerald-200' },
  ]
  return (
    <div className="landing-preview-in">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Content calendar</p><h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">June campaign</h3></div><button className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white">New post</button></div>
      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 14 }, (_, index) => {
          const post = posts.find((item) => item.day === index + 1)
          return <div key={index} className="min-h-20 rounded-lg border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-white/[0.035]"><span className="text-[9px] font-bold text-slate-400">{index + 1}</span>{post && <div className={`mt-1 rounded-md border p-1.5 ${post.tone}`}><div className="flex items-center gap-1"><PlatformBadge platform={post.platform} size="xs" className="!h-4 !w-4 !rounded !p-0.5" /><span className="truncate text-[8px] font-bold">{post.title}</span></div><div className="mt-1 flex items-center gap-1 text-[7px] opacity-60"><Clock3 className="h-2.5 w-2.5" /> 10:30</div></div>}</div>
        })}
      </div>
    </div>
  )
}

function ComposerPreview() {
  return (
    <div className="landing-preview-in">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Create post</p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex items-center gap-2">{['instagram', 'linkedin_profile', 'pinterest', 'bluesky'].map((key) => <PlatformBadge key={key} platform={key} size="xs" />)}<span className="text-[10px] text-slate-400">4 selected</span></div>
        <p className="mt-5 text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">A calmer social workflow starts with one clear place to turn ideas into a consistent publishing plan.</p>
        <div className="mt-4 flex h-36 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white"><div className="text-center"><Sparkles className="mx-auto h-7 w-7" /><p className="mt-2 text-xs font-bold">Campaign visual</p></div></div>
        <div className="mt-4 flex items-center justify-between"><div className="flex gap-2"><button className="rounded-lg bg-slate-100 p-2 text-slate-500 dark:bg-white/5"><ImageIcon className="h-4 w-4" /></button><button className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300"><WandSparkles className="h-4 w-4" /></button></div><button className="rounded-lg bg-indigo-600 px-4 py-2 text-[10px] font-bold text-white">Schedule</button></div>
      </div>
    </div>
  )
}

function AnalyticsPreview() {
  return (
    <div className="landing-preview-in">
      <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Performance</p><h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Campaign overview</h3></div><span className="rounded-lg bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">+18.2%</span></div>
      <div className="mt-5 grid grid-cols-3 gap-2">{[['Reach', '84.2K'], ['Clicks', '6,480'], ['Posts', '128']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]"><p className="text-[9px] text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{value}</p></div>)}</div>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]"><div className="flex h-48 items-end gap-2">{[34, 50, 42, 68, 56, 80, 72, 92, 76, 100, 88, 112].map((height, index) => <div key={index} className="landing-chart-bar flex-1 rounded-t bg-gradient-to-t from-indigo-600 to-violet-400" style={{ height, animationDelay: `${index * 50}ms` }} />)}</div><div className="mt-3 flex justify-between text-[8px] text-slate-400"><span>Jun 1</span><span>Jun 8</span><span>Jun 15</span></div></div>
    </div>
  )
}

function PillarVisual({ type }) {
  if (type === 'composer') return <div className="absolute -bottom-8 -right-12 w-[78%] rotate-[-2deg] rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xl transition duration-500 group-hover:rotate-0 dark:border-white/10 dark:bg-slate-900"><div className="flex items-center gap-2">{['instagram', 'linkedin_profile', 'pinterest'].map((key) => <PlatformBadge key={key} platform={key} size="xs" />)}<span className="text-[10px] font-semibold text-slate-400">Platform variations</span></div><div className="mt-4 rounded-xl bg-white p-4 text-xs leading-5 text-slate-500 shadow-sm dark:bg-white/5 dark:text-slate-300">Write once, then adapt the message to the tone and format of every channel.</div><div className="mt-3 flex gap-2"><span className="rounded-lg bg-indigo-100 px-3 py-2 text-[10px] font-bold text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300">Generate variation</span><span className="rounded-lg bg-white px-3 py-2 text-[10px] text-slate-400 dark:bg-white/5">Add media</span></div></div>
  if (type === 'calendar') return <div className="absolute -bottom-3 left-7 right-7 rounded-t-2xl border border-slate-200 bg-slate-50 p-3 shadow-xl dark:border-white/10 dark:bg-slate-900"><div className="grid grid-cols-5 gap-2">{Array.from({ length: 15 }, (_, i) => <div key={i} className="h-14 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/5">{[2, 6, 9, 13].includes(i) && <div className={`h-full rounded-md ${i % 2 ? 'bg-violet-100 dark:bg-violet-400/15' : 'bg-sky-100 dark:bg-sky-400/15'}`} />}</div>)}</div></div>
  if (type === 'automation') return <div className="absolute bottom-5 left-6 right-6 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-2.5 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/75"><div className="absolute bottom-8 left-[29px] top-8 w-px bg-gradient-to-b from-indigo-400 via-violet-300 to-slate-200 dark:from-indigo-400/70 dark:via-violet-400/50 dark:to-white/10" /><div className="relative space-y-1.5"><MiniFlow icon={Bot} label="New RSS item" active compact /><MiniFlow icon={WandSparkles} label="Generate platform copy" compact /><MiniFlow icon={Send} label="Add to publishing queue" compact /></div></div>
  return <div className="absolute -bottom-12 left-7 right-7 h-56 rounded-t-2xl border border-slate-200 bg-slate-50 p-5 shadow-xl dark:border-white/10 dark:bg-slate-900"><div className="flex h-full items-end gap-2">{[42, 56, 48, 78, 64, 91, 72, 108, 88, 126, 105, 142].map((height, index) => <div key={index} className="landing-chart-bar flex-1 rounded-t-md bg-gradient-to-t from-indigo-600 to-fuchsia-400" style={{ height: `${height}px`, animationDelay: `${index * 70}ms` }} />)}</div></div>
}

function MiniFlow({ icon: Icon, label, active, compact = false }) {
  return <div className={`flex items-center border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 ${compact ? 'gap-2.5 rounded-xl p-2' : 'gap-3 rounded-2xl p-3'}`}><span className={`relative z-10 flex shrink-0 items-center justify-center ${compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'} ${active ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300'}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 text-xs font-bold leading-4">{label}</span><ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300" /></div>
}
