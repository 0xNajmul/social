import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Check,
  CircleAlert,
  Clock3,
  Code,
  Copy,
  Database,
  Download,
  Eye,
  FileJson,
  FileText,
  Filter,
  GitBranch,
  ImagePlus,
  Layers3,
  ListChecks,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  Route,
  Rss,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  WandSparkles,
  Webhook,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { AccountIcon, PLATFORMS } from '../components/PlatformBadge'
import { Badge, Button, Input, PageLoader, Textarea } from '../components/ui'

const NODE_TYPES = { workflowNode: WorkflowNode }
const BUILDER_VERSION = 'social_mvp_v1'

const CATEGORY_ORDER = [
  'Triggers',
  'Content',
  'AI Tools',
  'Media',
  'Logic',
  'Approval',
  'Social Publishing',
  'Analytics',
  'Notifications',
  'Data / Integrations',
  'Developer Tools',
]

const CATEGORY_ICONS = {
  Triggers: Zap,
  Content: FileText,
  'AI Tools': Bot,
  Media: ImagePlus,
  Logic: GitBranch,
  Approval: ShieldCheck,
  'Social Publishing': Send,
  Analytics: BarChart3,
  Notifications: Bell,
  'Data / Integrations': Database,
  'Developer Tools': Code,
}

const CATEGORY_TONES = {
  Triggers: 'sky',
  Content: 'emerald',
  'AI Tools': 'violet',
  Media: 'amber',
  Logic: 'slate',
  Approval: 'rose',
  'Social Publishing': 'indigo',
  Analytics: 'cyan',
  Notifications: 'orange',
  'Data / Integrations': 'teal',
  'Developer Tools': 'gray',
}

const NODE_TONES = {
  sky: {
    badge: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-800',
    node: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/20',
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    handle: '#0284c7',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800',
    node: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/20',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    handle: '#059669',
  },
  violet: {
    badge: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:ring-violet-800',
    node: 'border-violet-200 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/20',
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    handle: '#7c3aed',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800',
    node: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/20',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    handle: '#d97706',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-800',
    node: 'border-rose-200 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/20',
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    handle: '#e11d48',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800',
    node: 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/70 dark:bg-indigo-950/20',
    icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    handle: '#4f46e5',
  },
  cyan: {
    badge: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:ring-cyan-800',
    node: 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/70 dark:bg-cyan-950/20',
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    handle: '#0891b2',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-800',
    node: 'border-orange-200 bg-orange-50/70 dark:border-orange-900/70 dark:bg-orange-950/20',
    icon: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    handle: '#ea580c',
  },
  teal: {
    badge: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:ring-teal-800',
    node: 'border-teal-200 bg-teal-50/70 dark:border-teal-900/70 dark:bg-teal-950/20',
    icon: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
    handle: '#0d9488',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
    node: 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80',
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    handle: '#64748b',
  },
  gray: {
    badge: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
    node: 'border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/80',
    icon: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    handle: '#6b7280',
  },
}

const PUBLISH_PLATFORMS = [
  ['facebook_page', 'Facebook Page', 'Publish post'],
  ['instagram', 'Instagram Business and Creator', 'Publish image, carousel, reel'],
  ['tiktok', 'TikTok', 'Upload video'],
  ['youtube', 'YouTube', 'Upload video or Short'],
  ['twitter', 'X (Twitter)', 'Publish post'],
  ['linkedin_profile', 'LinkedIn Profile', 'Share update'],
  ['linkedin_page', 'LinkedIn Page', 'Share company update'],
  ['pinterest', 'Pinterest', 'Create pin'],
  ['reddit', 'Reddit', 'Submit post'],
  ['threads', 'Threads', 'Publish thread'],
  ['bluesky', 'Bluesky', 'Publish post'],
  ['mastodon', 'Mastodon', 'Publish toot'],
  ['google_business', 'Google Business Profile', 'Publish local update'],
  ['telegram', 'Telegram Channel', 'Send channel post'],
  ['discord', 'Discord Channel', 'Send channel message'],
  ['whatsapp', 'WhatsApp Business', 'Send approved message'],
  ['snapchat', 'Snapchat', 'Publish story media'],
]

