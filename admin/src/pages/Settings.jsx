import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, Bot, CheckCircle2, ChevronRight, Clock3, Code2, CreditCard,
  FileText, Globe2, GripVertical, Languages, Link2, LockKeyhole, Mail,
  Menu, Palette, Plus, Save, Search, Settings2, ShieldCheck, Trash2, Users,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Button, Card, Input, PageLoader, Textarea } from '../components/ui'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'integration', label: 'Integration' },
  { id: 'security', label: 'Security' },
  { id: 'system', label: 'System' },
  { id: 'advanced', label: 'Advanced' },
]

const DEFAULTS = {
  platform_name: 'Postflow',
  support_email: '',
  registration_enabled: true,
  default_trial_days: 14,
  maintenance_notice: '',
  general: {
    site_name: 'Postflow',
    tagline: 'Social publishing, in one flow.',
    description: '',
    email: '',
    phone: '',
    logo_url: '',
    facebook_url: '',
    x_url: '',
    tiktok_url: '',
    instagram_url: '',
    linkedin_url: '',
    discord_url: '',
    mastodon_url: '',
    youtube_url: '',
    other_social_url: '',
  },
  seo: {
    meta_title: '',
    keywords: '',
    meta_description: '',
    og_title: '',
    og_description: '',
    og_image_url: '',
    twitter_card: 'summary_large_image',
    twitter_title: '',
    twitter_description: '',
    twitter_image_url: '',
    schema_json: '',
  },
  sitemap: {
    enabled: true,
    include_landing: true,
    include_public_pages: true,
    change_frequency: 'weekly',
    last_generated_at: '',
  },
  language: {
    default_language: 'en',
    available_languages: 'en',
    auto_detect: true,
    rtl_languages: '',
  },
  privacy: {
    gdpr_popup_enabled: true,
    cookie_message: 'We use cookies to improve your experience.',
    privacy_policy_url: '/privacy',
    consent_categories: 'Required, Analytics, Marketing',
  },
  main_menu: {
    items: [
      { id: 'product', label: 'Product', url: '#product', type: 'mega', parent: '' },
      { id: 'workflow', label: 'How it works', url: '#workflow', type: 'link', parent: 'product' },
      { id: 'platforms', label: 'Platforms', url: '#platforms', type: 'link', parent: 'product' },
      { id: 'pricing', label: 'Pricing', url: '#pricing', type: 'link', parent: '' },
    ],
  },
  footer: {
    top_text: 'Plan, publish, automate and measure every social channel from one workspace.',
    bottom_text: 'Copyright Postflow. All rights reserved.',
    columns: [
      { title: 'Product', links: 'Composer|#product\nCalendar|#product\nAutomations|#workflow' },
      { title: 'Company', links: 'Pricing|#pricing\nSecurity|#product\nDevelopers|#product' },
    ],
  },
  email: {
    provider: 'smtp',
    from_name: 'Postflow',
    from_email: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    brevo_api_key: '',
  },
  cron: {
    enabled: true,
    schedule_command: '* * * * * php artisan schedule:run',
    queue_command: 'php artisan queue:work',
    healthcheck_url: '',
  },
  analytics: {
    enabled: false,
    google_analytics_id: '',
    posthog_key: '',
    posthog_host: 'https://app.posthog.com',
    facebook_pixel_id: '',
  },
  affiliate: {
    enabled: false,
    commission_percent: '20',
    cookie_days: '30',
    payout_threshold: '50',
  },
  social_login: {
    google_enabled: false,
    facebook_enabled: false,
    linkedin_enabled: false,
    github_enabled: false,
  },
  security: {
    two_factor_required: false,
    turnstile_site_key: '',
    turnstile_secret_key: '',
    blocked_email_domains: 'mailinator.com, temp-mail.org, 10minutemail.com',
  },
  payments: {
    default_provider: 'manual',
    dodo_api_key: '',
    creem_api_key: '',
    webhook_secret: '',
    currency: 'USD',
  },
  crawler_ai: {
    robots_txt: 'User-agent: *\nAllow: /',
    llms_txt: '# Postflow\n\nPublic information for AI agents.',
    ai_agent_policy: 'Allow public marketing pages and block authenticated application routes.',
  },
}

