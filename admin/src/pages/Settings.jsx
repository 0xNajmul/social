import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, Bot, CheckCircle2, ChevronDown, ChevronRight, Clock3, Code2, CreditCard,
  ExternalLink, FileText, Globe2, GripVertical, Image as ImageIcon, Languages, Link as List2Icon, Link2, LockKeyhole, Mail,
  Menu, Palette, Plus, RefreshCw, Save, Search, ShieldCheck, SlidersHorizontal, Trash2, Upload, Users, X,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Button, Card, Input, PageLoader, Textarea } from '../components/ui'
import LanguageSettingsPanel from '../components/settings/LanguageSettingsPanel'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'integration', label: 'Integration' },
  { id: 'security', label: 'Security' },
  { id: 'system', label: 'System' },
  { id: 'advanced', label: 'Advanced' },
]

const AI_PROVIDER_FALLBACKS = [
  { key: 'openai', label: 'OpenAI', env_key: 'OPENAI_API_KEY', default_model: 'gpt-4o-mini', base_url: 'https://api.openai.com/v1', supports_sync: true },
  { key: 'anthropic', label: 'Anthropic', env_key: 'ANTHROPIC_API_KEY', default_model: 'claude-3-5-sonnet-latest', base_url: 'https://api.anthropic.com/v1', supports_sync: true },
  { key: 'google', label: 'Google Gemini', env_key: 'GOOGLE_AI_API_KEY', default_model: 'gemini-2.5-flash', base_url: 'https://generativelanguage.googleapis.com/v1beta', supports_sync: true },
  { key: 'xai', label: 'xAI', env_key: 'XAI_API_KEY', default_model: 'grok-4.3', base_url: 'https://api.x.ai/v1', supports_sync: true },
  { key: 'mistral', label: 'Mistral AI', env_key: 'MISTRAL_API_KEY', default_model: 'mistral-large-latest', base_url: 'https://api.mistral.ai/v1', supports_sync: true },
  { key: 'groq', label: 'Groq', env_key: 'GROQ_API_KEY', default_model: 'llama-3.3-70b-versatile', base_url: 'https://api.groq.com/openai/v1', supports_sync: true },
  { key: 'openrouter', label: 'OpenRouter', env_key: 'OPENROUTER_API_KEY', default_model: '~openai/gpt-latest', base_url: 'https://openrouter.ai/api/v1', supports_sync: true },
  { key: 'deepseek', label: 'DeepSeek', env_key: 'DEEPSEEK_API_KEY', default_model: 'deepseek-chat', base_url: 'https://api.deepseek.com/v1', supports_sync: true },
  { key: 'perplexity', label: 'Perplexity', env_key: 'PERPLEXITY_API_KEY', default_model: 'sonar', base_url: 'https://api.perplexity.ai', supports_sync: true },
  { key: 'cohere', label: 'Cohere', env_key: 'COHERE_API_KEY', default_model: 'command-a-03-2025', base_url: 'https://api.cohere.com', supports_sync: true },
  { key: 'custom', label: 'Custom OpenAI-compatible', env_key: 'CUSTOM_AI_API_KEY', default_model: '', base_url: '', supports_sync: true },
  { key: 'fallback', label: 'Local fallback', env_key: '', default_model: 'fallback', base_url: '', supports_sync: false },
]