const BASE_NODE_DEFINITIONS = [
  {
    key: 'manual_trigger',
    category: 'Triggers',
    label: 'Manual Trigger',
    description: 'Starts when a teammate runs the workflow.',
    icon: Play,
    tone: 'sky',
    fields: [],
  },
  {
    key: 'schedule_trigger',
    category: 'Triggers',
    label: 'Schedule Trigger',
    description: 'Runs daily, weekly, or on a fixed interval.',
    icon: Clock3,
    tone: 'sky',
    defaults: { cadence: 'daily', time: '09:00', timezone: 'workspace', interval_minutes: 1440 },
    fields: [
      { key: 'cadence', label: 'Cadence', type: 'select', options: [['daily', 'Daily'], ['weekly', 'Weekly'], ['interval', 'Every N minutes']] },
      { key: 'time', label: 'Time', type: 'time' },
      { key: 'interval_minutes', label: 'Interval minutes', type: 'number', min: 5 },
      { key: 'timezone', label: 'Timezone', type: 'select', options: [['workspace', 'Workspace timezone'], ['UTC', 'UTC'], ['America/New_York', 'America/New_York'], ['Europe/London', 'Europe/London'], ['Asia/Dhaka', 'Asia/Dhaka']] },
    ],
  },
  {
    key: 'rss_feed_trigger',
    category: 'Triggers',
    label: 'RSS Feed Trigger',
    description: 'Watches article feeds and passes new items forward.',
    icon: Rss,
    tone: 'sky',
    defaults: { feed_urls: '', poll_minutes: 30, max_items: 3 },
    fields: [
      { key: 'feed_urls', label: 'Feed URLs', type: 'textarea', placeholder: 'https://example.com/feed.xml' },
      { key: 'poll_minutes', label: 'Check every minutes', type: 'number', min: 5 },
      { key: 'max_items', label: 'Max new items', type: 'number', min: 1 },
    ],
  },
  {
    key: 'webhook_trigger',
    category: 'Triggers',
    label: 'Webhook Trigger',
    description: 'Accepts a POST payload from another tool.',
    icon: Webhook,
    tone: 'sky',
    defaults: { path: '/incoming/social-workflow', secret_required: true },
    fields: [
      { key: 'path', label: 'Webhook path', type: 'text', placeholder: '/incoming/social-workflow' },
      { key: 'secret_required', label: 'Require signing secret', type: 'checkbox' },
    ],
  },
  {
    key: 'create_post',
    category: 'Content',
    label: 'Create Post',
    description: 'Defines post text, link, and campaign context.',
    icon: FileText,
    tone: 'emerald',
    defaults: { title: '', caption: '', link: '', campaign: '' },
    fields: [
      { key: 'title', label: 'Post title', type: 'text' },
      { key: 'caption', label: 'Caption', type: 'textarea', placeholder: 'Write the source caption or use {{rss.title}}.' },
      { key: 'link', label: 'Link', type: 'text', placeholder: '{{rss.link}}' },
      { key: 'campaign', label: 'Campaign', type: 'text' },
    ],
  },
  {
    key: 'platform_variant_generator',
    category: 'Content',
    label: 'Platform Variant Generator',
    description: 'Creates per-platform copy variants before publishing.',
    icon: Layers3,
    tone: 'emerald',
    defaults: { source_field: 'caption', variants: 'short, professional, hashtag-rich' },
    fields: [
      { key: 'source_field', label: 'Source field', type: 'select', options: [['caption', 'Caption'], ['rss.summary', 'RSS summary'], ['ai.output', 'AI output']] },
      { key: 'variants', label: 'Variant instructions', type: 'textarea' },
    ],
  },
  {
    key: 'content_library',
    category: 'Content',
    label: 'Content Library',
    description: 'Uses saved posts or media as the content source.',
    icon: Database,
    tone: 'emerald',
    defaults: { source: 'draft_posts', status: 'ready' },
    fields: [
      { key: 'source', label: 'Source', type: 'select', options: [['draft_posts', 'Draft posts'], ['media_library', 'Media library'], ['approved_posts', 'Approved posts']] },
      { key: 'status', label: 'Status', type: 'select', options: [['ready', 'Ready'], ['approved', 'Approved'], ['scheduled', 'Scheduled']] },
    ],
  },
  {
    key: 'ai_caption_generator',
    category: 'AI Tools',
    label: 'AI Caption Generator',
    description: 'Drafts captions from the incoming item.',
    icon: WandSparkles,
    tone: 'violet',
    defaults: { tone: 'friendly', length: 'medium', include_cta: true },
    fields: [
      { key: 'tone', label: 'Tone', type: 'select', options: [['friendly', 'Friendly'], ['professional', 'Professional'], ['playful', 'Playful'], ['urgent', 'Urgent'], ['educational', 'Educational']] },
      { key: 'length', label: 'Length', type: 'select', options: [['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']] },
      { key: 'include_cta', label: 'Include call to action', type: 'checkbox' },
    ],
  },
  {
    key: 'ai_hashtag_generator',
    category: 'AI Tools',
    label: 'AI Hashtag Generator',
    description: 'Suggests hashtags using content and platform context.',
    icon: Sparkles,
    tone: 'violet',
    defaults: { count: 8, style: 'balanced' },
    fields: [
      { key: 'count', label: 'Hashtag count', type: 'number', min: 1 },
      { key: 'style', label: 'Style', type: 'select', options: [['balanced', 'Balanced'], ['niche', 'Niche'], ['broad', 'Broad'], ['local', 'Local']] },
    ],
  },
  {
    key: 'ai_summarize_article',
    category: 'AI Tools',
    label: 'AI Article Summarizer',
    description: 'Turns RSS or link content into a short social summary.',
    icon: Bot,
    tone: 'violet',
    defaults: { max_words: 90, preserve_link: true },
    fields: [
      { key: 'max_words', label: 'Max words', type: 'number', min: 20 },
      { key: 'preserve_link', label: 'Keep source link', type: 'checkbox' },
    ],
  },
  {
    key: 'add_media',
    category: 'Media',
    label: 'Add Image/Video',
    description: 'Attaches media from URL, feed enclosure, or media library.',
    icon: ImagePlus,
    tone: 'amber',
    defaults: { source: 'feed_or_library', alt_text: '' },
    fields: [
      { key: 'source', label: 'Media source', type: 'select', options: [['feed_or_library', 'Feed or media library'], ['media_library', 'Media library'], ['url', 'Direct URL']] },
      { key: 'media_url', label: 'Media URL', type: 'text', placeholder: 'https://example.com/image.jpg' },
      { key: 'alt_text', label: 'Alt text', type: 'text' },
    ],
  },
  {
    key: 'platform_media_validator',
    category: 'Media',
    label: 'Platform Media Validator',
    description: 'Checks media format and size before publishing.',
    icon: Eye,
    tone: 'amber',
    defaults: { block_invalid: true, create_warning: true },
    fields: [
      { key: 'block_invalid', label: 'Block invalid media', type: 'checkbox' },
      { key: 'create_warning', label: 'Create warning note', type: 'checkbox' },
    ],
  },
  {
    key: 'filter',
    category: 'Logic',
    label: 'Filter',
    description: 'Continues only when conditions match.',
    icon: Filter,
    tone: 'slate',
    defaults: { field: 'caption', operator: 'contains', value: '' },
    fields: [
      { key: 'field', label: 'Field', type: 'select', options: [['caption', 'Caption'], ['rss.title', 'RSS title'], ['platform', 'Platform'], ['approval.status', 'Approval status']] },
      { key: 'operator', label: 'Operator', type: 'select', options: [['contains', 'Contains'], ['not_contains', 'Does not contain'], ['equals', 'Equals'], ['exists', 'Exists']] },
      { key: 'value', label: 'Value', type: 'text' },
    ],
  },
  {
    key: 'router',
    category: 'Logic',
    label: 'Router',
    description: 'Branches one item into platform or campaign routes.',
    icon: Route,
    tone: 'slate',
    defaults: { route_by: 'platform', fallback_route: true },
    fields: [
      { key: 'route_by', label: 'Route by', type: 'select', options: [['platform', 'Platform'], ['content_type', 'Content type'], ['approval', 'Approval result'], ['campaign', 'Campaign']] },
      { key: 'fallback_route', label: 'Enable fallback route', type: 'checkbox' },
    ],
  },
  {
    key: 'delay_wait_until',
    category: 'Logic',
    label: 'Delay/Wait Until',
    description: 'Waits for a fixed delay or a planned publish time.',
    icon: Timer,
    tone: 'slate',
    defaults: { mode: 'delay', delay_minutes: 30, wait_until: '' },
    fields: [
      { key: 'mode', label: 'Mode', type: 'select', options: [['delay', 'Delay'], ['wait_until', 'Wait until date field']] },
      { key: 'delay_minutes', label: 'Delay minutes', type: 'number', min: 1 },
      { key: 'wait_until', label: 'Date field', type: 'text', placeholder: '{{post.scheduled_at}}' },
    ],
  },
  {
    key: 'approval_required',
    category: 'Approval',
    label: 'Approval Required',
    description: 'Creates a review gate before scheduling or publishing.',
    icon: ShieldCheck,
    tone: 'rose',
    defaults: { approver: 'workspace_admin', timeout_hours: 24, reject_action: 'create_draft' },
    fields: [
      { key: 'approver', label: 'Approver', type: 'select', options: [['workspace_admin', 'Workspace admin'], ['post_owner', 'Post owner'], ['any_editor', 'Any editor']] },
      { key: 'timeout_hours', label: 'Timeout hours', type: 'number', min: 1 },
      { key: 'reject_action', label: 'If rejected', type: 'select', options: [['create_draft', 'Keep as draft'], ['stop', 'Stop workflow'], ['notify', 'Notify owner']] },
    ],
  },
  {
    key: 'publish_social_account',
    category: 'Social Publishing',
    label: 'Publish to Social Account',
    description: 'Publishes or schedules posts to selected connected accounts.',
    icon: Send,
    tone: 'indigo',
    defaults: { account_ids: [], publish_mode: 'schedule_or_now', post_type: 'auto', caption_field: '{{caption}}' },
    fields: [
      { key: 'account_ids', label: 'Accounts', type: 'accountMulti', required: true },
      { key: 'publish_mode', label: 'Publish mode', type: 'select', options: [['schedule_or_now', 'Schedule or publish now'], ['draft', 'Create draft'], ['publish_now', 'Publish now']] },
      { key: 'post_type', label: 'Post type', type: 'select', options: [['auto', 'Auto'], ['text', 'Text'], ['image', 'Image'], ['video', 'Video'], ['reel', 'Reel/Short'], ['story', 'Story']] },
      { key: 'caption_field', label: 'Caption field', type: 'text' },
    ],
  },
  {
    key: 'create_draft',
    category: 'Social Publishing',
    label: 'Create Draft Post',
    description: 'Creates a saved draft for manual review in the app.',
    icon: FileText,
    tone: 'indigo',
    defaults: { status: 'draft', assign_to: 'owner' },
    fields: [
      { key: 'status', label: 'Draft status', type: 'select', options: [['draft', 'Draft'], ['needs_review', 'Needs review'], ['ready', 'Ready']] },
      { key: 'assign_to', label: 'Assign to', type: 'select', options: [['owner', 'Automation owner'], ['workspace_admin', 'Workspace admin'], ['none', 'No assignment']] },
    ],
  },
  {
    key: 'get_post_analytics',
    category: 'Analytics',
    label: 'Get Post Analytics',
    description: 'Collects engagement metrics for created posts.',
    icon: BarChart3,
    tone: 'cyan',
    defaults: { lookback_hours: 24, metrics: 'likes, comments, shares, clicks' },
    fields: [
      { key: 'lookback_hours', label: 'Lookback hours', type: 'number', min: 1 },
      { key: 'metrics', label: 'Metrics', type: 'text' },
    ],
  },
  {
    key: 'send_notification',
    category: 'Notifications',
    label: 'Send Notification',
    description: 'Notifies workspace users about workflow activity.',
    icon: Bell,
    tone: 'orange',
    defaults: { channel: 'in_app', event: 'run_completed' },
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', options: [['in_app', 'In app'], ['email', 'Email'], ['both', 'In app and email']] },
      { key: 'event', label: 'Event', type: 'select', options: [['run_completed', 'Run completed'], ['approval_needed', 'Approval needed'], ['publish_failed', 'Publish failed'], ['token_warning', 'Token warning']] },
    ],
  },
  {
    key: 'send_failure_alert',
    category: 'Notifications',
    label: 'Failure Alert',
    description: 'Alerts the team and marks the workflow for retry.',
    icon: CircleAlert,
    tone: 'orange',
    defaults: { notify: 'admins', retry: true },
    fields: [
      { key: 'notify', label: 'Notify', type: 'select', options: [['admins', 'Admins'], ['owner', 'Owner'], ['all_editors', 'All editors']] },
      { key: 'retry', label: 'Retry failed step', type: 'checkbox' },
    ],
  },
  {
    key: 'csv_import',
    category: 'Data / Integrations',
    label: 'CSV Import',
    description: 'Reads rows from an imported CSV workflow source.',
    icon: Upload,
    tone: 'teal',
    defaults: { mapping: 'caption, link, media_url, scheduled_at', skip_duplicates: true },
    fields: [
      { key: 'mapping', label: 'Columns', type: 'textarea' },
      { key: 'skip_duplicates', label: 'Skip duplicate rows', type: 'checkbox' },
    ],
  },
  {
    key: 'webhook_notification',
    category: 'Developer Tools',
    label: 'Webhook Notification',
    description: 'Sends a no-secret status webhook after the run.',
    icon: PlugZap,
    tone: 'gray',
    defaults: { url: '', method: 'POST', include_payload: true },
    fields: [
      { key: 'url', label: 'Webhook URL', type: 'text', placeholder: 'https://example.com/webhooks/postflow' },
      { key: 'method', label: 'Method', type: 'select', options: [['POST', 'POST'], ['PUT', 'PUT']] },
      { key: 'include_payload', label: 'Include workflow payload', type: 'checkbox' },
    ],
  },
]

