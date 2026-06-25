import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Braces,
  Building2,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  Info,
  MessageCircle,
  Palette,
  Plus,
  Rss,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  Webhook,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, Modal, ModalLoading } from '../components/ui'

const INTEGRATIONS = [
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'Data',
    icon: 'googlesheets',
    color: '34A853',
    company: 'Google',
    version: 'v2.8.1',
    lastUpdated: 'June 10, 2026',
    rating: 4.8,
    installs: '24k workspaces',
    setupTime: '3 min',
    preview: 'Import content calendars, campaign rows, and reporting tables directly into the workspace planner.',
    description: 'Sync selected spreadsheets with posts, campaigns, and content approval queues. Teams can map columns once and reuse the integration across recurring planning cycles.',
    permissions: ['Read selected spreadsheet rows', 'Create draft posts', 'Export analytics tables'],
    features: ['Column mapping presets', 'Scheduled imports', 'Two-way status sync'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Storage',
    icon: 'googledrive',
    color: '4285F4',
    company: 'Google',
    version: 'v3.1.0',
    lastUpdated: 'June 7, 2026',
    rating: 4.7,
    installs: '18k workspaces',
    setupTime: '4 min',
    preview: 'Attach approved campaign assets from shared folders without downloading and reuploading files.',
    description: 'Connect Drive folders to the media library so workspace members can browse, attach, and organize assets by campaign.',
    permissions: ['Read selected Drive folders', 'Import media metadata', 'Create workspace asset links'],
    features: ['Folder allowlists', 'Asset previews', 'Duplicate detection'],
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Data',
    icon: 'airtable',
    color: '18BFFF',
    company: 'Airtable',
    version: 'v1.9.4',
    lastUpdated: 'May 31, 2026',
    rating: 4.6,
    installs: '11k workspaces',
    setupTime: '5 min',
    preview: 'Turn Airtable bases into campaign intake forms, content pipelines, and reusable publishing queues.',
    description: 'Map Airtable tables to planner fields, media references, owner assignments, and approval states for a workspace.',
    permissions: ['Read selected bases', 'Sync record updates', 'Create draft tasks'],
    features: ['Base mapping', 'Record change sync', 'Custom field support'],
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Workspace',
    icon: 'notion',
    color: '111827',
    company: 'Notion Labs',
    version: 'v2.2.3',
    lastUpdated: 'May 24, 2026',
    rating: 4.5,
    installs: '16k workspaces',
    setupTime: '4 min',
    preview: 'Bring briefs, campaign pages, and editorial notes into the planner while keeping source pages linked.',
    description: 'Attach Notion pages to planner items and turn database rows into content ideas, briefs, or scheduled posts.',
    permissions: ['Read selected pages', 'Read selected databases', 'Create planner references'],
    features: ['Database imports', 'Brief linking', 'Content idea capture'],
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'Automation',
    icon: 'n8n',
    color: 'EA4B71',
    company: 'n8n GmbH',
    version: 'v1.6.0',
    lastUpdated: 'June 1, 2026',
    rating: 4.7,
    installs: '8.5k workspaces',
    setupTime: '6 min',
    preview: 'Trigger workspace workflows from post events, failed publishes, approvals, or incoming webhooks.',
    description: 'Connect n8n workflows to workspace events and automate handoffs between content, publishing, and reporting tools.',
    permissions: ['Read event payloads', 'Send webhook events', 'Create automation run logs'],
    features: ['Event triggers', 'Signed webhook payloads', 'Run history'],
  },
  {
    id: 'csv',
    name: 'CSV Importer',
    category: 'Import',
    fallback: FileSpreadsheet,
    color: '0F766E',
    company: 'Postflow',
    version: 'v1.4.2',
    lastUpdated: 'May 20, 2026',
    rating: 4.4,
    installs: '31k workspaces',
    setupTime: '1 min',
    preview: 'Upload content calendars, account lists, and campaign exports into the current workspace.',
    description: 'Import structured CSV files into planner drafts, media metadata, or reporting tables with reusable templates.',
    permissions: ['Read uploaded CSV files', 'Create workspace records', 'Validate row formats'],
    features: ['Template matching', 'Validation preview', 'Undo imports'],
  },
  {
    id: 'rss',
    name: 'RSS Feeds',
    category: 'Feeds',
    fallback: Rss,
    color: 'F97316',
    company: 'Postflow',
    version: 'v2.0.7',
    lastUpdated: 'June 5, 2026',
    rating: 4.6,
    installs: '14k workspaces',
    setupTime: '2 min',
    preview: 'Watch trusted feeds and convert new items into drafts, ideas, or automated social posts.',
    description: 'Subscribe a workspace to RSS sources and route new entries into content ideas, automation rules, or scheduled queues.',
    permissions: ['Read feed URLs', 'Create content ideas', 'Run workspace automations'],
    features: ['Feed health checks', 'AI caption handoff', 'Duplicate filtering'],
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    category: 'CMS',
    icon: 'wordpress',
    color: '21759B',
    company: 'Automattic',
    version: 'v2.5.0',
    lastUpdated: 'May 18, 2026',
    rating: 4.5,
    installs: '9.4k workspaces',
    setupTime: '6 min',
    preview: 'Pull posts, pages, and featured images into campaigns so launches stay aligned across channels.',
    description: 'Connect WordPress content to the workspace planner and generate social variants from selected posts or pages.',
    permissions: ['Read selected sites', 'Read posts and media', 'Create campaign drafts'],
    features: ['Post imports', 'Featured image capture', 'Launch campaign templates'],
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    category: 'Developer',
    fallback: Webhook,
    color: '7C3AED',
    company: 'Postflow',
    version: 'v3.3.1',
    lastUpdated: 'June 3, 2026',
    rating: 4.8,
    installs: '12k workspaces',
    setupTime: '3 min',
    preview: 'Send signed workspace events to internal systems, BI tools, CRMs, or custom automation endpoints.',
    description: 'Create workspace webhooks for publish, approval, failure, and account events with delivery logs and signatures.',
    permissions: ['Read selected event payloads', 'Send HTTPS requests', 'Store delivery attempts'],
    features: ['HMAC signatures', 'Retry controls', 'Delivery inspection'],
  },
  {
    id: 'public-api',
    name: 'Public API',
    category: 'Developer',
    fallback: Braces,
    color: '2563EB',
    company: 'Postflow',
    version: 'v1.12.0',
    lastUpdated: 'June 8, 2026',
    rating: 4.7,
    installs: '7.8k workspaces',
    setupTime: '5 min',
    preview: 'Use API keys to create posts, inspect analytics, manage accounts, and sync workspace data.',
    description: 'Enable developer API access for this workspace with scoped keys, rate limits, audit logs, and token rotation.',
    permissions: ['Create scoped API keys', 'Read workspace resources', 'Write permitted records'],
    features: ['Scoped keys', 'Rate limit controls', 'Audit logging'],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'Automation',
    icon: 'zapier',
    color: 'FF4F00',
    company: 'Zapier',
    version: 'v2.7.5',
    lastUpdated: 'May 29, 2026',
    rating: 4.6,
    installs: '21k workspaces',
    setupTime: '5 min',
    preview: 'Connect workspace events with thousands of apps through no-code triggers and actions.',
    description: 'Use Zapier to route content approvals, publish events, and lead signals between the workspace and external tools.',
    permissions: ['Read event payloads', 'Create Zap triggers', 'Write action results'],
    features: ['Prebuilt Zaps', 'Trigger samples', 'Action logs'],
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'Storage',
    icon: 'dropbox',
    color: '0061FF',
    company: 'Dropbox',
    version: 'v1.8.8',
    lastUpdated: 'May 14, 2026',
    rating: 4.4,
    installs: '6.3k workspaces',
    setupTime: '4 min',
    preview: 'Browse approved files from Dropbox folders and attach them to workspace campaigns.',
    description: 'Connect shared Dropbox folders to the media library for asset discovery, previews, and campaign attachment.',
    permissions: ['Read selected folders', 'Import file metadata', 'Create media links'],
    features: ['Folder scoping', 'Preview thumbnails', 'Metadata sync'],
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    category: 'Storage',
    icon: 'microsoftonedrive',
    color: '0078D4',
    company: 'Microsoft',
    version: 'v1.10.1',
    lastUpdated: 'May 27, 2026',
    rating: 4.5,
    installs: '8.9k workspaces',
    setupTime: '5 min',
    preview: 'Connect Microsoft file storage to media workflows for team-approved campaign assets.',
    description: 'Attach files from selected OneDrive folders and keep campaign media organized per workspace.',
    permissions: ['Read selected folders', 'Import file metadata', 'Create media references'],
    features: ['Shared folder support', 'Asset search', 'Preview links'],
  },
  {
    id: 'box',
    name: 'Box',
    category: 'Storage',
    icon: 'box',
    color: '0061D5',
    company: 'Box',
    version: 'v1.5.6',
    lastUpdated: 'May 22, 2026',
    rating: 4.3,
    installs: '4.1k workspaces',
    setupTime: '6 min',
    preview: 'Use enterprise asset folders from Box inside workspace campaign and approval flows.',
    description: 'Connect Box folders to media and planner workflows with controlled workspace-level access.',
    permissions: ['Read selected folders', 'Import file metadata', 'Create media references'],
    features: ['Enterprise folder scoping', 'Metadata previews', 'Approval handoff'],
  },
  {
    id: 'aws-s3',
    name: 'AWS S3',
    category: 'Storage',
    icon: 'amazons3',
    color: '569A31',
    company: 'Amazon Web Services',
    version: 'v2.1.3',
    lastUpdated: 'June 4, 2026',
    rating: 4.5,
    installs: '5.7k workspaces',
    setupTime: '8 min',
    preview: 'Connect a controlled asset bucket for high-volume media libraries and automated publishing flows.',
    description: 'Link S3 buckets to workspace media with prefix scoping, signed previews, and metadata indexing.',
    permissions: ['Read configured bucket prefixes', 'Generate signed asset links', 'Index media metadata'],
    features: ['Prefix scoping', 'Signed previews', 'Bulk indexing'],
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design',
    icon: 'figma',
    color: 'F24E1E',
    company: 'Figma',
    version: 'v1.7.0',
    lastUpdated: 'June 2, 2026',
    rating: 4.6,
    installs: '10k workspaces',
    setupTime: '4 min',
    preview: 'Attach design files, campaign mockups, and approved export frames to planner tasks.',
    description: 'Bring Figma file references into workspace campaigns so creative and publishing teams stay aligned.',
    permissions: ['Read selected files', 'Read frame previews', 'Create planner links'],
    features: ['Frame previews', 'File references', 'Creative handoff'],
  },
  {
    id: 'canva',
    name: 'Canva',
    category: 'Design',
    icon: 'canva',
    color: '00C4CC',
    company: 'Canva',
    version: 'v1.6.9',
    lastUpdated: 'May 16, 2026',
    rating: 4.4,
    installs: '13k workspaces',
    setupTime: '4 min',
    preview: 'Attach Canva designs to scheduled posts and keep campaign creative references nearby.',
    description: 'Connect Canva designs with workspace posts, approvals, and media library entries for cleaner handoff.',
    permissions: ['Read selected designs', 'Read previews', 'Create media references'],
    features: ['Design previews', 'Campaign links', 'Creative approval references'],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Team chat',
    icon: 'slack',
    color: '4A154B',
    company: 'Salesforce',
    version: 'v2.4.8',
    lastUpdated: 'June 6, 2026',
    rating: 4.7,
    installs: '19k workspaces',
    setupTime: '3 min',
    preview: 'Notify channels about approvals, failed posts, publish success, and account health events.',
    description: 'Send workspace notifications into selected Slack channels so teams can review and respond quickly.',
    permissions: ['Post to selected channels', 'Read channel names', 'Send approval alerts'],
    features: ['Channel routing', 'Approval alerts', 'Failure notifications'],
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Team chat',
    icon: 'discord',
    color: '5865F2',
    company: 'Discord',
    version: 'v1.9.2',
    lastUpdated: 'May 30, 2026',
    rating: 4.4,
    installs: '5.2k workspaces',
    setupTime: '3 min',
    preview: 'Send workspace activity into Discord channels for creator, community, and support teams.',
    description: 'Connect Discord channels to publish, approval, and automation events from the active workspace.',
    permissions: ['Post to selected channels', 'Read channel names', 'Send event alerts'],
    features: ['Channel alerts', 'Community updates', 'Event templates'],
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    category: 'Team chat',
    icon: 'microsoftteams',
    color: '6264A7',
    company: 'Microsoft',
    version: 'v2.0.2',
    lastUpdated: 'May 28, 2026',
    rating: 4.5,
    installs: '7.1k workspaces',
    setupTime: '5 min',
    preview: 'Route approvals, planner updates, and publishing alerts into selected Teams channels.',
    description: 'Connect Teams channels to workspace notifications and keep campaign discussions close to delivery events.',
    permissions: ['Post to selected channels', 'Read team names', 'Send approval alerts'],
    features: ['Channel routing', 'Approval summaries', 'Publish alerts'],
  },
]

