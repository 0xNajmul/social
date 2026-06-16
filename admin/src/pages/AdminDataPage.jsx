import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, X } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, PageLoader, StatCard } from '../components/ui'

const PAGE_CONFIG = {
  planners: {
    title: 'Planners',
    description: 'All saved planner notes and campaign briefs across workspaces.',
    endpoint: '/admin/planners',
    search: 'Search planner title or content...',
    columns: [
      ['title', 'Plan', (row) => <Primary secondary={row.excerpt}>{row.title}</Primary>],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['author', 'Author', (row) => <UserCell user={row.author} />],
      ['scheduled_at', 'Scheduled', (row) => formatDate(row.scheduled_at)],
      ['created_at', 'Created', (row) => formatDate(row.created_at)],
    ],
  },
  media: {
    title: 'Media Library',
    description: 'All images, videos, PDFs, and uploaded assets across workspaces.',
    endpoint: '/admin/media',
    search: 'Search upload names...',
    columns: [
      ['asset', 'Asset', (row) => <MediaCell asset={row} />],
      ['type', 'Type', (row) => <Badge color="indigo">{row.type}</Badge>],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['uploader', 'Uploaded by', (row) => <UserCell user={row.uploader} />],
      ['size', 'Size', (row) => formatBytes(row.size)],
      ['created_at', 'Uploaded', (row) => formatDate(row.created_at)],
    ],
  },
  automations: {
    title: 'Automations',
    description: 'All user-created automations, schedules, feeds, and AI settings.',
    endpoint: '/admin/automations',
    search: 'Search automation names...',
    columns: [
      ['name', 'Automation', (row) => <Primary secondary={row.type_label}>{row.name}</Primary>],
      ['status', 'Status', (row) => <Badge color={row.is_active ? 'emerald' : 'slate'}>{row.is_active ? 'Active' : 'Paused'}</Badge>],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['creator', 'Created by', (row) => <UserCell user={row.creator} />],
      ['accounts', 'Accounts', (row) => row.social_accounts_count ?? 0],
      ['next_run_at', 'Next run', (row) => formatDate(row.next_run_at)],
    ],
  },
  accounts: {
    title: 'Accounts',
    description: 'Connected social accounts from every user workspace.',
    endpoint: '/admin/accounts',
    search: 'Search platform, account, or username...',
    columns: [
      ['account', 'Account', (row) => <AccountCell account={row} />],
      ['status', 'Status', (row) => <Badge color={row.status === 'active' ? 'emerald' : row.status === 'error' ? 'rose' : 'amber'}>{row.status || 'unknown'}</Badge>],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['connector', 'Connected by', (row) => <UserCell user={row.connector} />],
      ['token_expires_at', 'Token expires', (row) => formatDate(row.token_expires_at)],
      ['created_at', 'Connected', (row) => formatDate(row.created_at)],
    ],
  },
  'report-notifications': {
    title: 'Notifications',
    description: 'All database notifications sent to platform users.',
    endpoint: '/admin/reports/notifications',
    search: 'Search user, type, or notification data...',
    columns: [
      ['type', 'Type', (row) => <Badge color={row.read_at ? 'slate' : 'sky'}>{row.type}</Badge>],
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['summary', 'Summary', (row) => notificationSummary(row.data)],
      ['read_at', 'Read', (row) => row.read_at ? formatDate(row.read_at) : 'Unread'],
      ['created_at', 'Created', (row) => formatDate(row.created_at)],
    ],
  },
  'report-affiliate-incomes': {
    title: 'Affiliate Incomes',
    description: 'User affiliate income records and payout history.',
    endpoint: '/admin/reports/affiliate-incomes',
    search: 'Search affiliate records...',
    columns: [
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['amount', 'Amount', (row) => row.amount || '-'],
      ['status', 'Status', (row) => row.status || '-'],
      ['created_at', 'Created', (row) => formatDate(row.created_at)],
    ],
  },
  'report-login-history': {
    title: 'Login History',
    description: 'Latest known login details for users.',
    endpoint: '/admin/reports/login-history',
    search: 'Search user or IP address...',
    columns: [
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['ip_address', 'IP address', (row) => row.ip_address || '-'],
      ['last_login_at', 'Last login', (row) => formatDate(row.last_login_at)],
    ],
  },
  'report-ai-usage-history': {
    title: 'AI Usage History',
    description: 'AI generation requests, token usage, and credits across workspaces.',
    endpoint: '/admin/reports/ai-usage-history',
    search: 'Search type, model, or prompt...',
    columns: [
      ['type', 'Type', (row) => <Badge color="violet">{row.type}</Badge>],
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['usage', 'Usage', (row) => `${row.tokens_used ?? 0} tokens · ${row.credits_used ?? 0} credits`],
      ['prompt', 'Prompt', (row) => <span className="line-clamp-2 max-w-sm text-slate-400">{row.prompt || '-'}</span>],
      ['created_at', 'Created', (row) => formatDate(row.created_at)],
    ],
  },
  'report-email-history': {
    title: 'Email History',
    description: 'Recorded outbound workspace invitation emails.',
    endpoint: '/admin/reports/email-history',
    search: 'Search recipient email...',
    columns: [
      ['recipient', 'Recipient', (row) => row.recipient],
      ['type', 'Type', (row) => row.type],
      ['status', 'Status', (row) => <Badge color={row.status === 'accepted' ? 'emerald' : 'sky'}>{row.status}</Badge>],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['sender', 'Sender', (row) => <UserCell user={row.sender} />],
      ['sent_at', 'Sent', (row) => formatDate(row.sent_at)],
    ],
  },
  'report-user-transaction-history': {
    title: 'User Transaction History',
    description: 'Workspace subscription and billing-cycle records.',
    endpoint: '/admin/reports/user-transaction-history',
    search: 'Search workspace...',
    columns: [
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['plan', 'Plan', (row) => row.plan?.name || '-'],
      ['status', 'Status', (row) => <Badge color={row.status === 'active' ? 'emerald' : 'amber'}>{row.status}</Badge>],
      ['billing_cycle', 'Billing', (row) => row.billing_cycle],
      ['created_at', 'Created', (row) => formatDate(row.created_at)],
    ],
  },
  'report-activity-logs': {
    title: 'Activity Logs',
    description: 'User and admin activity recorded by the platform audit trail.',
    endpoint: '/admin/reports/activity-logs',
    search: 'Search action, description, or IP...',
    columns: [
      ['action', 'Action', (row) => <Badge color="indigo">{row.action}</Badge>],
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['description', 'Description', (row) => <span className="line-clamp-2 max-w-md text-slate-400">{row.description || '-'}</span>],
      ['ip_address', 'IP', (row) => row.ip_address || '-'],
      ['created_at', 'Created', (row) => formatDate(row.created_at)],
    ],
  },
}