const OLD_KIND_MAP = {
  trigger: 'manual_trigger',
  source: 'rss_feed_trigger',
  ai: 'ai_caption_generator',
  filter: 'filter',
  approval: 'approval_required',
  publish: 'publish_social_account',
  webhook: 'webhook_notification',
}

const NODE_ICON_COMPONENTS = {
  manual_trigger: Play,
  schedule_trigger: Clock3,
  rss_feed_trigger: Rss,
  webhook_trigger: Webhook,
  create_post: FileText,
  platform_variant_generator: Layers3,
  content_library: Database,
  ai_caption_generator: WandSparkles,
  ai_hashtag_generator: Sparkles,
  ai_summarize_article: Bot,
  add_media: ImagePlus,
  platform_media_validator: Eye,
  filter: Filter,
  router: Route,
  delay_wait_until: Timer,
  approval_required: ShieldCheck,
  publish_social_account: Send,
  create_draft: FileText,
  get_post_analytics: BarChart3,
  send_notification: Bell,
  send_failure_alert: CircleAlert,
  csv_import: Upload,
  webhook_notification: PlugZap,
}

const TEMPLATE_DEFINITIONS = [
  {
    key: 'daily_social_post',
    name: 'Daily Social Post',
    description: 'Schedule, draft, validate, publish, notify.',
    nodes: ['schedule_trigger', 'create_post', 'ai_caption_generator', 'platform_media_validator', 'publish_social_account', 'send_notification'],
  },
  {
    key: 'rss_news_auto_poster',
    name: 'RSS News Auto Poster',
    description: 'Feed item to summary, approval, publish.',
    nodes: ['rss_feed_trigger', 'ai_summarize_article', 'ai_hashtag_generator', 'approval_required', 'publish_social_account', 'send_failure_alert'],
  },
  {
    key: 'blog_to_social',
    name: 'Blog to Social',
    description: 'Webhook or feed item to platform variants.',
    nodes: ['webhook_trigger', 'create_post', 'platform_variant_generator', 'router', 'publish_social_account', 'get_post_analytics'],
  },
  {
    key: 'google_sheet_to_social',
    name: 'CSV to Social',
    description: 'Imported rows become approved drafts.',
    nodes: ['manual_trigger', 'csv_import', 'filter', 'create_post', 'approval_required', 'create_draft'],
  },
  {
    key: 'multi_platform_campaign',
    name: 'Multi-platform Campaign',
    description: 'One content source, routed platform posts.',
    nodes: ['manual_trigger', 'content_library', 'platform_variant_generator', 'add_media', 'router', 'publish_social_account'],
  },
  {
    key: 'approval_workflow',
    name: 'Approval Workflow',
    description: 'Draft, review, wait, publish.',
    nodes: ['manual_trigger', 'create_post', 'approval_required', 'delay_wait_until', 'publish_social_account', 'send_notification'],
  },
  {
    key: 'failure_alert',
    name: 'Failure Alert',
    description: 'Publish with retry and alert path.',
    nodes: ['manual_trigger', 'create_post', 'publish_social_account', 'send_failure_alert', 'webhook_notification'],
  },
]