const SETTINGS = [
  {
    id: 'general',
    title: 'General settings',
    category: 'frontend',
    icon: Globe2,
    description: 'Site identity, contact details, logo and public social media links.',
    tags: ['site name', 'logo', 'phone', 'social media'],
    fields: [
      { section: 'general', key: 'site_name', label: 'Site name' },
      { section: 'general', key: 'tagline', label: 'Tagline' },
      { section: 'general', key: 'description', label: 'Description', type: 'textarea', span: true },
      { section: 'general', key: 'email', label: 'Public email', type: 'email' },
      { section: 'general', key: 'phone', label: 'Phone' },
      { section: 'general', key: 'logo_url', label: 'Logo URL', type: 'url', span: true },
      { section: 'general', key: 'facebook_url', label: 'Facebook URL', type: 'url' },
      { section: 'general', key: 'x_url', label: 'X URL', type: 'url' },
      { section: 'general', key: 'tiktok_url', label: 'TikTok URL', type: 'url' },
      { section: 'general', key: 'instagram_url', label: 'Instagram URL', type: 'url' },
      { section: 'general', key: 'linkedin_url', label: 'LinkedIn URL', type: 'url' },
      { section: 'general', key: 'discord_url', label: 'Discord URL', type: 'url' },
      { section: 'general', key: 'mastodon_url', label: 'Mastodon URL', type: 'url' },
      { section: 'general', key: 'youtube_url', label: 'YouTube URL', type: 'url' },
      { section: 'general', key: 'other_social_url', label: 'Other social URL', type: 'url' },
    ],
  },
  {
    id: 'seo',
    title: 'SEO settings',
    category: 'frontend',
    icon: FileText,
    description: 'Meta title, keywords, Open Graph, Twitter cards, schema and sharing images.',
    tags: ['meta', 'open graph', 'twitter', 'schema'],
    fields: [
      { section: 'seo', key: 'meta_title', label: 'Meta title', span: true },
      { section: 'seo', key: 'keywords', label: 'Keywords', span: true },
      { section: 'seo', key: 'meta_description', label: 'Meta description', type: 'textarea', span: true },
      { section: 'seo', key: 'og_title', label: 'Facebook/Open Graph title' },
      { section: 'seo', key: 'og_image_url', label: 'Open Graph image URL', type: 'url' },
      { section: 'seo', key: 'og_description', label: 'Open Graph description', type: 'textarea', span: true },
      { section: 'seo', key: 'twitter_card', label: 'Twitter card type', type: 'select', options: [['summary_large_image', 'Summary large image'], ['summary', 'Summary']] },
      { section: 'seo', key: 'twitter_image_url', label: 'Twitter image URL', type: 'url' },
      { section: 'seo', key: 'twitter_title', label: 'Twitter title' },
      { section: 'seo', key: 'twitter_description', label: 'Twitter description' },
      { section: 'seo', key: 'schema_json', label: 'Schema JSON-LD', type: 'textarea', span: true, rows: 7 },
    ],
  },
  {
    id: 'sitemap',
    title: 'Sitemap settings',
    category: 'system',
    icon: Link2,
    description: 'Generate and control sitemap coverage for public website pages.',
    tags: ['sitemap', 'generate', 'public pages'],
    fields: [
      { section: 'sitemap', key: 'enabled', label: 'Enable sitemap', type: 'checkbox' },
      { section: 'sitemap', key: 'include_landing', label: 'Include landing page', type: 'checkbox' },
      { section: 'sitemap', key: 'include_public_pages', label: 'Include public pages', type: 'checkbox' },
      { section: 'sitemap', key: 'change_frequency', label: 'Change frequency', type: 'select', options: [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] },
    ],
  },
  {
    id: 'language',
    title: 'Language settings',
    category: 'frontend',
    icon: Languages,
    description: 'Prepare multilingual defaults, available locales and RTL languages.',
    tags: ['multilingual', 'locale', 'translation'],
    fields: [
      { section: 'language', key: 'default_language', label: 'Default language' },
      { section: 'language', key: 'available_languages', label: 'Available languages', placeholder: 'en, bn, fr', span: true },
      { section: 'language', key: 'auto_detect', label: 'Auto-detect browser language', type: 'checkbox' },
      { section: 'language', key: 'rtl_languages', label: 'RTL languages', placeholder: 'ar, he', span: true },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & GDPR',
    category: 'security',
    icon: ShieldCheck,
    description: 'Homepage consent popup, privacy policy link and cookie categories.',
    tags: ['gdpr', 'cookies', 'privacy popup'],
    fields: [
      { section: 'privacy', key: 'gdpr_popup_enabled', label: 'Show GDPR popup on homepage', type: 'checkbox', span: true },
      { section: 'privacy', key: 'cookie_message', label: 'Cookie popup message', type: 'textarea', span: true },
      { section: 'privacy', key: 'privacy_policy_url', label: 'Privacy policy URL', type: 'url' },
      { section: 'privacy', key: 'consent_categories', label: 'Consent categories', placeholder: 'Required, Analytics, Marketing' },
    ],
  },
  {
    id: 'main_menu',
    title: 'Main menu',
    category: 'frontend',
    icon: Menu,
    description: 'WordPress-style menu editor with dropdown and mega menu support.',
    tags: ['menu', 'submenu', 'mega menu', 'drag and drop'],
    custom: 'menu',
  },
  {
    id: 'footer',
    title: 'Footer editor',
    category: 'frontend',
    icon: Palette,
    description: 'Edit footer top copy, bottom copy and footer link columns.',
    tags: ['footer top', 'footer bottom', 'links'],
    custom: 'footer',
  },
  {
    id: 'email',
    title: 'Email settings',
    category: 'integration',
    icon: Mail,
    description: 'SMTP and provider credentials, including Brevo integration.',
    tags: ['smtp', 'brevo', 'from email'],
    fields: [
      { section: 'email', key: 'provider', label: 'Provider', type: 'select', options: [['smtp', 'SMTP'], ['brevo', 'Brevo'], ['mailgun', 'Mailgun']] },
      { section: 'email', key: 'from_name', label: 'From name' },
      { section: 'email', key: 'from_email', label: 'From email', type: 'email' },
      { section: 'email', key: 'smtp_host', label: 'SMTP host' },
      { section: 'email', key: 'smtp_port', label: 'SMTP port' },
      { section: 'email', key: 'smtp_username', label: 'SMTP username' },
      { section: 'email', key: 'smtp_password', label: 'SMTP password', type: 'password' },
      { section: 'email', key: 'brevo_api_key', label: 'Brevo API key', type: 'password', span: true },
    ],
  },
  {
    id: 'cron',
    title: 'Cron settings',
    category: 'system',
    icon: Clock3,
    description: 'Scheduler, queue worker and healthcheck configuration.',
    tags: ['cron', 'queue', 'scheduler'],
    fields: [
      { section: 'cron', key: 'enabled', label: 'Enable scheduled jobs', type: 'checkbox', span: true },
      { section: 'cron', key: 'schedule_command', label: 'Scheduler command', span: true },
      { section: 'cron', key: 'queue_command', label: 'Queue command', span: true },
      { section: 'cron', key: 'healthcheck_url', label: 'Healthcheck URL', type: 'url', span: true },
    ],
  },
  {
    id: 'analytics',
    title: 'Pixel & Analytics',
    category: 'integration',
    icon: BarChart3,
    description: 'Google Analytics, PostHog and Facebook Pixel tracking.',
    tags: ['ga4', 'posthog', 'facebook pixel'],
    fields: [
      { section: 'analytics', key: 'enabled', label: 'Enable tracking scripts', type: 'checkbox', span: true },
      { section: 'analytics', key: 'google_analytics_id', label: 'Google Analytics ID' },
      { section: 'analytics', key: 'facebook_pixel_id', label: 'Facebook Pixel ID' },
      { section: 'analytics', key: 'posthog_key', label: 'PostHog project key' },
      { section: 'analytics', key: 'posthog_host', label: 'PostHog host', type: 'url' },
    ],
  },
  {
    id: 'affiliate',
    title: 'Affiliate settings',
    category: 'integration',
    icon: Users,
    description: 'Referral commission rules, cookie duration and payout threshold.',
    tags: ['affiliate', 'referral', 'commission'],
    fields: [
      { section: 'affiliate', key: 'enabled', label: 'Enable affiliate program', type: 'checkbox', span: true },
      { section: 'affiliate', key: 'commission_percent', label: 'Commission percent', type: 'number' },
      { section: 'affiliate', key: 'cookie_days', label: 'Referral cookie days', type: 'number' },
      { section: 'affiliate', key: 'payout_threshold', label: 'Payout threshold', type: 'number' },
    ],
  },
  {
    id: 'social_login',
    title: 'Social login & registration',
    category: 'integration',
    icon: Users,
    description: 'Enable or disable social authentication providers.',
    tags: ['login', 'registration', 'oauth'],
    fields: [
      { section: 'social_login', key: 'google_enabled', label: 'Google login', type: 'checkbox' },
      { section: 'social_login', key: 'facebook_enabled', label: 'Facebook login', type: 'checkbox' },
      { section: 'social_login', key: 'linkedin_enabled', label: 'LinkedIn login', type: 'checkbox' },
      { section: 'social_login', key: 'github_enabled', label: 'GitHub login', type: 'checkbox' },
    ],
  },
  {
    id: 'security',
    title: 'Security settings',
    category: 'security',
    icon: LockKeyhole,
    description: 'Two-factor, Cloudflare Turnstile and blocked registration domains.',
    tags: ['2fa', 'turnstile', 'blocked domains'],
    fields: [
      { key: 'registration_enabled', label: 'Allow new registrations', type: 'checkbox', span: true },
      { section: 'security', key: 'two_factor_required', label: 'Require two-factor authentication', type: 'checkbox', span: true },
      { section: 'security', key: 'turnstile_site_key', label: 'Cloudflare Turnstile site key' },
      { section: 'security', key: 'turnstile_secret_key', label: 'Cloudflare Turnstile secret key', type: 'password' },
      { section: 'security', key: 'blocked_email_domains', label: 'Blocked email domains', type: 'textarea', span: true, rows: 4 },
      { key: 'maintenance_notice', label: 'Maintenance notice', type: 'textarea', span: true, rows: 4 },
    ],
  },
  {
    id: 'payments',
    title: 'Payment settings',
    category: 'integration',
    icon: CreditCard,
    description: 'Payment provider credentials for Dodo Payments and Creem.io.',
    tags: ['dodo payment', 'creem.io', 'billing'],
    fields: [
      { section: 'payments', key: 'default_provider', label: 'Default provider', type: 'select', options: [['manual', 'Manual'], ['dodo', 'Dodo Payments'], ['creem', 'Creem.io']] },
      { section: 'payments', key: 'currency', label: 'Currency' },
      { section: 'payments', key: 'dodo_api_key', label: 'Dodo API key', type: 'password' },
      { section: 'payments', key: 'creem_api_key', label: 'Creem.io API key', type: 'password' },
      { section: 'payments', key: 'webhook_secret', label: 'Webhook secret', type: 'password', span: true },
    ],
  },
  {
    id: 'crawler_ai',
    title: 'Crawler & AI Agent Settings',
    category: 'advanced',
    icon: Bot,
    description: 'Robots.txt, LLMS.txt and AI crawler policy copy.',
    tags: ['robots.txt', 'llms.txt', 'ai agents'],
    fields: [
      { section: 'crawler_ai', key: 'robots_txt', label: 'Robots.txt', type: 'textarea', span: true, rows: 8 },
      { section: 'crawler_ai', key: 'llms_txt', label: 'LLMS.txt', type: 'textarea', span: true, rows: 8 },
      { section: 'crawler_ai', key: 'ai_agent_policy', label: 'AI agent policy', type: 'textarea', span: true },
    ],
  },
  {
    id: 'developer',
    title: 'Advanced system',
    category: 'advanced',
    icon: Code2,
    description: 'Trial defaults and platform-level internal behavior.',
    tags: ['trial days', 'system'],
    fields: [
      { key: 'platform_name', label: 'Internal platform name' },
      { key: 'support_email', label: 'Support email', type: 'email' },
      { key: 'default_trial_days', label: 'Default trial days', type: 'number' },
    ],
  },
]

export default function Settings() {
  const { settingId } = useParams()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    api
      .get('/admin/settings')
      .then(({ data }) => setForm(normalizeSettings(data.data || {})))
      .catch(() => setForm(normalizeSettings({})))
  }, [])

  const filteredSettings = useMemo(() => {
    const query = search.trim().toLowerCase()
    return SETTINGS.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category
      const haystack = [item.title, item.description, item.category, ...(item.tags || [])].join(' ').toLowerCase()
      return matchesCategory && (!query || haystack.includes(query))
    })
  }, [category, search])

  const activeSetting = SETTINGS.find((item) => item.id === settingId)

  const updateField = (field, value) => {
    setForm((current) => {
      if (field.section) {
        return {
          ...current,
          [field.section]: { ...current[field.section], [field.key]: value },
        }
      }

      return { ...current, [field.key]: value }
    })
    setMessage(null)
  }

  const updateSection = (section, value) => {
    setForm((current) => ({ ...current, [section]: value }))
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        ...form,
        platform_name: form.platform_name || form.general.site_name || 'Postflow',
        support_email: form.support_email || form.general.email || '',
        default_trial_days: Number(form.default_trial_days || 0),
      }
      const { data } = await api.put('/admin/settings', payload)
      setForm(normalizeSettings(data.data || payload))
      setMessage({ type: 'success', text: data.message || 'Settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save platform settings.' })
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <PageLoader />

  if (settingId) {
    if (!activeSetting) {
      return (
        <Card className="p-8 text-center">
          <h1 className="text-xl font-bold text-white">Setting not found</h1>
          <p className="mt-2 text-sm text-slate-400">Choose another settings page from the settings center.</p>
          <Link to="/settings" className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Back to settings</Link>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link to="/settings" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" /> Back to settings
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{activeSetting.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{activeSetting.description}</p>
          </div>
          <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> Save settings</Button>
        </div>

        {message && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>
            {message.text}
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="border-b border-slate-800 bg-slate-800/40 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
                <activeSetting.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{categoryLabel(activeSetting.category)}</p>
                <h2 className="mt-1 text-lg font-bold text-white">{activeSetting.title}</h2>
              </div>
            </div>
          </div>
          <SettingDetail
            setting={activeSetting}
            form={form}
            updateField={updateField}
            updateSection={updateSection}
            setMessage={setMessage}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white"><Settings2 className="h-7 w-7 text-brand-300" /> Settings</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Search settings, switch categories, and configure frontend, integrations, security, system jobs and advanced crawler controls.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input className="pl-9" placeholder="Search settings..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> Save all</Button>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={clsx(
              'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition',
              category === item.id
                ? 'border-brand-500 bg-brand-600 text-white shadow-lg shadow-brand-900/20'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:bg-slate-800',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSettings.map((item) => (
            <SettingsCard key={item.id} item={item} />
          ))}
          {filteredSettings.length === 0 && (
            <Card className="p-8 text-center md:col-span-2 xl:col-span-3">
              <Search className="mx-auto h-10 w-10 text-slate-600" />
              <h2 className="mt-3 font-semibold text-white">No settings found</h2>
              <p className="mt-1 text-sm text-slate-400">Try another keyword or switch back to All.</p>
            </Card>
          )}
      </div>
    </div>
  )
}

function SettingsCard({ item }) {
  return (
    <Link
      to={`/settings/${item.id}`}
      className={clsx(
        'group flex h-full flex-col rounded-2xl border p-5 text-left transition',
        'border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800/70',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-brand-300 group-hover:bg-slate-700">
          <item.icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{categoryLabel(item.category)}</span>
      </div>
      <h2 className="mt-4 text-base font-bold text-white">{item.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{item.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">{item.tags?.slice(0, 2).join(' · ')}</span>
        <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
      </div>
    </Link>
  )
}

function SettingDetail({ setting, form, updateField, updateSection, setMessage }) {
  if (setting.custom === 'menu') {
    return <MenuEditor items={form.main_menu.items || []} onChange={(items) => updateSection('main_menu', { ...form.main_menu, items })} />
  }

  if (setting.custom === 'footer') {
    return <FooterEditor footer={form.footer} onChange={(footer) => updateSection('footer', footer)} />
  }

  return (
    <div className="space-y-5 p-5">
      {setting.id === 'sitemap' && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-300" />
            <div>
              <p className="font-semibold text-white">Sitemap generator</p>
              <p className="mt-1 text-sm text-slate-400">Use this action to record a sitemap generation request. The backend generator can consume these settings.</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  updateField({ section: 'sitemap', key: 'last_generated_at' }, new Date().toISOString())
                  setMessage({ type: 'success', text: 'Sitemap generation marked. Save settings to persist the timestamp.' })
                }}
              >
                Generate sitemap
              </Button>
              {form.sitemap.last_generated_at && <p className="mt-2 text-xs text-slate-500">Last generated: {new Date(form.sitemap.last_generated_at).toLocaleString()}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(setting.fields || []).map((field) => (
          <FieldInput key={`${field.section || 'root'}-${field.key}`} field={field} form={form} onChange={updateField} />
        ))}
      </div>
    </div>
  )
}

function FieldInput({ field, form, onChange }) {
  const value = field.section ? form[field.section]?.[field.key] : form[field.key]
  const className = field.span ? 'sm:col-span-2' : ''

  if (field.type === 'checkbox') {
    return (
      <label className={clsx('flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4', className)}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(field, event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand-600"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-100">{field.label}</span>
          {field.help && <span className="mt-1 block text-xs text-slate-500">{field.help}</span>}
        </span>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <label className={className}>
        <span className="mb-1.5 block text-sm font-medium text-slate-300">{field.label}</span>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(field, event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {(field.options || []).map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
        </select>
      </label>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className={className}>
        <Textarea
          label={field.label}
          rows={field.rows || 4}
          value={value ?? ''}
          onChange={(event) => onChange(field, event.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    )
  }

  return (
    <div className={className}>
      <Input
        label={field.label}
        type={field.type || 'text'}
        value={value ?? ''}
        onChange={(event) => onChange(field, event.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  )
}

function MenuEditor({ items, onChange }) {
  const [draggedId, setDraggedId] = useState(null)

  const updateItem = (id, changes) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  const addItem = () => {
    onChange([
      ...items,
      { id: `menu-${Date.now()}`, label: 'New menu item', url: '#', type: 'link', parent: '' },
    ])
  }

  const removeItem = (id) => {
    onChange(items.filter((item) => item.id !== id).map((item) => (item.parent === id ? { ...item, parent: '' } : item)))
  }

  const dropItem = (targetId) => {
    if (!draggedId || draggedId === targetId) return
    const fromIndex = items.findIndex((item) => item.id === draggedId)
    const toIndex = items.findIndex((item) => item.id === targetId)
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    onChange(next)
    setDraggedId(null)
  }

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="font-semibold text-white">Landing navigation support</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">Drag items to reorder. Set a parent to create dropdown links, or choose Mega for wider desktop navigation panels.</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDraggedId(item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropItem(item.id)}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-[24px_1fr_1fr]">
              <button type="button" className="mt-2 cursor-grab text-slate-500"><GripVertical className="h-4 w-4" /></button>
              <Input label="Label" value={item.label} onChange={(event) => updateItem(item.id, { label: event.target.value })} />
              <Input label="URL" value={item.url} onChange={(event) => updateItem(item.id, { url: event.target.value })} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Select label="Menu type" value={item.type} onChange={(value) => updateItem(item.id, { type: value })} options={[['link', 'Link'], ['dropdown', 'Dropdown'], ['mega', 'Mega menu']]} />
              <Select
                label="Parent item"
                value={item.parent || ''}
                onChange={(value) => updateItem(item.id, { parent: value })}
                options={[['', 'Top level'], ...items.filter((option) => option.id !== item.id).map((option) => [option.id, option.label])]}
              />
              <Button type="button" variant="ghost" className="self-end text-rose-400" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={addItem}><Plus className="h-4 w-4" /> Add menu item</Button>
    </div>
  )
}

function FooterEditor({ footer, onChange }) {
  const updateColumn = (index, changes) => {
    onChange({
      ...footer,
      columns: footer.columns.map((column, columnIndex) => (columnIndex === index ? { ...column, ...changes } : column)),
    })
  }

  const addColumn = () => {
    onChange({ ...footer, columns: [...footer.columns, { title: 'New column', links: 'Label|/url' }] })
  }

  const removeColumn = (index) => {
    onChange({ ...footer, columns: footer.columns.filter((_, columnIndex) => columnIndex !== index) })
  }

  return (
    <div className="space-y-5 p-5">
      <Textarea label="Footer top text" value={footer.top_text} rows={3} onChange={(event) => onChange({ ...footer, top_text: event.target.value })} />
      <Textarea label="Footer bottom text" value={footer.bottom_text} rows={2} onChange={(event) => onChange({ ...footer, bottom_text: event.target.value })} />

      <div className="space-y-3">
        {footer.columns.map((column, index) => (
          <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center gap-2">
              <Input label="Column title" value={column.title} onChange={(event) => updateColumn(index, { title: event.target.value })} className="flex-1" />
              <Button type="button" variant="ghost" className="mt-6 text-rose-400" onClick={() => removeColumn(index)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Textarea
              label="Links"
              value={column.links}
              rows={4}
              onChange={(event) => updateColumn(index, { links: event.target.value })}
              placeholder={'Label|/url\nAnother link|#section'}
              className="mt-3"
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={addColumn}><Plus className="h-4 w-4" /> Add footer column</Button>
    </div>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30">
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  )
}

function normalizeSettings(data) {
  const next = { ...DEFAULTS, ...data }

  Object.keys(DEFAULTS).forEach((key) => {
    if (isPlainObject(DEFAULTS[key])) {
      next[key] = { ...DEFAULTS[key], ...(isPlainObject(data[key]) ? data[key] : {}) }
    }
  })

  next.platform_name = data.platform_name || next.general.site_name || DEFAULTS.platform_name
  next.support_email = data.support_email || next.general.email || ''
  next.default_trial_days = Number(data.default_trial_days ?? DEFAULTS.default_trial_days)
  next.registration_enabled = data.registration_enabled ?? DEFAULTS.registration_enabled

  return next
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function categoryLabel(category) {
  return CATEGORIES.find((item) => item.id === category)?.label || category
}