const FALLBACK_ICONS = {
  Storage: Cloud,
  Design: Palette,
  'Team chat': MessageCircle,
  Import: Upload,
  Feeds: Rss,
  Developer: Braces,
  Automation: Zap,
}

const FILTER_GROUPS = [
  { id: 'Data', label: 'Data', categories: ['Data'] },
  { id: 'Storage', label: 'Storage', categories: ['Storage'] },
  { id: 'Automation', label: 'Automation', categories: ['Automation'] },
  { id: 'Developer', label: 'Developer', categories: ['Developer'] },
  { id: 'Design', label: 'Design', categories: ['Design'] },
  { id: 'Team chat', label: 'Team chat', categories: ['Team chat'] },
  { id: 'other', label: 'Other', categories: ['Workspace', 'Import', 'Feeds', 'CMS'] },
]
const INTEGRATION_IDS = new Set(INTEGRATIONS.map((integration) => integration.id))
const INTEGRATION_FILTER_IDS = new Set(['all', 'installed', 'owned', ...FILTER_GROUPS.map((group) => group.id)])

function normalizeIntegrationFilter(filter) {
  return INTEGRATION_FILTER_IDS.has(filter) ? filter : 'all'
}

function workspaceStorageKey(workspaceKey) {
  return `postflow_integration_grants:${workspaceKey || 'workspace'}`
}