function WorkflowNode({ data, selected }) {
  const tone = NODE_TONES[data?.tone] || NODE_TONES.slate
  const status = data?.status || 'draft'

  return (
    <div
      className={clsx(
        'min-w-[230px] max-w-[270px] rounded-lg border bg-white p-3 shadow-sm transition dark:bg-slate-900',
        tone.node,
        selected && 'ring-2 ring-brand-500/40',
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white" style={{ backgroundColor: tone.handle }} />
      <div className="flex items-start gap-3">
        <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone.icon)}>
          <NodeIcon nodeKey={data?.key} category={data?.category} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-slate-900 dark:text-white">{data?.label || 'Workflow step'}</p>
            <span className={clsx('h-2 w-2 shrink-0 rounded-full', status === 'ready' ? 'bg-emerald-500' : status === 'error' ? 'bg-rose-500' : 'bg-slate-300')} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{data?.description || 'Configure this node.'}</p>
        </div>
      </div>
      {data?.category && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1', tone.badge)}>
            {data.category}
          </span>
          {data?.platform && <AccountIcon platform={data.platform} size="xs" />}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white" style={{ backgroundColor: tone.handle }} />
    </div>
  )
}

export default function AutomationPlayground() {
  return (
    <ReactFlowProvider>
      <AutomationPlaygroundContent />
    </ReactFlowProvider>
  )
}

function AutomationPlaygroundContent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canvasLeft = useWorkspaceCanvasLeft()
  const [automation, setAutomation] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [settings, setSettings] = useState(defaultSettings())
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const definitions = useMemo(() => buildNodeDefinitions(accounts), [accounts])
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || null, [nodes, selectedNodeId])
  const checks = useMemo(() => workflowChecks(nodes, edges, accounts, settings), [accounts, edges, nodes, settings])
  const connectedAccounts = useMemo(() => accounts.filter((account) => isUsableAccount(account)), [accounts])

  useEffect(() => {
    let active = true
    Promise.all([
      api.get(`/automations/${id}`),
      api.get('/social/accounts').catch(() => ({ data: { data: [] } })),
    ])
      .then(([automationResponse, accountsResponse]) => {
        if (!active) return
        const nextAutomation = automationResponse.data.data
        const nextAccounts = Array.isArray(accountsResponse.data.data) ? accountsResponse.data.data : []
        const config = nextAutomation.config || {}
        const nextSettings = settingsFromAutomation(nextAutomation)
        const workflow = normalizeWorkflow(config.workflow, nextAutomation, nextAccounts)
        setAutomation(nextAutomation)
        setAccounts(nextAccounts)
        setSettings(nextSettings)
        setNodes(workflow.nodes)
        setEdges(workflow.edges)
        setSelectedNodeId(workflow.nodes[0]?.id || null)
      })
      .catch(() => {
        if (!active) return
        setAutomation(null)
        setAccounts([])
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, setEdges, setNodes])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(null), 2600)
    return () => window.clearTimeout(timer)
  }, [message])

  const notify = (type, text) => setMessage({ type, text })

  const onConnect = useCallback((connection) => {
    setEdges((current) => addEdge({ ...connection, type: 'smoothstep', animated: true }, current))
  }, [setEdges])

  const addNodeFromDefinition = (definition) => {
    const nextNode = createNode(definition, nodes.length, {
      position: nextNodePosition(nodes, definition.category),
    })
    setNodes((current) => [...current, nextNode])
    if (selectedNodeId) {
      setEdges((current) => addEdge({ id: `${selectedNodeId}-${nextNode.id}`, source: selectedNodeId, target: nextNode.id, type: 'smoothstep', animated: true }, current))
    }
    setSelectedNodeId(nextNode.id)
  }

  const applyTemplate = (template) => {
    const workflow = buildTemplateWorkflow(template, definitions, accounts)
    setNodes(workflow.nodes)
    setEdges(workflow.edges)
    setSelectedNodeId(workflow.nodes[0]?.id || null)
    setSettings((current) => ({
      ...current,
      category: template.name,
      requires_approval: workflow.nodes.some((node) => node.data.key === 'approval_required'),
      use_ai: workflow.nodes.some((node) => node.data.category === 'AI Tools'),
    }))
    notify('success', 'Template applied. Save workflow to keep it.')
  }

  const updateNodeConfig = (nodeId, key, value) => {
    setNodes((current) => current.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, status: 'draft', config: { ...(node.data.config || {}), [key]: value } } }
        : node
    )))
  }

  const renameNode = (nodeId, value) => {
    setNodes((current) => current.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...node.data, label: cleanString(value, 80), status: 'draft' } }
        : node
    )))
  }

  const duplicateSelectedNode = () => {
    if (!selectedNode) return
    const duplicate = {
      ...selectedNode,
      id: `${selectedNode.data.key}-${Date.now()}`,
      position: { x: selectedNode.position.x + 60, y: selectedNode.position.y + 60 },
      selected: false,
      data: {
        ...selectedNode.data,
        label: `${selectedNode.data.label} copy`,
        status: 'draft',
      },
    }
    setNodes((current) => [...current, duplicate])
    setSelectedNodeId(duplicate.id)
  }

  const deleteSelectedNode = () => {
    if (!selectedNode) return
    const nodeId = selectedNode.id
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNodeId(null)
  }

  const testSelectedNode = () => {
    if (!selectedNode) return
    const definition = definitionForNode(selectedNode, definitions)
    const errors = missingRequiredFields(definition, selectedNode, accounts)
    setNodes((current) => current.map((node) => (
      node.id === selectedNode.id
        ? { ...node, data: { ...node.data, status: errors.length ? 'error' : 'ready' } }
        : node
    )))
    notify(errors.length ? 'error' : 'success', errors.length ? errors[0] : 'Node test passed.')
  }

  const autoLayout = () => {
    const ordered = [...nodes].sort((a, b) => workflowOrder(a.data.category) - workflowOrder(b.data.category))
    const counts = {}
    setNodes(ordered.map((node) => {
      const column = workflowOrder(node.data.category)
      counts[column] = (counts[column] || 0) + 1
      return {
        ...node,
        position: {
          x: 80 + Math.min(column, 6) * 310,
          y: 80 + (counts[column] - 1) * 150,
        },
      }
    }))
  }

  const saveWorkflow = async () => {
    if (!automation) return
    setSaving(true)
    try {
      const sanitizedNodes = sanitizeNodes(nodes)
      const sanitizedEdges = sanitizeEdges(edges, sanitizedNodes)
      const socialAccountIds = collectAccountIds(sanitizedNodes, settings)
      const feedUrls = collectFeedUrls(sanitizedNodes, settings)
      const payload = {
        name: settings.name,
        description: settings.description,
        is_active: settings.is_active,
        requires_approval: settings.requires_approval || sanitizedNodes.some((node) => node.data.key === 'approval_required'),
        use_ai: settings.use_ai || sanitizedNodes.some((node) => node.data.category === 'AI Tools'),
        social_account_ids: socialAccountIds,
        feed_urls: feedUrls,
        config: {
          ...(automation.config || {}),
          description: settings.description,
          builder_version: BUILDER_VERSION,
          category: settings.category,
          interval_minutes: Number(settings.interval_minutes) || 30,
          safety: settings.safety,
          workflow: {
            nodes: sanitizedNodes,
            edges: sanitizedEdges,
          },
        },
      }
      const { data } = await api.put(`/automations/${automation.id}`, payload)
      setAutomation(data.data)
      setSettings(settingsFromAutomation(data.data))
      setNodes(sanitizedNodes)
      setEdges(sanitizedEdges)
      notify('success', 'Workflow saved.')
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not save workflow.')
    } finally {
      setSaving(false)
    }
  }

  const runWorkflow = async () => {
    if (!automation) return
    setRunning(true)
    try {
      await api.post(`/automations/${automation.id}/run`)
      notify('success', 'Automation run queued.')
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not queue automation.')
    } finally {
      setRunning(false)
    }
  }

  const exportWorkflow = () => {
    const payload = {
      format: 'postflow.workflow.v1',
      exported_at: new Date().toISOString(),
      automation: {
        id: automation?.id,
        name: settings.name,
        description: settings.description,
        category: settings.category,
        requires_approval: settings.requires_approval,
        use_ai: settings.use_ai,
        workflow: {
          nodes: sanitizeNodes(nodes),
          edges: sanitizeEdges(edges, sanitizeNodes(nodes)),
        },
      },
    }
    downloadJson(payload, `${slugify(settings.name || 'automation')}-workflow.json`)
  }

  if (loading) return <PageLoader />

  if (!automation) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <p className="font-semibold">Automation not found.</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/app/automations')}>Back to automations</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 right-0 top-16 z-10 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white" style={{ left: canvasLeft }}>
      <div className="grid h-full min-w-0 grid-cols-[320px_minmax(0,1fr)_390px] overflow-hidden">
        <NodePalette
          accounts={accounts}
          category={category}
          definitions={definitions}
          onAddNode={addNodeFromDefinition}
          onApplyTemplate={applyTemplate}
          search={search}
          setCategory={setCategory}
          setSearch={setSearch}
          templates={TEMPLATE_DEFINITIONS}
        />

        <main className="relative min-w-0 border-x border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <BuilderToolbar
            automation={automation}
            checks={checks}
            connectedAccounts={connectedAccounts}
            edgeCount={edges.length}
            nodeCount={nodes.length}
            onAutoLayout={autoLayout}
            onExport={exportWorkflow}
            onRun={runWorkflow}
            onSave={saveWorkflow}
            running={running}
            saving={saving}
            settings={settings}
          />

          {message && (
            <div className={clsx(
              'absolute left-4 top-20 z-20 rounded-lg border px-4 py-2 text-sm font-semibold shadow-lg',
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950 dark:text-rose-300',
            )}>
              {message.text}
            </div>
          )}

          <ReactFlow
            className="pt-[4.75rem]"
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
          >
            <Background color="#94a3b8" gap={18} size={1} />
            <MiniMap pannable zoomable nodeStrokeWidth={3} className="!rounded-lg !border !border-slate-200 !bg-white dark:!border-slate-800 dark:!bg-slate-900" />
            <Controls className="!rounded-lg !border !border-slate-200 !bg-white !shadow-sm dark:!border-slate-800 dark:!bg-slate-900" />
          </ReactFlow>
        </main>

        <InspectorPanel
          accounts={accounts}
          checks={checks}
          definitions={definitions}
          edges={edges}
          onDeleteNode={deleteSelectedNode}
          onDuplicateNode={duplicateSelectedNode}
          onRenameNode={renameNode}
          onSettingsChange={setSettings}
          onTestNode={testSelectedNode}
          onUpdateNodeConfig={updateNodeConfig}
          selectedNode={selectedNode}
          settings={settings}
        />
      </div>
    </div>
  )
}