const AI_PROVIDER_KEYS = AI_PROVIDER_FALLBACKS.map((provider) => provider.key)
const AI_DEFAULT_KEYS = AI_PROVIDER_KEYS.reduce((keys, provider) => ({ ...keys, [provider]: '' }), {})
const AI_DEFAULT_BASE_URLS = AI_PROVIDER_FALLBACKS.reduce((urls, provider) => ({ ...urls, [provider.key]: provider.base_url || '' }), {})
const AI_DEFAULT_MODELS = AI_PROVIDER_FALLBACKS.reduce((models, provider) => ({ ...models, [provider.key]: provider.default_model ? [provider.default_model] : [] }), {})

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
    items: [],
  },
  footer: {
    top_text: '',
    bottom_text: '',
    columns: [],
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
    mailgun_domain: '',
    mailgun_secret: '',
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
    commission_type: 'percentage',
    commission_percent: '20',
    commission_flat_amount: '10',
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
    dodo_api_base: 'https://live.dodopayments.com',
    dodo_webhook_secret: '',
    creem_api_key: '',
    creem_api_base: 'https://api.creem.io',
    creem_webhook_secret: '',
    webhook_secret: '',
    currency: 'USD',
  },
  pagination: {
    feed_items: 20,
    organizer_posts: 30,
    posts: 30,
    planner_notes: 24,
    media_assets: 36,
    automations: 24,
    accounts: 36,
  },
  ai: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    fallback_model: 'fallback',
    temperature: '0.8',
    max_tokens: '1200',
    system_prompt: 'You are an expert social media copywriter.',
    api_keys: AI_DEFAULT_KEYS,
    base_urls: AI_DEFAULT_BASE_URLS,
    models: AI_DEFAULT_MODELS,
    synced_at: {},
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
    custom: 'language',
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
      { section: 'email', key: 'smtp_host', label: 'SMTP host', providers: ['smtp'] },
      { section: 'email', key: 'smtp_port', label: 'SMTP port', providers: ['smtp'] },
      { section: 'email', key: 'smtp_username', label: 'SMTP username', providers: ['smtp'] },
      { section: 'email', key: 'smtp_password', label: 'SMTP password', type: 'password', providers: ['smtp'] },
      { section: 'email', key: 'brevo_api_key', label: 'Brevo API key', type: 'password', span: true, providers: ['brevo'] },
      { section: 'email', key: 'mailgun_domain', label: 'Mailgun domain', providers: ['mailgun'] },
      { section: 'email', key: 'mailgun_secret', label: 'Mailgun API key', type: 'password', providers: ['mailgun'] },
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
      { section: 'affiliate', key: 'commission_type', label: 'Commission type', type: 'select', options: [['percentage', 'Percentage'], ['flat', 'Flat amount']] },
      { section: 'affiliate', key: 'commission_percent', label: 'Commission percent', type: 'number' },
      { section: 'affiliate', key: 'commission_flat_amount', label: 'Flat commission amount', type: 'number' },
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
      { section: 'payments', key: 'dodo_api_key', label: 'Dodo API key', type: 'password', providers: ['dodo'] },
      { section: 'payments', key: 'dodo_api_base', label: 'Dodo API base URL', type: 'url', providers: ['dodo'] },
      { section: 'payments', key: 'dodo_webhook_secret', label: 'Dodo webhook secret', type: 'password', providers: ['dodo'] },
      { section: 'payments', key: 'creem_api_key', label: 'Creem.io API key', type: 'password', providers: ['creem'] },
      { section: 'payments', key: 'creem_api_base', label: 'Creem.io API base URL', type: 'url', providers: ['creem'] },
      { section: 'payments', key: 'creem_webhook_secret', label: 'Creem.io webhook secret', type: 'password', providers: ['creem'] },
      { section: 'payments', key: 'webhook_secret', label: 'Manual webhook secret', type: 'password', span: true, providers: ['manual'] },
    ],
  },
  {
    id: 'pagination',
    title: 'Pagination settings',
    category: 'system',
    icon: List2Icon,
    description: 'Control how many records user pages request before scroll loading more.',
    tags: ['pagination', 'load more', 'performance'],
    fields: [
      { section: 'pagination', key: 'feed_items', label: 'Feed items per load', type: 'number' },
      { section: 'pagination', key: 'organizer_posts', label: 'Organizer posts per load', type: 'number' },
      { section: 'pagination', key: 'posts', label: 'Posts per load', type: 'number' },
      { section: 'pagination', key: 'planner_notes', label: 'Planner notes per load', type: 'number' },
      { section: 'pagination', key: 'media_assets', label: 'Media assets per load', type: 'number' },
      { section: 'pagination', key: 'automations', label: 'Automations per load', type: 'number' },
      { section: 'pagination', key: 'accounts', label: 'Accounts per load', type: 'number' },
    ],
  },
  {
    id: 'ai',
    title: 'AI configuration',
    category: 'advanced',
    icon: Bot,
    description: 'Choose the AI provider, model, and generation defaults used in user content tools.',
    tags: ['ai', 'model', 'composer', 'planner', 'openai', 'anthropic', 'google'],
    custom: 'ai',
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
  const [aiProviders, setAiProviders] = useState(AI_PROVIDER_FALLBACKS)
  const [aiSyncing, setAiSyncing] = useState(null)

  useEffect(() => {
    api
      .get('/admin/settings')
      .then(({ data }) => setForm(normalizeSettings(data.data || {})))
      .catch(() => setForm(normalizeSettings({})))
  }, [])

  useEffect(() => {
    api
      .get('/admin/settings/ai/providers')
      .then(({ data }) => {
        setAiProviders(data.providers?.length ? data.providers : AI_PROVIDER_FALLBACKS)
        if (data.settings) {
          setForm((current) => current ? normalizeSettings({ ...current, ai: data.settings }) : current)
        }
      })
      .catch(() => setAiProviders(AI_PROVIDER_FALLBACKS))
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

  const syncAiModels = async (provider) => {
    const ai = form?.ai || DEFAULTS.ai
    setAiSyncing(provider)
    setMessage(null)
    try {
      const { data } = await api.post('/admin/settings/ai/models/sync', {
        provider,
        api_key: ai.api_keys?.[provider] || '',
        base_url: ai.base_urls?.[provider] || '',
      })
      setForm((current) => normalizeSettings({ ...current, ai: data.settings || current.ai }))
      if (data.providers?.length) setAiProviders(data.providers)
      setMessage({ type: 'success', text: data.message || 'AI models synced.' })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not sync AI models.' })
    } finally {
      setAiSyncing(null)
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              to="/settings"
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
              aria-label="Back to settings"
              title="Back to settings"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-white">{activeSetting.title}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{activeSetting.description}</p>
            </div>
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
            aiProviders={aiProviders}
            aiSyncing={aiSyncing}
            onSyncAiModels={syncAiModels}
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            Search settings, switch categories, and configure frontend, integrations, security, system jobs and advanced crawler controls.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input className="pl-9 pr-10" placeholder="Search settings..." value={search} onChange={(event) => setSearch(event.target.value)} />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Clear settings search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
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

function SettingDetail({ setting, form, aiProviders, aiSyncing, onSyncAiModels, updateField, updateSection, setMessage }) {
  if (setting.custom === 'menu') {
    return <MenuEditor items={form.main_menu.items || []} onChange={(items) => updateSection('main_menu', { ...form.main_menu, items })} />
  }

  if (setting.custom === 'footer') {
    return <FooterEditor footer={form.footer} onChange={(footer) => updateSection('footer', footer)} setMessage={setMessage} />
  }

  if (setting.custom === 'language') {
    return <LanguageSettingsPanel setMessage={setMessage} />
  }

  if (setting.custom === 'ai') {
    return <AiSettingsPanel form={form} providers={aiProviders} syncingProvider={aiSyncing} onChange={(ai) => updateSection('ai', ai)} onSync={onSyncAiModels} />
  }

  const imageFields = {
    general: [{ section: 'general', key: 'logo_url', label: 'Site logo', help: 'Shown on the landing page, user panel, and admin panel.' }],
    seo: [
      { section: 'seo', key: 'og_image_url', label: 'Open Graph image', help: 'Used when sharing pages on Facebook and other Open Graph surfaces.' },
      { section: 'seo', key: 'twitter_image_url', label: 'Twitter/X image', help: 'Used for Twitter/X cards.' },
    ],
  }[setting.id] || []
  const sideKeys = new Set(imageFields.map((field) => `${field.section}.${field.key}`))
  const providerValue = setting.id === 'email'
    ? form.email?.provider
    : setting.id === 'payments'
      ? form.payments?.default_provider
      : null
  const visibleFields = (setting.fields || [])
    .filter((field) => !sideKeys.has(`${field.section}.${field.key}`))
    .filter((field) => !field.providers || field.providers.includes(providerValue))

  if (imageFields.length > 0) {
    return (
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <FieldInput key={`${field.section || 'root'}-${field.key}`} field={field} form={form} onChange={updateField} />
          ))}
        </div>
        <div className="space-y-4">
          {imageFields.map((field) => (
            <ImageUploadPanel key={`${field.section}-${field.key}`} field={field} form={form} onChange={updateField} setMessage={setMessage} />
          ))}
        </div>
      </div>
    )
  }

  const sitemapUrl = userSitemapUrl()

  return (
    <div className="space-y-5 p-5">
      {setting.id === 'sitemap' && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-300" />
            <div>
              <p className="font-semibold text-white">Sitemap generator</p>
              <p className="mt-1 text-sm text-slate-400">The sitemap is generated dynamically from these settings and opens at /sitemap.xml on the user server.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    updateField({ section: 'sitemap', key: 'last_generated_at' }, new Date().toISOString())
                    setMessage({ type: 'success', text: 'Sitemap is ready. Save settings to persist the timestamp.' })
                    window.open(sitemapUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Generate and open sitemap
                </Button>
                <a href={sitemapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800">
                  <ExternalLink className="h-4 w-4" /> Open sitemap
                </a>
              </div>
              {form.sitemap.last_generated_at && <p className="mt-2 text-xs text-slate-500">Last generated: {new Date(form.sitemap.last_generated_at).toLocaleString()}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleFields.map((field) => (
          <FieldInput key={`${field.section || 'root'}-${field.key}`} field={field} form={form} onChange={updateField} />
        ))}
      </div>
    </div>
  )
}

function AiSettingsPanel({ form, providers = AI_PROVIDER_FALLBACKS, syncingProvider, onChange, onSync }) {
  const ai = normalizeAiSettings(form.ai || {})
  const providerRows = providers.length ? providers : AI_PROVIDER_FALLBACKS
  const activeProvider = providerRows.find((provider) => provider.key === ai.provider) || providerRows[0]
  const modelOptions = aiModelOptions(activeProvider?.key, ai, providerRows)

  const updateAi = (patch) => onChange(normalizeAiSettings({ ...ai, ...patch }))
  const updateNested = (section, key, value) => updateAi({ [section]: { ...(ai[section] || {}), [key]: value } })
  const selectProvider = (key) => {
    const nextOptions = aiModelOptions(key, ai, providerRows)
    updateAi({
      provider: key,
      model: nextOptions.includes(ai.model) ? ai.model : (nextOptions[0] || ''),
    })
  }

  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-white">Provider and model</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">The selected model powers the user panel AI assistant in New post and Create plan.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {providerRows.map((provider) => {
              const selected = ai.provider === provider.key
              const hasKey = Boolean(ai.api_keys?.[provider.key] || provider.key_configured || provider.key === 'fallback')
              return (
                <button
                  key={provider.key}
                  type="button"
                  onClick={() => selectProvider(provider.key)}
                  className={clsx(
                    'rounded-xl border p-4 text-left transition hover:-translate-y-0.5',
                    selected
                      ? 'border-brand-500 bg-brand-600/15 shadow-lg shadow-brand-950/20'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-700',
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-bold text-white">{provider.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{provider.env_key || 'No API key required'}</span>
                    </span>
                    {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-300" />}
                  </span>
                  <span className={clsx('mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', hasKey ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
                    {hasKey ? 'Ready' : 'Needs key'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-white">Active selection</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">{activeProvider?.label || 'Provider'} is used by the user AI tools after saving.</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-300">Model</span>
              <select
                value={ai.model || ''}
                onChange={(event) => updateAi({ model: event.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              >
                {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                {!modelOptions.length && <option value="">Add a custom model below</option>}
              </select>
            </label>
            <Input label="Custom model override" value={ai.model || ''} onChange={(event) => updateAi({ model: event.target.value })} placeholder="provider-model-name" />

            {activeProvider?.key !== 'fallback' && (
              <>
                <Input
                  label={`${activeProvider?.label || 'Provider'} API key`}
                  type="password"
                  value={ai.api_keys?.[activeProvider.key] || ''}
                  onChange={(event) => updateNested('api_keys', activeProvider.key, event.target.value)}
                  placeholder={activeProvider?.env_key || 'API key'}
                />
                <Input
                  label="Base URL"
                  value={ai.base_urls?.[activeProvider.key] || activeProvider?.base_url || ''}
                  onChange={(event) => updateNested('base_urls', activeProvider.key, event.target.value)}
                  placeholder="https://api.provider.com/v1"
                />
                <Button type="button" variant="secondary" onClick={() => onSync(activeProvider.key)} loading={syncingProvider === activeProvider.key} className="w-full">
                  <RefreshCw className="h-4 w-4" /> Sync latest models
                </Button>
                <p className="text-xs text-slate-500">Last sync: {formatSyncDate(ai.synced_at?.[activeProvider.key])}</p>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-white">Provider API keys</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Add keys now or later. Environment variables also work, and admin values override env values when filled.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providerRows.filter((provider) => provider.key !== 'fallback').map((provider) => (
            <div key={provider.key} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div>
                <p className="text-sm font-semibold text-white">{provider.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{provider.env_key}</p>
              </div>
              <Input
                label="API key"
                type="password"
                value={ai.api_keys?.[provider.key] || ''}
                onChange={(event) => updateNested('api_keys', provider.key, event.target.value)}
                placeholder={provider.env_key}
              />
              <Input
                label="Base URL"
                value={ai.base_urls?.[provider.key] || provider.base_url || ''}
                onChange={(event) => updateNested('base_urls', provider.key, event.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
            <SparkleIcon />
          </span>
          <div>
            <h3 className="font-semibold text-white">Generation defaults</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">These defaults apply to captions, hooks, hashtags, rewrites, and planner drafts.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Temperature" type="number" value={ai.temperature ?? ''} onChange={(event) => updateAi({ temperature: event.target.value })} />
          <Input label="Max tokens" type="number" value={ai.max_tokens ?? ''} onChange={(event) => updateAi({ max_tokens: event.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="System prompt" rows={5} value={ai.system_prompt || ''} onChange={(event) => updateAi({ system_prompt: event.target.value })} />
          </div>
        </div>
      </section>
    </div>
  )
}

function SparkleIcon() {
  return <Bot className="h-5 w-5" />
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

function ImageUploadPanel({ field, form, onChange, setMessage }) {
  const [uploading, setUploading] = useState(false)
  const value = field.section ? form[field.section]?.[field.key] : form[field.key]

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const payload = new FormData()
      payload.append('logo', file)
      const { data } = await api.post('/admin/settings/logo', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      onChange(field, data.url)
      setMessage({ type: 'success', text: `${field.label} uploaded. Save settings to publish it.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || `Could not upload ${field.label.toLowerCase()}.` })
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300">
          <ImageIcon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-semibold text-white">{field.label}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{field.help}</p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {value ? (
          <img src={value} alt="" className="h-40 w-full object-contain p-3" />
        ) : (
          <div className="flex h-40 items-center justify-center text-slate-600">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
      </div>
      <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading...' : 'Upload image'}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={upload} disabled={uploading} />
      </label>
      <Input label="Image URL" value={value || ''} onChange={(event) => onChange(field, event.target.value)} className="mt-3" />
    </div>
  )
}

function MenuEditor({ items, onChange }) {
  const [draggedId, setDraggedId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [openIds, setOpenIds] = useState(() => items.map((item) => item.id))

  const commitItems = (nextItems) => {
    onChange(nextItems.map((item, index) => ({
      id: item.id || `menu-${Date.now()}-${index}`,
      label: item.label || 'Menu item',
      url: item.url || '#',
      type: item.type || 'link',
      parent: item.parent || '',
      icon: item.icon || '',
      description: item.description || '',
      badge: item.badge || '',
      columns: item.columns || '',
    })))
  }

  const updateItem = (id, changes) => {
    commitItems(items.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }

  const addItem = (type = 'link') => {
    const id = `menu-${Date.now()}`
    const baseLabel = type === 'mega' ? 'New mega menu' : type === 'dropdown' ? 'New dropdown' : 'New menu item'
    const next = [
      ...items,
      { id, label: baseLabel, url: '#', type, parent: '', icon: type === 'mega' ? 'layers' : 'link', description: '', badge: '', columns: type === 'mega' ? 'Features, Resources' : '' },
    ]

    if (type === 'dropdown' || type === 'mega') {
      next.push({
        id: `${id}-child`,
        label: 'New submenu item',
        url: '#product',
        type: 'link',
        parent: id,
        icon: type === 'mega' ? 'sparkle' : 'link',
        description: 'Short description for the dropdown item.',
        badge: '',
        columns: type === 'mega' ? 'Features' : '',
      })
      setOpenIds((current) => [...new Set([...current, id, `${id}-child`])])
    } else {
      setOpenIds((current) => [...new Set([...current, id])])
    }

    commitItems(next)
  }

  const addChild = (parent) => {
    const id = `menu-${Date.now()}`
    const parentColumns = splitCommaList(parent.columns)
    const nextParentType = parent.type === 'mega' ? 'mega' : 'dropdown'
    const next = items.map((item) => item.id === parent.id ? { ...item, type: nextParentType } : item)
    next.push({
      id,
      label: 'New submenu item',
      url: '#product',
      type: 'link',
      parent: parent.id,
      icon: parent.type === 'mega' ? 'sparkle' : 'link',
      description: 'Short description shown in the public menu.',
      badge: '',
      columns: parent.type === 'mega' ? (parentColumns[0] || 'Features') : '',
    })
    setOpenIds((current) => [...new Set([...current, parent.id, id])])
    commitItems(next)
  }

  const removeItem = (id) => {
    commitItems(items.filter((item) => item.id !== id).map((item) => (item.parent === id ? { ...item, parent: '' } : item)))
  }

  const dropItem = (targetId) => {
    if (!draggedId || draggedId === targetId) return
    const fromIndex = items.findIndex((item) => item.id === draggedId)
    const toIndex = items.findIndex((item) => item.id === targetId)
    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    commitItems(next)
    setDraggedId(null)
    setDropTarget(null)
  }

  const toggleOpen = (id) => {
    setOpenIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const orderedItems = flattenMenuItems(items)

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="font-semibold text-white">Landing navigation support</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">Create top-level links, dropdowns, or mega menus for the public homepage. Use Add child under a top-level item to make the dropdown list visible on hover.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => addItem('link')}><Plus className="h-3.5 w-3.5" /> Add link</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => addItem('dropdown')}><Plus className="h-3.5 w-3.5" /> Add dropdown</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => addItem('mega')}><Plus className="h-3.5 w-3.5" /> Add mega menu</Button>
        </div>
      </div>

      <div className="space-y-3">
        {orderedItems.map(({ item, depth }) => {
          const open = openIds.includes(item.id)
          return (
            <div key={item.id}>
              <div className={clsx('h-1 rounded-full bg-brand-500 transition', dropTarget === item.id ? 'opacity-100' : 'opacity-0')} />
              <div
                draggable
                onDragStart={() => setDraggedId(item.id)}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDropTarget(item.id)
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={() => dropItem(item.id)}
                className="rounded-xl border border-slate-800 bg-slate-950/40"
                style={{ marginLeft: `${depth * 24}px` }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" className="cursor-grab text-slate-500"><GripVertical className="h-4 w-4" /></button>
                  <button type="button" onClick={() => toggleOpen(item.id)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800">
                    <ChevronDown className={clsx('h-4 w-4 transition', !open && '-rotate-90')} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{item.label}</p>
                    <p className="truncate text-xs text-slate-500">{item.icon || 'no icon'} · {item.url || '#'} · {item.type || 'link'}{item.parent ? ' · submenu' : ''}{item.columns ? ` · ${item.columns}` : ''}</p>
                  </div>
                  {item.badge && <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-300">{item.badge}</span>}
                  {!item.parent && <Button type="button" size="sm" variant="secondary" onClick={() => addChild(item)}><Plus className="h-3.5 w-3.5" /> Child</Button>}
                  <Button type="button" size="sm" variant="ghost" className="text-rose-400" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {open && (
                  <div className="grid gap-3 border-t border-slate-800 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Input label="Label" value={item.label} onChange={(event) => updateItem(item.id, { label: event.target.value })} />
                    <Input label="URL" value={item.url} onChange={(event) => updateItem(item.id, { url: event.target.value })} />
                    <Select label="Menu type" value={item.type} onChange={(value) => updateItem(item.id, { type: value })} options={[['link', 'Link'], ['dropdown', 'Dropdown'], ['mega', 'Mega menu']]} />
                    <Input label="Icon name" value={item.icon || ''} onChange={(event) => updateItem(item.id, { icon: event.target.value })} placeholder="zap, calendar, chart" />
                    <Input label="Badge" value={item.badge || ''} onChange={(event) => updateItem(item.id, { badge: event.target.value })} placeholder="New, Popular" />
                    <Input label={item.parent ? 'Mega column/group' : 'Mega columns'} value={item.columns || ''} onChange={(event) => updateItem(item.id, { columns: event.target.value })} placeholder={item.parent ? 'Features' : 'Features, Resources'} />
                    <Select
                      label="Parent item"
                      value={item.parent || ''}
                      onChange={(value) => updateItem(item.id, { parent: value })}
                      options={[['', 'Top level'], ...items.filter((option) => option.id !== item.id && !option.parent).map((option) => [option.id, option.label])]}
                    />
                    <div className="sm:col-span-2 xl:col-span-3">
                      <Textarea label="Description" rows={2} value={item.description || ''} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Short helper text shown in dropdown or mega menu." />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function splitCommaList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function flattenMenuItems(items) {
  const childrenByParent = items.reduce((map, item) => {
    const parent = item.parent || ''
    map[parent] = [...(map[parent] || []), item]
    return map
  }, {})
  const rows = []
  const visit = (parent = '', depth = 0) => {
    ;(childrenByParent[parent] || []).forEach((item) => {
      rows.push({ item, depth })
      visit(item.id, depth + 1)
    })
  }
  visit()

  const known = new Set(rows.map(({ item }) => item.id))
  items.filter((item) => !known.has(item.id)).forEach((item) => rows.push({ item, depth: 0 }))
  return rows
}

function FooterEditor({ footer, onChange, setMessage }) {
  const columns = normalizeFooterColumns(footer.columns || [])
  const [draggedWidget, setDraggedWidget] = useState(null)
  const [openWidgets, setOpenWidgets] = useState({})

  const commitColumns = (nextColumns) => {
    onChange({ ...footer, columns: nextColumns })
  }

  const setColumnCount = (count) => {
    const target = Math.max(1, Math.min(Number(count) || 1, 6))
    if (target === columns.length) return

    if (target > columns.length) {
      const next = [...columns]
      while (next.length < target) {
        next.push({ id: nextFooterColumnId(next), title: `Column ${next.length + 1}`, width: '1fr', widgets: [] })
      }
      commitColumns(next)
      return
    }

    const kept = columns.slice(0, target)
    const overflowWidgets = columns.slice(target).flatMap((column) => column.widgets || [])
    if (overflowWidgets.length && kept.length) {
      kept[kept.length - 1] = {
        ...kept[kept.length - 1],
        widgets: [...(kept[kept.length - 1].widgets || []), ...overflowWidgets],
      }
    }
    commitColumns(kept)
  }

  const updateColumn = (columnId, changes) => {
    commitColumns(columns.map((column) => (column.id === columnId ? { ...column, ...changes } : column)))
  }

  const addColumn = () => {
    commitColumns([...columns, { id: nextFooterColumnId(columns), title: 'New column', width: '1fr', widgets: [] }])
  }

  const removeColumn = (columnId) => {
    const removed = columns.find((column) => column.id === columnId)
    const remaining = columns.filter((column) => column.id !== columnId)
    if (removed?.widgets?.length && remaining.length) {
      remaining[remaining.length - 1] = {
        ...remaining[remaining.length - 1],
        widgets: [...(remaining[remaining.length - 1].widgets || []), ...removed.widgets],
      }
    }
    commitColumns(remaining)
  }

  const addWidget = (columnId, type = 'text') => {
    const widget = newFooterWidget(type)
    commitColumns(columns.map((column) => column.id === columnId ? {
      ...column,
      widgets: [...(column.widgets || []), widget],
    } : column))
    setOpenWidgets((current) => ({ ...current, [widget.id]: true }))
  }

  const updateWidget = (columnId, widgetId, changes) => {
    commitColumns(columns.map((column) => column.id === columnId ? {
      ...column,
      widgets: (column.widgets || []).map((widget) => (widget.id === widgetId ? { ...widget, ...changes } : widget)),
    } : column))
  }

  const removeWidget = (columnId, widgetId) => {
    commitColumns(columns.map((column) => column.id === columnId ? {
      ...column,
      widgets: (column.widgets || []).filter((widget) => widget.id !== widgetId),
    } : column))
  }

  const dropWidget = (targetColumnId, targetWidgetId = null) => {
    if (!draggedWidget) return
    const sourceColumn = columns.find((column) => column.id === draggedWidget.columnId)
    const widget = sourceColumn?.widgets?.find((item) => item.id === draggedWidget.widgetId)
    if (!widget) return

    const withoutWidget = columns.map((column) => column.id === draggedWidget.columnId ? {
      ...column,
      widgets: (column.widgets || []).filter((item) => item.id !== draggedWidget.widgetId),
    } : column)

    const next = withoutWidget.map((column) => {
      if (column.id !== targetColumnId) return column
      const widgets = [...(column.widgets || [])]
      const index = targetWidgetId ? widgets.findIndex((item) => item.id === targetWidgetId) : widgets.length
      widgets.splice(index < 0 ? widgets.length : index, 0, widget)
      return { ...column, widgets }
    })

    commitColumns(next)
    setDraggedWidget(null)
  }

  const toggleWidget = (widgetId) => {
    setOpenWidgets((current) => ({ ...current, [widgetId]: current[widgetId] === false }))
  }

  const isWidgetOpen = (widgetId) => openWidgets[widgetId] !== false

  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea label="Footer intro text" value={footer.top_text || ''} rows={3} onChange={(event) => onChange({ ...footer, top_text: event.target.value })} />
          <Textarea label="Bottom copyright / legal text" value={footer.bottom_text || ''} rows={3} onChange={(event) => onChange({ ...footer, bottom_text: event.target.value })} />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-sm font-semibold text-white">Footer layout</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Choose how many widget columns the public landing page should render.</p>
          <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
            <Select
              label="Columns"
              value={String(Math.max(columns.length, 1))}
              onChange={setColumnCount}
              options={[1, 2, 3, 4, 5, 6].map((count) => [String(count), `${count} column${count === 1 ? '' : 's'}`])}
            />
            <Button type="button" variant="secondary" onClick={addColumn}><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-white">Footer widget columns</p>
            <p className="mt-1 text-sm text-slate-400">Add widgets, collapse sections, drag widgets between columns, and reorder menu links.</p>
          </div>
          <div className="text-xs font-semibold text-slate-500">{columns.length} active column{columns.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {columns.map((column) => (
          <div
            key={column.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => dropWidget(column.id)}
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
              <Input label="Column title" value={column.title} onChange={(event) => updateColumn(column.id, { title: event.target.value })} />
              <Input label="Width" value={column.width || '1fr'} onChange={(event) => updateColumn(column.id, { width: event.target.value })} />
              <Button type="button" variant="ghost" className="mt-6 text-rose-400" onClick={() => removeColumn(column.id)} disabled={columns.length <= 1}><Trash2 className="h-4 w-4" /></Button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {['text', 'menu', 'image', 'button', 'link'].map((type) => (
                <Button key={type} type="button" size="sm" variant="secondary" onClick={() => addWidget(column.id, type)}><Plus className="h-3.5 w-3.5" /> {type}</Button>
              ))}
            </div>

            <div className="space-y-3">
              {(column.widgets || []).map((widget) => (
                <div
                  key={widget.id}
                  draggable
                  onDragStart={() => setDraggedWidget({ columnId: column.id, widgetId: widget.id })}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.stopPropagation()
                    dropWidget(column.id, widget.id)
                  }}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                >
                  <div className="flex items-center gap-2 border-b border-slate-800 p-3">
                    <GripVertical className="h-4 w-4 cursor-grab text-slate-500" />
                    <button type="button" onClick={() => toggleWidget(widget.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-slate-800" aria-expanded={isWidgetOpen(widget.id)}>
                      <ChevronRight className={clsx('h-4 w-4 shrink-0 text-slate-500 transition', isWidgetOpen(widget.id) && 'rotate-90')} />
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{widget.type}</span>
                      <span className="min-w-0 truncate text-sm font-semibold text-white">{widget.title || widget.label || 'Untitled widget'}</span>
                    </button>
                    <Button type="button" size="sm" variant="ghost" className="text-rose-400" onClick={() => removeWidget(column.id, widget.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {isWidgetOpen(widget.id) && (
                    <div className="space-y-3 p-3">
                      <Input label="Widget title" value={widget.title || ''} onChange={(event) => updateWidget(column.id, widget.id, { title: event.target.value })} placeholder="Optional heading" />
                      <FooterWidgetFields widget={widget} onChange={(changes) => updateWidget(column.id, widget.id, changes)} setMessage={setMessage} />
                    </div>
                  )}
                </div>
              ))}
              {(column.widgets || []).length === 0 && <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">Drop widgets here or add one above.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FooterWidgetFields({ widget, onChange, setMessage }) {
  if (widget.type === 'text') {
    return <Textarea label="Text" rows={4} value={widget.text || ''} onChange={(event) => onChange({ text: event.target.value })} />
  }

  if (widget.type === 'menu') {
    return <FooterMenuLinksEditor widget={widget} onChange={onChange} />
  }

  if (widget.type === 'image') {
    return <FooterImageWidget widget={widget} onChange={onChange} setMessage={setMessage} />
  }

  if (widget.type === 'button') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Button label" value={widget.label || ''} onChange={(event) => onChange({ label: event.target.value })} />
        <Input label="Button URL" value={widget.url || ''} onChange={(event) => onChange({ url: event.target.value })} />
        <Input label="Style" value={widget.style || 'primary'} onChange={(event) => onChange({ style: event.target.value })} />
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Link label" value={widget.label || ''} onChange={(event) => onChange({ label: event.target.value })} />
      <Input label="Link URL" value={widget.url || ''} onChange={(event) => onChange({ url: event.target.value })} />
    </div>
  )
}

function FooterMenuLinksEditor({ widget, onChange }) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const links = normalizeFooterLinks(widget)

  const commit = (nextLinks) => {
    onChange({
      items: nextLinks,
      links: stringifyFooterLinks(nextLinks),
    })
  }

  const addLink = () => {
    commit([...links, { id: `footer-link-${Date.now()}`, label: 'New link', url: '#' }])
  }

  const updateLink = (id, changes) => {
    commit(links.map((link) => (link.id === id ? { ...link, ...changes } : link)))
  }

  const removeLink = (id) => {
    commit(links.filter((link) => link.id !== id))
  }

  const moveLink = (from, to) => {
    if (from === null || from === to || to < 0 || to >= links.length) return
    const next = [...links]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    commit(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-300">Menu links</p>
        <Button type="button" size="sm" variant="secondary" onClick={addLink}><Plus className="h-3.5 w-3.5" /> Add link</Button>
      </div>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div
            key={link.id}
            draggable
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              moveLink(draggedIndex, index)
              setDraggedIndex(null)
            }}
            className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-[auto_1fr_1fr_auto]"
          >
            <GripVertical className="mt-3 h-4 w-4 cursor-grab text-slate-500" />
            <Input label="Label" value={link.label} onChange={(event) => updateLink(link.id, { label: event.target.value })} />
            <Input label="URL" value={link.url} onChange={(event) => updateLink(link.id, { url: event.target.value })} />
            <Button type="button" variant="ghost" className="mt-6 text-rose-400" onClick={() => removeLink(link.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {links.length === 0 && <div className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-sm text-slate-500">No links yet.</div>}
      </div>
    </div>
  )
}

function FooterImageWidget({ widget, onChange, setMessage }) {
  const [uploading, setUploading] = useState(false)

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const payload = new FormData()
      payload.append('logo', file)
      const { data } = await api.post('/admin/settings/logo', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      onChange({ image_url: data.url })
      setMessage?.({ type: 'success', text: 'Footer image uploaded. Save settings to publish it.' })
    } catch (error) {
      setMessage?.({ type: 'error', text: error.response?.data?.message || 'Could not upload footer image.' })
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        {widget.image_url ? (
          <img src={widget.image_url} alt="" className="h-40 w-full object-contain p-3" />
        ) : (
          <div className="flex h-40 items-center justify-center text-slate-600">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
      </div>
      <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading...' : 'Upload image'}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={upload} disabled={uploading} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Image URL" value={widget.image_url || ''} onChange={(event) => onChange({ image_url: event.target.value })} />
        <Input label="Alt text" value={widget.alt || ''} onChange={(event) => onChange({ alt: event.target.value })} />
        <Input label="Link URL" value={widget.url || ''} onChange={(event) => onChange({ url: event.target.value })} className="sm:col-span-2" />
      </div>
    </div>
  )
}

function normalizeFooterColumns(columns) {
  return columns.map((column, index) => ({
    id: column.id || `column-${index}`,
    title: column.title || `Column ${index + 1}`,
    width: column.width || '1fr',
    widgets: Array.isArray(column.widgets)
      ? column.widgets.map((widget, widgetIndex) => ({
        id: widget.id || `widget-${index}-${widgetIndex}`,
        type: widget.type || 'text',
        ...widget,
        items: widget.type === 'menu' ? normalizeFooterLinks(widget) : widget.items,
      }))
      : column.links
        ? [{ id: `widget-${index}-links`, type: 'menu', title: column.title || 'Links', links: column.links }]
        : [],
  }))
}

function nextFooterColumnId(columns) {
  let index = columns.length + 1
  while (columns.some((column) => column.id === `column-${index}`)) index += 1
  return `column-${index}`
}

function newFooterWidget(type) {
  const id = `widget-${Date.now()}-${Math.round(Math.random() * 1000)}`
  const base = { id, type, title: type.charAt(0).toUpperCase() + type.slice(1) }
  if (type === 'menu') return { ...base, links: '', items: [] }
  if (type === 'image') return { ...base, image_url: '', alt: '', url: '' }
  if (type === 'button') return { ...base, label: 'Get started', url: '#', style: 'primary' }
  if (type === 'link') return { ...base, label: 'Link label', url: '#' }
  return { ...base, text: 'Add footer text here.' }
}

function normalizeFooterLinks(widget) {
  if (Array.isArray(widget.items)) {
    return widget.items.map((item, index) => ({
      id: item.id || `footer-link-${Date.now()}-${index}`,
      label: item.label || '',
      url: item.url || '#',
    }))
  }

  return String(widget.links || '')
    .split('\n')
    .map((row, index) => {
      const [label = '', url = '#'] = row.split('|').map((item) => item.trim())
      return { id: `footer-link-${index}`, label, url }
    })
    .filter((item) => item.label)
}

function stringifyFooterLinks(links) {
  return links
    .filter((link) => link.label)
    .map((link) => `${link.label}|${link.url || '#'}`)
    .join('\n')
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
  next.footer = {
    ...next.footer,
    columns: normalizeFooterColumns(Array.isArray(next.footer?.columns) ? next.footer.columns : DEFAULTS.footer.columns),
  }
  next.ai = normalizeAiSettings(next.ai)

  return next
}

function normalizeAiSettings(ai = {}) {
  return {
    ...DEFAULTS.ai,
    ...(isPlainObject(ai) ? ai : {}),
    api_keys: { ...DEFAULTS.ai.api_keys, ...(isPlainObject(ai.api_keys) ? ai.api_keys : {}) },
    base_urls: { ...DEFAULTS.ai.base_urls, ...(isPlainObject(ai.base_urls) ? ai.base_urls : {}) },
    models: { ...DEFAULTS.ai.models, ...(isPlainObject(ai.models) ? ai.models : {}) },
    synced_at: { ...DEFAULTS.ai.synced_at, ...(isPlainObject(ai.synced_at) ? ai.synced_at : {}) },
  }
}

function aiModelOptions(providerKey, ai, providers = AI_PROVIDER_FALLBACKS) {
  const provider = providers.find((item) => item.key === providerKey) || AI_PROVIDER_FALLBACKS.find((item) => item.key === providerKey) || AI_PROVIDER_FALLBACKS[0]
  return [
    ...(provider.default_models || []),
    provider.default_model,
    ...((ai.models?.[providerKey] || []).filter(Boolean)),
    ai.provider === providerKey ? ai.model : '',
  ].filter(Boolean).filter((model, index, list) => list.indexOf(model) === index)
}

function formatSyncDate(value) {
  if (!value) return 'Never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function userSitemapUrl() {
  if (typeof window === 'undefined') return '/sitemap.xml'
  const { protocol, hostname, port } = window.location
  if (port === '5174') return `${protocol}//${hostname === '127.0.0.1' ? 'localhost' : hostname}:5173/sitemap.xml`
  return '/sitemap.xml'
}

function categoryLabel(category) {
  return CATEGORIES.find((item) => item.id === category)?.label || category
}