function legacyWorkspaceStorageKey(workspaceKey) {
  return `postflow_integrations:${workspaceKey || 'workspace'}`
}

function userStorageKey(userKey) {
  return `postflow_user_integrations:${userKey || 'account'}`
}

function seededInstalledIds(workspaceKey) {
  const seed = String(workspaceKey || 'workspace').split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  const featuredIds = ['google-sheets', 'notion', 'zapier', 'slack', 'public-api', 'rss', 'dropbox', 'figma', 'wordpress', 'webhooks']
  const installed = featuredIds.filter((_, index) => (seed + index) % 4 === 0).slice(0, 3)

  if (installed.length >= 2) return installed

  return [...new Set([...installed, featuredIds[seed % featuredIds.length], featuredIds[(seed + 3) % featuredIds.length]])]
}

function loadWorkspaceIntegrationIds(workspaceKey) {
  if (typeof localStorage === 'undefined') return seededInstalledIds(workspaceKey)

  const raw = localStorage.getItem(workspaceStorageKey(workspaceKey)) || localStorage.getItem(legacyWorkspaceStorageKey(workspaceKey))
  if (!raw) return seededInstalledIds(workspaceKey)

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return seededInstalledIds(workspaceKey)
    return parsed.filter((id) => INTEGRATION_IDS.has(id))
  } catch {
    return seededInstalledIds(workspaceKey)
  }
}