function NodePalette({ accounts, category, definitions, onAddNode, onApplyTemplate, search, setCategory, setSearch, templates }) {
  const activeAccounts = accounts.filter(isUsableAccount)
  const query = search.trim().toLowerCase()
  const visibleDefinitions = definitions.filter((definition) => {
    if (category !== 'all' && definition.category !== category) return false
    if (!query) return true
    return [definition.label, definition.description, definition.category, definition.platformLabel].filter(Boolean).join(' ').toLowerCase().includes(query)
  })

  const grouped = CATEGORY_ORDER.map((group) => ({
    group,
    nodes: visibleDefinitions.filter((definition) => definition.category === group),
  })).filter((item) => item.nodes.length)

  return (
    <aside className="flex min-h-0 flex-col bg-slate-100/80 dark:bg-slate-950">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/app/automations" className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white" aria-label="Back to automations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-950 dark:text-white">Social workflow</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeAccounts.length} connected publish targets</p>
          </div>
        </div>

        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search nodes"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear node search">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <CategoryChip active={category === 'all'} label="All" onClick={() => setCategory('all')} />
          {CATEGORY_ORDER.map((item) => (
            <CategoryChip key={item} active={category === item} label={shortCategoryLabel(item)} onClick={() => setCategory(item)} />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No matching nodes.
          </div>
        ) : grouped.map(({ group, nodes }) => {
          const Icon = CATEGORY_ICONS[group] || Workflow
          return (
            <section key={group} className="mb-4">
              <div className="mb-2 flex items-center gap-2 px-1">
                <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group}</h2>
              </div>
              <div className="space-y-2">
                {nodes.map((definition) => (
                  <PaletteNodeButton key={definition.key} definition={definition} onClick={() => onAddNode(definition)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <TemplateRail templates={templates} onApplyTemplate={onApplyTemplate} />
    </aside>
  )
}

function CategoryChip({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition',
        active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
    >
      {label}
    </button>
  )
}

function PaletteNodeButton({ definition, onClick }) {
  const tone = NODE_TONES[definition.tone] || NODE_TONES.slate
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <div className="flex gap-3">
        <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone.icon)}>
          {definition.platform ? <AccountIcon platform={definition.platform} size="xs" /> : <NodeIcon nodeKey={definition.key} category={definition.category} className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{definition.label}</span>
          <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{definition.description}</span>
        </span>
        <Plus className="mt-1 h-4 w-4 text-slate-300 transition group-hover:text-brand-500" />
      </div>
    </button>
  )
}

function TemplateRail({ templates, onApplyTemplate }) {
  return (
    <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center gap-2 px-1">
        <FileJson className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Templates</h2>
      </div>
      <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">
        {templates.map((template) => (
          <button
            key={template.key}
            type="button"
            onClick={() => onApplyTemplate(template)}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-brand-700 dark:hover:bg-slate-900"
          >
            <span className="block text-sm font-bold text-slate-900 dark:text-white">{template.name}</span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BuilderToolbar({ automation, checks, connectedAccounts, edgeCount, nodeCount, onAutoLayout, onExport, onRun, onSave, running, saving, settings }) {
  const readyCount = checks.filter((check) => check.ok).length
  return (
    <div className="absolute left-0 right-0 top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Workflow className="h-5 w-5 shrink-0 text-brand-500" />
            <h2 className="truncate text-lg font-bold text-slate-950 dark:text-white">{settings.name || automation.name}</h2>
            <Badge color={settings.is_active ? 'emerald' : 'gray'}>{settings.is_active ? 'Active' : 'Paused'}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{nodeCount} nodes</span>
            <span>{edgeCount} links</span>
            <span>{connectedAccounts.length} accounts</span>
            <span>{readyCount}/{checks.length} readiness checks</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Auto layout" onClick={onAutoLayout} icon={RefreshCw} />
          <IconButton label="Export JSON" onClick={onExport} icon={Download} />
          <Button type="button" variant="secondary" onClick={onRun} loading={running}><Play className="h-4 w-4" /> Run now</Button>
          <Button type="button" onClick={onSave} loading={saving}><Save className="h-4 w-4" /> Save workflow</Button>
        </div>
      </div>
    </div>
  )
}

function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function InspectorPanel({
  accounts,
  checks,
  definitions,
  edges,
  onDeleteNode,
  onDuplicateNode,
  onRenameNode,
  onSettingsChange,
  onTestNode,
  onUpdateNodeConfig,
  selectedNode,
  settings,
}) {
  return (
    <aside className="flex min-h-0 flex-col bg-slate-100/80 dark:bg-slate-950">
      {selectedNode ? (
        <SelectedNodeInspector
          accounts={accounts}
          definition={definitionForNode(selectedNode, definitions)}
          edges={edges}
          node={selectedNode}
          onDelete={onDeleteNode}
          onDuplicate={onDuplicateNode}
          onRename={onRenameNode}
          onTest={onTestNode}
          onUpdate={onUpdateNodeConfig}
        />
      ) : (
        <WorkflowInspector checks={checks} onSettingsChange={onSettingsChange} settings={settings} />
      )}
    </aside>
  )
}

function SelectedNodeInspector({ accounts, definition, edges, node, onDelete, onDuplicate, onRename, onTest, onUpdate }) {
  const incoming = edges.filter((edge) => edge.target === node.id).length
  const outgoing = edges.filter((edge) => edge.source === node.id).length
  const errors = missingRequiredFields(definition, node, accounts)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Node settings</p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-950 dark:text-white">{node.data.label}</h2>
          </div>
          <StatusPill status={node.data.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{incoming} in</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{outgoing} out</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{node.data.category}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <Input label="Node name" value={node.data.label || ''} onChange={(event) => onRename(node.id, event.target.value)} />

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Configuration</h3>
          </div>
          {(definition.fields || []).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">This node has no required settings.</p>
          ) : (
            definition.fields.map((field) => (
              <FieldRenderer
                key={field.key}
                accounts={accounts}
                field={field}
                node={node}
                onChange={(value) => onUpdate(node.id, field.key, value)}
              />
            ))
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Output preview</h3>
          </div>
          <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
            {JSON.stringify(previewNodeOutput(node), null, 2)}
          </pre>
        </section>

        {errors.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{errors[0]}</p>
            </div>
          </section>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <Button type="button" variant="secondary" size="sm" onClick={onTest}><Check className="h-4 w-4" /> Test</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDuplicate}><Copy className="h-4 w-4" /> Copy</Button>
        <Button type="button" variant="danger" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4" /> Delete</Button>
      </div>
    </div>
  )
}

function WorkflowInspector({ checks, onSettingsChange, settings }) {
  const update = (key, value) => onSettingsChange((current) => ({ ...current, [key]: value }))
  const updateSafety = (key, value) => onSettingsChange((current) => ({ ...current, safety: { ...(current.safety || {}), [key]: value } }))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workflow settings</p>
        <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Automation controls</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Details</h3>
          </div>
          <Input label="Automation name" value={settings.name} onChange={(event) => update('name', event.target.value)} />
          <Textarea label="Description" rows={3} value={settings.description} onChange={(event) => update('description', event.target.value)} />
          <Input label="Category" value={settings.category} onChange={(event) => update('category', event.target.value)} />
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Active</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Workflow can run on schedule or manually.</span>
            </span>
            <input type="checkbox" checked={settings.is_active} onChange={(event) => update('is_active', event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">
              <input type="checkbox" checked={settings.use_ai} onChange={(event) => update('use_ai', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Use AI
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">
              <input type="checkbox" checked={settings.requires_approval} onChange={(event) => update('requires_approval', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Approval
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Safety</h3>
          </div>
          {[
            ['duplicate_detection', 'Duplicate detection'],
            ['platform_rules', 'Platform rules'],
            ['token_warning', 'Token warning'],
            ['rate_limit_guard', 'Rate limit guard'],
            ['failure_alert', 'Failure alert'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              {label}
              <input type="checkbox" checked={Boolean(settings.safety?.[key])} onChange={(event) => updateSafety(key, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            </label>
          ))}
        </section>

        <ReadinessPanel checks={checks} />
      </div>
    </div>
  )
}

function FieldRenderer({ accounts, field, node, onChange }) {
  const value = node.data.config?.[field.key]

  if (field.type === 'textarea') {
    return <Textarea label={field.label} rows={4} value={value || ''} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
  }

  if (field.type === 'number') {
    return <Input label={field.label} type="number" min={field.min} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />
  }

  if (field.type === 'time') {
    return <Input label={field.label} type="time" value={value || ''} onChange={(event) => onChange(event.target.value)} />
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</span>
        <select value={value ?? field.options?.[0]?.[0] ?? ''} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          {(field.options || []).map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
        </select>
      </label>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
        {field.label}
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
      </label>
    )
  }

  if (field.type === 'accountMulti') {
    return (
      <AccountPicker
        accounts={accounts}
        label={field.label}
        multiple
        platform={node.data.platform}
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    )
  }

  if (field.type === 'accountSingle' || field.type === 'platformAccountSingle') {
    return (
      <AccountPicker
        accounts={accounts}
        label={field.label}
        multiple={false}
        platform={field.type === 'platformAccountSingle' ? node.data.platform : null}
        value={value || ''}
        onChange={onChange}
      />
    )
  }

  return <Input label={field.label} value={value || ''} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
}

function AccountPicker({ accounts, label, multiple, onChange, platform, value }) {
  const usable = accounts.filter((account) => isUsableAccount(account) && (!platform || account.platform === platform))
  const selected = multiple ? value.map(Number) : [Number(value)].filter(Boolean)

  const toggle = (accountId) => {
    if (!multiple) {
      onChange(accountId)
      return
    }
    onChange(selected.includes(accountId) ? selected.filter((id) => id !== accountId) : [...selected, accountId])
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {usable.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No connected {platform ? platformLabel(platform) : 'social'} accounts.
        </div>
      ) : (
        <div className="space-y-2">
          {usable.map((account) => {
            const active = selected.includes(Number(account.id))
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => toggle(Number(account.id))}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition',
                  active ? 'border-brand-400 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
                )}
              >
                <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{account.name || account.platform_label}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{account.username || platformLabel(account.platform)}</span>
                </span>
                <span className={clsx('flex h-5 w-5 items-center justify-center rounded border', active ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-300 text-transparent dark:border-slate-600')}>
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReadinessPanel({ checks }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Readiness</h3>
      </div>
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.key} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <span className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', check.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300')}>
              {check.ok ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{check.label}</span>
              <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">{check.message}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function StatusPill({ status }) {
  const label = status === 'ready' ? 'Ready' : status === 'error' ? 'Needs fix' : 'Draft'
  const color = status === 'ready' ? 'emerald' : status === 'error' ? 'rose' : 'gray'
  return <Badge color={color}>{label}</Badge>
}

function NodeIcon({ category, className, nodeKey }) {
  const Icon = String(nodeKey || '').startsWith('publish_')
    ? Send
    : (NODE_ICON_COMPONENTS[nodeKey] || CATEGORY_ICONS[category] || Workflow)
  return <Icon className={className} />
}

function buildNodeDefinitions(accounts) {
  const generic = BASE_NODE_DEFINITIONS.map((definition) => ({ ...definition, fields: definition.fields || [], defaults: definition.defaults || {} }))
  const platformNodes = PUBLISH_PLATFORMS.flatMap(([platform, label, action]) => {
    const platformAccounts = accounts.filter((account) => isUsableAccount(account) && account.platform === platform)
    if (!platformAccounts.length) return []
    return [{
      key: `publish_${platform}`,
      category: 'Social Publishing',
      label,
      platformLabel: label,
      description: `${action} using connected ${label} accounts.`,
      icon: Send,
      tone: 'indigo',
      platform,
      defaults: { account_id: platformAccounts[0]?.id || '', publish_mode: 'schedule_or_now', post_type: 'auto', caption_field: '{{caption}}' },
      fields: [
        { key: 'account_id', label: 'Account', type: 'platformAccountSingle', required: true },
        { key: 'publish_mode', label: 'Publish mode', type: 'select', options: [['schedule_or_now', 'Schedule or publish now'], ['draft', 'Create draft'], ['publish_now', 'Publish now']] },
        { key: 'post_type', label: 'Post type', type: 'select', options: platformPostTypeOptions(platform) },
        { key: 'caption_field', label: 'Caption field', type: 'text' },
      ],
    }]
  })
  return [...generic, ...platformNodes]
}

function createNode(definition, index, overrides = {}) {
  const id = overrides.id || `${definition.key}-${Date.now()}-${index}`
  return {
    id,
    type: 'workflowNode',
    position: overrides.position || { x: 80 + index * 90, y: 80 + index * 40 },
    data: {
      key: definition.key,
      category: definition.category,
      label: overrides.label || definition.label,
      description: definition.description,
      tone: definition.tone || CATEGORY_TONES[definition.category] || 'slate',
      platform: definition.platform || null,
      config: { ...(definition.defaults || {}), ...(overrides.config || {}) },
      status: overrides.status || 'draft',
    },
  }
}

function buildTemplateWorkflow(template, definitions, accounts) {
  const nodes = template.nodes.map((key, index) => {
    const definition = definitions.find((item) => item.key === key) || definitions.find((item) => item.key === 'manual_trigger')
    const config = {}
    if (key === 'publish_social_account') config.account_ids = accounts.filter(isUsableAccount).slice(0, 3).map((account) => account.id)
    if (key === 'rss_feed_trigger') config.feed_urls = ''
    return createNode(definition, index, {
      id: `${template.key}-${key}-${index + 1}`,
      position: { x: 80 + index * 280, y: 120 + (index % 2) * 110 },
      config,
    })
  })
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `${node.id}-${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id,
    type: 'smoothstep',
    animated: true,
  }))
  return { nodes, edges }
}

function normalizeWorkflow(workflow, automation, accounts) {
  const definitions = buildNodeDefinitions(accounts)
  if (workflow?.nodes?.length) {
    const nodes = workflow.nodes.slice(0, 100).map((node, index) => normalizeNode(node, index, definitions)).filter(Boolean)
    const nodeIds = new Set(nodes.map((node) => node.id))
    const edges = Array.isArray(workflow.edges)
      ? workflow.edges.slice(0, 200).filter((edge) => edge?.source && edge?.target && nodeIds.has(edge.source) && nodeIds.has(edge.target)).map((edge) => ({
        id: cleanString(edge.id || `${edge.source}-${edge.target}`, 120),
        source: cleanString(edge.source, 100),
        target: cleanString(edge.target, 100),
        type: 'smoothstep',
        animated: edge.animated !== false,
      }))
      : []
    return { nodes, edges }
  }

  const baseTemplate = automation?.type === 'rss_feed' ? TEMPLATE_DEFINITIONS[1] : TEMPLATE_DEFINITIONS[0]
  return buildTemplateWorkflow(baseTemplate, definitions, accounts)
}

function normalizeNode(node, index, definitions) {
  if (!node || typeof node !== 'object') return null
  const oldKind = node.data?.kind
  const key = cleanString(node.data?.key || OLD_KIND_MAP[oldKind] || 'create_post', 80)
  const definition = definitions.find((item) => item.key === key) || BASE_NODE_DEFINITIONS.find((item) => item.key === key) || BASE_NODE_DEFINITIONS.find((item) => item.key === 'create_post')
  return {
    id: cleanString(node.id || `${key}-${index + 1}`, 100),
    type: 'workflowNode',
    position: {
      x: safeNumber(node.position?.x, 80 + index * 280),
      y: safeNumber(node.position?.y, 80),
    },
    data: {
      key: definition.key,
      category: definition.category,
      label: cleanString(node.data?.label || definition.label, 80),
      description: cleanString(node.data?.description || definition.description, 240),
      tone: cleanString(node.data?.tone || definition.tone || CATEGORY_TONES[definition.category] || 'slate', 20),
      platform: definition.platform || node.data?.platform || null,
      config: { ...(definition.defaults || {}), ...(node.data?.config || node.data?.settings || {}) },
      status: ['draft', 'ready', 'error'].includes(node.data?.status) ? node.data.status : 'draft',
    },
  }
}

function sanitizeNodes(nodes) {
  return nodes.slice(0, 100).map((node, index) => ({
    id: cleanString(node.id || `node-${index + 1}`, 100),
    type: 'workflowNode',
    position: {
      x: safeNumber(node.position?.x, 80),
      y: safeNumber(node.position?.y, 80),
    },
    data: {
      key: cleanString(node.data?.key || 'create_post', 80),
      category: cleanString(node.data?.category || 'Content', 60),
      label: cleanString(node.data?.label || 'Workflow step', 80),
      description: cleanString(node.data?.description || '', 240),
      tone: cleanString(node.data?.tone || 'slate', 20),
      platform: node.data?.platform ? cleanString(node.data.platform, 60) : null,
      config: sanitizeConfig(node.data?.config || {}),
      status: ['draft', 'ready', 'error'].includes(node.data?.status) ? node.data.status : 'draft',
    },
  }))
}

function sanitizeEdges(edges, nodes) {
  const ids = new Set(nodes.map((node) => node.id))
  return edges.slice(0, 200).filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({
    id: cleanString(edge.id || `${edge.source}-${edge.target}`, 140),
    source: cleanString(edge.source, 100),
    target: cleanString(edge.target, 100),
    type: 'smoothstep',
    animated: edge.animated !== false,
  }))
}

function sanitizeConfig(value) {
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitizeConfig)
  if (!value || typeof value !== 'object') return typeof value === 'string' ? cleanString(value, 2000) : value
  const blocked = /token|secret|password|credential|authorization|bearer|api[_-]?key|private/i
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !blocked.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key))
    .map(([key, item]) => [cleanString(key, 80), sanitizeConfig(item)]))
}

function settingsFromAutomation(automation) {
  const config = automation?.config || {}
  return {
    name: automation?.name || 'Untitled automation',
    description: automation?.description || config.description || '',
    category: config.category || automation?.type_label || 'Social publishing',
    is_active: Boolean(automation?.is_active),
    requires_approval: Boolean(automation?.requires_approval),
    use_ai: Boolean(automation?.use_ai),
    interval_minutes: config.interval_minutes || 30,
    selected_account_ids: Array.isArray(automation?.social_account_ids) ? automation.social_account_ids : [],
    safety: {
      duplicate_detection: config.safety?.duplicate_detection ?? true,
      platform_rules: config.safety?.platform_rules ?? true,
      token_warning: config.safety?.token_warning ?? true,
      rate_limit_guard: config.safety?.rate_limit_guard ?? true,
      failure_alert: config.safety?.failure_alert ?? true,
    },
  }
}

function defaultSettings() {
  return settingsFromAutomation({})
}

function workflowChecks(nodes, edges, accounts, settings) {
  const usableAccounts = accounts.filter(isUsableAccount)
  const hasTrigger = nodes.some((node) => node.data.category === 'Triggers')
  const hasPublish = nodes.some((node) => node.data.category === 'Social Publishing' && ['publish_social_account', 'create_draft'].includes(basePublishKey(node.data.key)))
  const selectedAccountIds = collectAccountIds(sanitizeNodes(nodes), settings)
  const hasPublishAccount = selectedAccountIds.length > 0 || nodes.some((node) => node.data.key === 'create_draft')
  const needsToken = usableAccounts.some((account) => account.needs_reconnect || account.is_expired || account.status === 'error')
  return [
    { key: 'trigger', label: 'Trigger', ok: hasTrigger, message: hasTrigger ? 'Workflow has a starting trigger.' : 'Add a manual, schedule, RSS, or webhook trigger.' },
    { key: 'flow', label: 'Connected flow', ok: nodes.length <= 1 || edges.length > 0, message: edges.length > 0 ? 'Nodes are linked on the canvas.' : 'Connect at least one node pair.' },
    { key: 'account', label: 'Connected accounts', ok: usableAccounts.length > 0, message: usableAccounts.length ? `${usableAccounts.length} usable social accounts available.` : 'Connect at least one social account before publishing.' },
    { key: 'publish', label: 'Publish target', ok: hasPublish && hasPublishAccount, message: hasPublishAccount ? 'Publishing is configured.' : 'Choose a publish account or draft output.' },
    { key: 'approval', label: 'Approval safety', ok: settings.requires_approval || nodes.some((node) => node.data.key === 'approval_required'), message: settings.requires_approval ? 'Approval is enabled.' : 'Add approval for unattended publishing.' },
    { key: 'platform_rules', label: 'Platform rules', ok: settings.safety?.platform_rules || nodes.some((node) => node.data.key === 'platform_media_validator'), message: settings.safety?.platform_rules ? 'Platform guardrails are enabled.' : 'Enable platform rules or add a media validator.' },
    { key: 'failure_alert', label: 'Failure alert', ok: settings.safety?.failure_alert || nodes.some((node) => node.data.key === 'send_failure_alert'), message: settings.safety?.failure_alert ? 'Failures will notify the team.' : 'Add a failure alert for retries and visibility.' },
    { key: 'tokens', label: 'Token health', ok: !needsToken, message: needsToken ? 'One or more accounts need reconnect.' : 'No account token warnings detected.' },
  ]
}

function definitionForNode(node, definitions) {
  return definitions.find((definition) => definition.key === node.data?.key) || {
    key: node.data?.key,
    label: node.data?.label,
    category: node.data?.category,
    description: node.data?.description,
    tone: node.data?.tone,
    fields: [],
    defaults: {},
  }
}

function missingRequiredFields(definition, node, accounts) {
  const errors = []
  for (const field of definition.fields || []) {
    if (!field.required) continue
    const value = node.data.config?.[field.key]
    if (field.type === 'accountMulti' && (!Array.isArray(value) || value.length === 0)) errors.push(`Select at least one account for ${definition.label}.`)
    else if (!value) errors.push(`${field.label} is required.`)
  }
  if (definition.platform && !accounts.some((account) => isUsableAccount(account) && account.platform === definition.platform)) {
    errors.push(`Connect a ${platformLabel(definition.platform)} account first.`)
  }
  return errors
}

function collectAccountIds(nodes, settings) {
  const ids = new Set((settings.selected_account_ids || []).map(Number).filter(Boolean))
  nodes.forEach((node) => {
    const config = node.data?.config || {}
    if (Array.isArray(config.account_ids)) config.account_ids.forEach((id) => ids.add(Number(id)))
    if (config.account_id) ids.add(Number(config.account_id))
  })
  return Array.from(ids).filter(Boolean)
}

function collectFeedUrls(nodes) {
  const urls = new Set()
  nodes.forEach((node) => {
    const raw = node.data?.config?.feed_urls
    splitUrls(raw).forEach((url) => urls.add(url))
  })
  return Array.from(urls)
}

function splitUrls(value) {
  if (Array.isArray(value)) return value.filter(isSafeUrl)
  return String(value || '')
    .split(/\s|,|\n/)
    .map((item) => item.trim())
    .filter(isSafeUrl)
}

function previewNodeOutput(node) {
  const config = node.data.config || {}
  return {
    node: node.data.key,
    output: {
      caption: config.caption || config.caption_field || '{{caption}}',
      media: config.media_url || '{{media.url}}',
      accounts: config.account_ids || config.account_id || [],
      status: node.data.status || 'draft',
    },
  }
}

function basePublishKey(key) {
  if (String(key || '').startsWith('publish_')) return 'publish_social_account'
  return key
}

function platformPostTypeOptions(platform) {
  const videoOptions = [['auto', 'Auto'], ['video', 'Video'], ['short', 'Short'], ['draft', 'Draft']]
  const imageOptions = [['auto', 'Auto'], ['image', 'Image'], ['carousel', 'Carousel'], ['story', 'Story']]
  if (['tiktok', 'youtube', 'snapchat'].includes(platform)) return videoOptions
  if (['instagram', 'pinterest'].includes(platform)) return imageOptions
  if (platform === 'reddit') return [['auto', 'Auto'], ['text', 'Text'], ['link', 'Link'], ['image', 'Image']]
  if (platform === 'google_business') return [['auto', 'Auto'], ['update', 'Update'], ['event', 'Event'], ['offer', 'Offer']]
  return [['auto', 'Auto'], ['text', 'Text'], ['image', 'Image'], ['video', 'Video']]
}

function isUsableAccount(account) {
  return Boolean(account && account.status === 'active' && !account.needs_reconnect && !account.is_expired)
}

function platformLabel(platform) {
  return PLATFORMS[platform]?.label || platform || 'Social account'
}

function shortCategoryLabel(category) {
  return category.replace('Social ', '').replace('Data / ', '').replace('Developer ', 'Dev ')
}

function nextNodePosition(nodes, category) {
  const column = workflowOrder(category)
  const sameColumn = nodes.filter((node) => workflowOrder(node.data?.category) === column).length
  return {
    x: 80 + Math.min(column, 6) * 310,
    y: 90 + sameColumn * 150,
  }
}

function workflowOrder(category) {
  const index = CATEGORY_ORDER.indexOf(category)
  return index === -1 ? 2 : index
}

function safeNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(-5000, Math.min(5000, number)) : fallback
}

function cleanString(value, maxLength) {
  const text = String(value || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/javascript:/gi, '').replace(/\bon\w+=/gi, '').trim()
  if (/eval\s*\(|new\s+Function\s*\(|document\.cookie|localStorage|sessionStorage/i.test(text)) return ''
  return text.slice(0, maxLength)
}

function isSafeUrl(url) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

function slugify(value) {
  return String(value || 'automation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'automation'
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function useWorkspaceCanvasLeft() {
  const [left, setLeft] = useState(() => workspaceCanvasLeft())
  useEffect(() => {
    const sync = () => setLeft(workspaceCanvasLeft())
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('postflow:sidebar-toggled', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('postflow:sidebar-toggled', sync)
    }
  }, [])
  return left
}

function workspaceCanvasLeft() {
  if (typeof window === 'undefined') return '0px'
  const desktop = window.matchMedia('(min-width: 1024px)').matches
  if (!desktop) return '0px'
  return localStorage.getItem('postflow_sidebar_hidden') === 'true' ? '0px' : '16rem'
}