export default function AdminDataPage({ type }) {
  const config = PAGE_CONFIG[type] || PAGE_CONFIG.planners
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async (query = search) => {
    setLoading(true)
    try {
      const { data } = await api.get(config.endpoint, { params: { search: query || undefined, per_page: 100 } })
      setRows(data.data || [])
      setMeta(data.meta || null)
      setMessage(data.message || '')
    } catch (error) {
      setRows([])
      setMeta(null)
      setMessage(error.response?.data?.message || 'Could not load this admin report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    api.get(config.endpoint, { params: { per_page: 100 } })
      .then(({ data }) => {
        if (ignore) return
        setRows(data.data || [])
        setMeta(data.meta || null)
        setMessage(data.message || '')
      })
      .catch((error) => {
        if (ignore) return
        setRows([])
        setMeta(null)
        setMessage(error.response?.data?.message || 'Could not load this admin report.')
      })

    return () => {
      ignore = true
    }
  }, [config.endpoint])

  const columns = useMemo(() => config.columns, [config.columns])
  const total = meta?.total ?? rows?.length ?? 0

  const onSearch = (event) => {
    event.preventDefault()
    load(search)
  }

  if (!rows) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{config.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{config.description}</p>
        </div>
        <form onSubmit={onSearch} className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-96">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.search} className="pl-9 pr-9" />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-700 hover:text-white" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <Button type="submit" size="sm" variant="secondary" loading={loading}>Search</Button>
          <Button type="button" size="sm" onClick={() => load()} loading={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total records" value={total} hint="Current admin view" />
      </div>

      {message && <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">{message}</div>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-800/30 uppercase text-slate-500">
              <tr>
                {columns.map(([key, label]) => <th key={key} className="px-3 py-2 font-semibold">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id} className="text-slate-300 transition hover:bg-slate-800/35">
                  {columns.map(([key, , render]) => <td key={key} className="px-3 py-2 align-top">{render(row)}</td>)}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-12 text-center text-slate-500">
                    <Search className="mx-auto mb-2 h-8 w-8" />No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Primary({ children, secondary }) {
  return (
    <div>
      <p className="max-w-xs truncate font-medium text-white">{children || '-'}</p>
      {secondary && <p className="mt-0.5 max-w-xs truncate text-[11px] text-slate-500">{secondary}</p>}
    </div>
  )
}

function WorkspaceCell({ workspace }) {
  if (!workspace) return <span className="text-slate-500">-</span>

  return <Primary secondary={workspace.slug}>{workspace.name}</Primary>
}

function UserCell({ user }) {
  if (!user) return <span className="text-slate-500">-</span>

  return <Primary secondary={user.email}>{user.name}</Primary>
}

function MediaCell({ asset }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800 text-slate-500">
        {asset.thumbnail_url ? <img src={asset.thumbnail_url} alt="" className="h-full w-full object-cover" /> : asset.type?.[0]?.toUpperCase()}
      </span>
      <Primary secondary={asset.mime_type}>{asset.original_name}</Primary>
    </div>
  )
}

function AccountCell({ account }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xs font-bold text-slate-400">
        {account.avatar_url ? <img src={account.avatar_url} alt="" className="h-full w-full object-cover" /> : account.platform?.[0]?.toUpperCase()}
      </span>
      <Primary secondary={account.username || account.platform_label}>{account.name}</Primary>
    </div>
  )
}

function notificationSummary(data = {}) {
  return data.message || data.title || data.body || data.post_title || data.account_name || '-'
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function formatBytes(value) {
  const size = Number(value || 0)
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return `${(size / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}