function saveWorkspaceIntegrationIds(workspaceKey, integrationIds) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(workspaceStorageKey(workspaceKey), JSON.stringify(integrationIds))
}

function loadUserIntegrationIds(userKey, workspaceKey) {
  if (typeof localStorage === 'undefined') return seededInstalledIds(workspaceKey)

  const raw = localStorage.getItem(userStorageKey(userKey))
  if (!raw) return seededInstalledIds(workspaceKey)

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return seededInstalledIds(workspaceKey)
    return parsed.filter((id) => INTEGRATION_IDS.has(id))
  } catch {
    return seededInstalledIds(workspaceKey)
  }
}

function saveUserIntegrationIds(userKey, integrationIds) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(userStorageKey(userKey), JSON.stringify(integrationIds))
}

function buildResourceLinks(integration) {
  const base = integration.id
  return [
    { label: 'Overview', href: `#${base}-overview` },
    { label: 'Privacy policy', href: `#${base}-privacy` },
    { label: 'Terms of use', href: `#${base}-terms` },
    { label: 'Setup guide', href: `#${base}-setup` },
    { label: 'Changelog', href: `#${base}-changelog` },
  ]
}

export default function Integrations() {
  const { activeWorkspace, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [grantOverrides, setGrantOverrides] = useState({})
  const [userIntegrationOverrides, setUserIntegrationOverrides] = useState({})

  const workspaceKey = activeWorkspace?.slug || activeWorkspace?.id || 'default-workspace'
  const userKey = user?.email || user?.id || 'current-user'
  const workspaceName = activeWorkspace?.name || 'Current workspace'
  const grantedIds = grantOverrides[workspaceKey] ?? loadWorkspaceIntegrationIds(workspaceKey)
  const userIntegrationIds = userIntegrationOverrides[userKey] ?? loadUserIntegrationIds(userKey, workspaceKey)
  const grantedSet = useMemo(() => new Set(grantedIds), [grantedIds])
  const ownedSet = useMemo(() => new Set(userIntegrationIds), [userIntegrationIds])
  const selectedIntegration = selectedId ? INTEGRATIONS.find((integration) => integration.id === selectedId) : null
  const activeFilter = normalizeIntegrationFilter(searchParams.get('tab'))

  const selectFilter = (filter) => {
    const nextFilter = normalizeIntegrationFilter(filter)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', nextFilter)
      return next
    }, { replace: true })
  }

  const filterItems = useMemo(() => {
    const groups = FILTER_GROUPS.map((group) => ({
      ...group,
      count: INTEGRATIONS.filter((integration) => group.categories.includes(integration.category)).length,
    })).filter((item) => item.count > 0)

    return [
      { id: 'all', label: 'All', count: INTEGRATIONS.length },
      { id: 'installed', label: 'Granted', count: grantedSet.size },
      { id: 'owned', label: 'Connected', count: ownedSet.size },
      ...groups,
    ]
  }, [grantedSet.size, ownedSet.size])

  const visibleIntegrations = useMemo(() => {
    const query = search.trim().toLowerCase()

    return INTEGRATIONS.filter((integration) => {
      const granted = grantedSet.has(integration.id)
      const owned = ownedSet.has(integration.id)
      const matchesFilter =
        activeFilter === 'all'
          ? true
          : activeFilter === 'installed'
            ? granted
            : activeFilter === 'owned'
              ? owned
            : FILTER_GROUPS.find((group) => group.id === activeFilter)?.categories.includes(integration.category)
      const matchesSearch = query
        ? `${integration.name} ${integration.category} ${integration.company} ${integration.description}`.toLowerCase().includes(query)
        : true

      return matchesFilter && matchesSearch
    })
  }, [activeFilter, grantedSet, ownedSet, search])

  const toggleIntegration = (integration) => {
    const owned = ownedSet.has(integration.id)
    const granted = grantedSet.has(integration.id)

    const nextOwnedIds = owned ? userIntegrationIds : [...userIntegrationIds, integration.id]
    const nextGrantIds = granted
      ? grantedIds.filter((id) => id !== integration.id)
      : [...grantedIds, integration.id]

    if (!owned) {
      saveUserIntegrationIds(userKey, nextOwnedIds)
      setUserIntegrationOverrides((current) => ({ ...current, [userKey]: nextOwnedIds }))
    }

    saveWorkspaceIntegrationIds(workspaceKey, nextGrantIds)
    setGrantOverrides((current) => ({ ...current, [workspaceKey]: nextGrantIds }))
  }

  const disconnectIntegration = (integration) => {
    const nextOwnedIds = userIntegrationIds.filter((id) => id !== integration.id)
    const nextGrantIds = grantedIds.filter((id) => id !== integration.id)

    saveUserIntegrationIds(userKey, nextOwnedIds)
    saveWorkspaceIntegrationIds(workspaceKey, nextGrantIds)
    setUserIntegrationOverrides((current) => ({ ...current, [userKey]: nextOwnedIds }))
    setGrantOverrides((current) => ({ ...current, [workspaceKey]: nextGrantIds }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Connect integrations once to your account, then grant access per workspace.</p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search integrations..."
            className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear integration search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <Card className="h-fit p-2 lg:sticky lg:top-20">
          <div className="px-3 py-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Catalog</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Filtered for this workspace</p>
          </div>
          <div className="mt-1 space-y-1" role="listbox" aria-label="Integration filters">
            {filterItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={activeFilter === item.id}
                onClick={() => selectFilter(item.id)}
                className={clsx(
                  'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                  activeFilter === item.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className={clsx(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold',
                  activeFilter === item.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleIntegrations.map((integration) => {
              const granted = grantedSet.has(integration.id)
              const owned = ownedSet.has(integration.id)

              return (
                <Card
                  key={integration.id}
                  className="group flex min-h-48 cursor-pointer flex-col p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(integration.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(integration.id)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <IntegrationImage integration={integration} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">{integration.name}</h2>
                          {owned && <Badge color="indigo">Connected</Badge>}
                          {granted && <Badge color="emerald">Granted</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{integration.company} · {integration.category}</p>
                      </div>
                    </div>
                    <Badge color="slate">{integration.version}</Badge>
                  </div>

                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{integration.preview}</p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Metric label="Rating" value={`${integration.rating}`} icon={Star} />
                    <Metric label="Updated" value={integration.lastUpdated.replace(', 2026', '')} icon={Info} />
                    <Metric label="Setup" value={integration.setupTime} icon={Settings2} />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Click for preview and policies</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={granted ? 'ghost' : 'secondary'}
                      className={clsx('shrink-0', granted && 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30')}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleIntegration(integration)
                      }}
                    >
                      {granted ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {granted ? 'Remove access' : owned ? 'Grant' : 'Connect'}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>

          {visibleIntegrations.length === 0 && (
            <Card className="p-8 text-center">
              <p className="font-semibold text-slate-800 dark:text-slate-100">No integrations found</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try another app name, category, or filter.</p>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selectedId)}
        title={selectedIntegration?.name || 'Integration details'}
        description={selectedIntegration ? `${selectedIntegration.company} · ${selectedIntegration.category} integration preview` : ''}
        onClose={() => setSelectedId(null)}
        size="xl"
        fullscreenable
      >
        {!selectedIntegration ? (
          <ModalLoading label="Loading integration preview..." />
        ) : (
          <IntegrationPreviewModal
            integration={selectedIntegration}
            owned={ownedSet.has(selectedIntegration.id)}
            granted={grantedSet.has(selectedIntegration.id)}
            workspaceName={workspaceName}
            onToggle={() => toggleIntegration(selectedIntegration)}
            onDisconnect={() => disconnectIntegration(selectedIntegration)}
          />
        )}
      </Modal>
    </div>
  )
}

function IntegrationPreviewModal({ integration, owned, granted, workspaceName, onToggle, onDisconnect }) {
  const resources = buildResourceLinks(integration)

  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
            <div className="relative min-h-64 p-5 text-white" style={{ background: `linear-gradient(135deg, #${integration.color} 0%, #0f172a 72%)` }}>
              <div className="absolute right-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">Live preview</div>
              <div className="flex h-full min-h-52 flex-col justify-between gap-6">
                <div className="flex items-center gap-4">
                  <IntegrationImage integration={integration} large />
                  <div>
                    <p className="text-sm font-medium text-white/80">{integration.company}</p>
                    <h3 className="text-3xl font-bold tracking-tight">{integration.name}</h3>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <PreviewStep title="Account" value={owned ? 'Connected' : 'Not connected'} />
                  <PreviewStep title="Workspace" value={granted ? workspaceName : 'No access'} />
                  <PreviewStep title="Setup" value={integration.setupTime} />
                </div>
              </div>
            </div>
          </div>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Description</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{integration.description}</p>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key features</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {integration.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Permissions</h3>
            <div className="mt-3 space-y-2">
              {integration.permissions.map((permission) => (
                <div key={permission} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  <span>{permission}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge color={owned ? 'indigo' : 'slate'}>{owned ? 'Account connected' : 'Not connected'}</Badge>
                <Badge color={granted ? 'emerald' : 'slate'}>{granted ? 'Workspace granted' : 'No workspace access'}</Badge>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Owned by your user account. Access is granted separately for {workspaceName}.</p>
            <div className="mt-4 space-y-3">
              <Detail label="Rating" value={`${integration.rating} / 5`} icon={Star} />
              <Detail label="Version" value={integration.version} icon={Info} />
              <Detail label="Last updated" value={integration.lastUpdated} icon={Settings2} />
              <Detail label="Company" value={integration.company} icon={Building2} />
              <Detail label="Installs" value={integration.installs} icon={CheckCircle2} />
              <Detail label="Setup time" value={integration.setupTime} icon={Zap} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pages</h3>
            <div className="mt-3 space-y-2">
              {resources.map((resource) => (
                <a
                  key={resource.label}
                  href={resource.href}
                  className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <span className="truncate">{resource.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ))}
            </div>
          </div>

          <Button
            type="button"
            variant={granted ? 'danger' : 'primary'}
            className="w-full"
            onClick={onToggle}
          >
            {granted ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {granted ? 'Remove workspace access' : owned ? 'Grant to workspace' : 'Connect and grant'}
          </Button>
          {owned && (
            <Button type="button" variant="ghost" className="w-full text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30" onClick={onDisconnect}>
              <Trash2 className="h-4 w-4" /> Disconnect account-level integration
            </Button>
          )}
        </aside>
      </div>
    </div>
  )
}

function IntegrationImage({ integration, large = false }) {
  const [failed, setFailed] = useState(false)
  const Fallback = integration.fallback || FALLBACK_ICONS[integration.category] || FileSpreadsheet

  if (!failed && integration.icon) {
    return (
      <span className={clsx(
        'flex shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700',
        large ? 'h-20 w-20' : 'h-14 w-14',
      )}>
        <img
          src={`https://cdn.simpleicons.org/${integration.icon}/${integration.color}`}
          alt=""
          className={clsx('object-contain', large ? 'h-12 w-12' : 'h-8 w-8')}
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  return (
    <span
      className={clsx('flex shrink-0 items-center justify-center rounded-xl text-white', large ? 'h-20 w-20' : 'h-14 w-14')}
      style={{ backgroundColor: `#${integration.color}` }}
    >
      <Fallback className={large ? 'h-10 w-10' : 'h-7 w-7'} />
    </span>
  )
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{value}</span>
      </div>
      <p className="mt-0.5 truncate text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function PreviewStep({ title, value }) {
  return (
    <div className="rounded-xl bg-white/15 p-3 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{title}</p>
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  )
}
