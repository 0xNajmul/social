import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Eye, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader, Textarea } from '../components/ui'

const AUTOMATION_TYPES = [
  ['rss_feed', 'RSS feed'],
  ['blog', 'Blog / website'],
  ['youtube_channel', 'YouTube channel'],
  ['csv_import', 'CSV import'],
  ['recycle', 'Evergreen recycle'],
  ['repost_top_performing', 'Repost top performing'],
]

const MEDIA_TYPES = [
  ['image', 'Image'],
  ['video', 'Video'],
  ['gif', 'GIF'],
  ['document', 'Document'],
]

const ACCOUNT_PLATFORMS = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['x', 'X / Twitter'],
  ['twitter', 'Twitter'],
  ['linkedin', 'LinkedIn'],
  ['tiktok', 'TikTok'],
  ['youtube', 'YouTube'],
  ['reddit', 'Reddit'],
  ['threads', 'Threads'],
  ['snapchat', 'Snapchat'],
]

const ACCOUNT_STATUSES = [
  ['active', 'Active'],
  ['paused', 'Paused'],
  ['expired', 'Expired'],
  ['revoked', 'Revoked'],
  ['error', 'Error'],
]

const AI_TYPES = [
  ['', 'All request types'],
  ['caption', 'Caption'],
  ['hook', 'Hook'],
  ['hashtags', 'Hashtags'],
  ['ideas', 'Ideas'],
  ['rewrite', 'Rewrite'],
  ['tone', 'Tone'],
  ['calendar', 'Calendar'],
]

const PAGE_CONFIG = {
  planners: {
    title: 'Planners',
    description: 'All saved planner notes and campaign briefs across workspaces.',
    endpoint: '/admin/planners',
    search: 'Search planner title or content...',
    crud: {
      singular: 'planner note',
      fields: [
        { key: 'workspace_id', label: 'Workspace ID', type: 'number', required: true },
        { key: 'created_by', label: 'Author user ID', type: 'number' },
        { key: 'title', label: 'Title', required: true },
        { key: 'status', label: 'Status', placeholder: 'note, draft, scheduled' },
        { key: 'scheduled_at', label: 'Scheduled at', type: 'datetime' },
        { key: 'categories', label: 'Categories', type: 'csv', placeholder: 'Launch, Ideas' },
        { key: 'tags', label: 'Tags', type: 'csv', placeholder: 'campaign, evergreen' },
        { key: 'content_text', label: 'Plain content', type: 'textarea', rows: 7, span: true },
        { key: 'content_html', label: 'Rich content HTML', type: 'textarea', rows: 7, span: true },
      ],
      toForm: plannerToForm,
      toPayload: plannerToPayload,
    },
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
    crud: {
      singular: 'media asset',
      fields: [
        { key: 'workspace_id', label: 'Workspace ID', type: 'number', required: true },
        { key: 'uploaded_by', label: 'Uploader user ID', type: 'number' },
        { key: 'type', label: 'Type', type: 'select', options: MEDIA_TYPES, required: true },
        { key: 'disk', label: 'Disk' },
        { key: 'original_name', label: 'Original name', required: true },
        { key: 'mime_type', label: 'MIME type', required: true },
        { key: 'path', label: 'Storage path', span: true, required: true },
        { key: 'thumbnail_path', label: 'Thumbnail path', span: true },
        { key: 'size', label: 'Size in bytes', type: 'number' },
        { key: 'width', label: 'Width', type: 'number' },
        { key: 'height', label: 'Height', type: 'number' },
        { key: 'duration', label: 'Duration seconds', type: 'number' },
        { key: 'tags', label: 'Tags', type: 'csv', span: true },
        { key: 'meta', label: 'Metadata JSON', type: 'json', rows: 6, span: true },
      ],
      toForm: mediaToForm,
      toPayload: mediaToPayload,
    },
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
    crud: {
      singular: 'automation',
      fields: [
        { key: 'workspace_id', label: 'Workspace ID', type: 'number', required: true },
        { key: 'created_by', label: 'Creator user ID', type: 'number' },
        { key: 'name', label: 'Name', required: true },
        { key: 'type', label: 'Type', type: 'select', options: AUTOMATION_TYPES, required: true },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
        { key: 'requires_approval', label: 'Requires approval', type: 'checkbox' },
        { key: 'use_ai', label: 'Use AI', type: 'checkbox' },
        { key: 'social_account_ids', label: 'Social account IDs', type: 'csv', placeholder: '1, 2, 3' },
        { key: 'last_run_at', label: 'Last run at', type: 'datetime' },
        { key: 'next_run_at', label: 'Next run at', type: 'datetime' },
        { key: 'items_created', label: 'Items created', type: 'number' },
        { key: 'config', label: 'Config JSON', type: 'json', rows: 8, span: true },
      ],
      toForm: automationToForm,
      toPayload: automationToPayload,
    },
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
    crud: {
      singular: 'social account',
      fields: [
        { key: 'workspace_id', label: 'Workspace ID', type: 'number', required: true },
        { key: 'connected_by', label: 'Connected by user ID', type: 'number' },
        { key: 'platform', label: 'Platform', type: 'select', options: ACCOUNT_PLATFORMS, required: true },
        { key: 'provider_account_id', label: 'Provider account ID', required: true },
        { key: 'name', label: 'Display name', required: true },
        { key: 'username', label: 'Username' },
        { key: 'status', label: 'Status', type: 'select', options: ACCOUNT_STATUSES },
        { key: 'token_expires_at', label: 'Token expires at', type: 'datetime' },
        { key: 'last_synced_at', label: 'Last synced at', type: 'datetime' },
        { key: 'avatar_url', label: 'Avatar URL', type: 'url', span: true },
        { key: 'profile_url', label: 'Profile URL', type: 'url', span: true },
        { key: 'status_message', label: 'Status message', type: 'textarea', rows: 4, span: true },
        { key: 'settings', label: 'Settings JSON', type: 'json', rows: 6, span: true },
      ],
      toForm: accountToForm,
      toPayload: accountToPayload,
    },
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
  'report-ai-usage': {
    title: 'AI Usage',
    description: 'Every AI request, response, model, token count, and credit record across workspaces.',
    endpoint: '/admin/reports/ai-usage',
    search: 'Search prompt, response, model, user, or workspace...',
    summary: true,
    tableMin: 'min-w-[1500px]',
    filters: [
      { key: 'type', label: 'Request type', type: 'select', options: AI_TYPES },
      { key: 'model', label: 'Model', placeholder: 'gpt-4o-mini' },
      { key: 'user_id', label: 'User ID', type: 'number' },
      { key: 'workspace_id', label: 'Workspace ID', type: 'number' },
      { key: 'date_from', label: 'From', type: 'date' },
      { key: 'date_to', label: 'To', type: 'date' },
    ],
    columns: [
      ['type', 'Type', (row) => <Badge color="violet">{row.type}</Badge>],
      ['model', 'Model', (row) => <Primary secondary={`#${row.id}`}>{row.model || '-'}</Primary>],
      ['user', 'User', (row) => <UserCell user={row.user} />],
      ['workspace', 'Workspace', (row) => <WorkspaceCell workspace={row.workspace} />],
      ['usage', 'Usage', (row) => `${row.tokens_used ?? 0} tokens - ${row.credits_used ?? 0} credits`],
      ['prompt', 'Request', (row) => <ExpandableText title="Prompt" preview={row.prompt_preview} text={row.prompt} />],
      ['result', 'Response', (row) => <ExpandableText title="Response" preview={row.result_preview} text={row.result} />],
      ['params', 'Params', (row) => <JsonPreview value={row.params} />],
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
  const [filters, setFilters] = useState(() => initialFilters(config))
  const [loading, setLoading] = useState(false)
  const [modalMode, setModalMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [crudMessage, setCrudMessage] = useState(null)

  const load = useCallback(async (query = search, nextFilters = filters) => {
    setLoading(true)
    try {
      const { data } = await api.get(config.endpoint, { params: { search: query || undefined, ...activeFilters(nextFilters), per_page: 100 } })
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
  }, [config.endpoint, filters, search])

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
  const hasCrud = Boolean(config.crud)

  const onSearch = (event) => {
    event.preventDefault()
    load(search, filters)
  }

  const resetFilters = () => {
    const next = initialFilters(config)
    setSearch('')
    setFilters(next)
    load('', next)
  }

  const openCreate = () => {
    setSelectedRow(null)
    setForm(config.crud.toForm())
    setModalMode('create')
    setErrors({})
    setCrudMessage(null)
  }

  const openRow = (mode, row) => {
    setSelectedRow(row)
    setForm(config.crud.toForm(row))
    setModalMode(mode)
    setErrors({})
    setCrudMessage(null)
  }

  const closeModal = () => {
    if (saving) return
    setModalMode(null)
    setSelectedRow(null)
    setErrors({})
    setCrudMessage(null)
  }

  const saveCrud = async (event) => {
    event.preventDefault()
    if (!hasCrud || modalMode === 'view') return
    setSaving(true)
    setErrors({})
    setCrudMessage(null)

    try {
      const payload = config.crud.toPayload(form)
      const request = modalMode === 'create'
        ? api.post(config.endpoint, payload)
        : api.put(`${config.endpoint}/${selectedRow.id}`, payload)
      const { data } = await request
      setRows((current) => {
        const nextRow = data.data
        if (modalMode === 'create') return [nextRow, ...(current || [])]
        return (current || []).map((row) => (row.id === nextRow.id ? nextRow : row))
      })
      setSelectedRow(data.data)
      setForm(config.crud.toForm(data.data))
      setModalMode('view')
      setCrudMessage({ type: 'success', text: data.message || 'Record saved.' })
    } catch (error) {
      if (error.response?.data?.errors) setErrors(error.response.data.errors)
      setCrudMessage({ type: 'error', text: error.messageForUser || error.response?.data?.message || error.message || 'Could not save this record.' })
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete ${config.crud.singular} #${row.id}? This cannot be undone.`)) return
    setDeletingId(row.id)
    try {
      await api.delete(`${config.endpoint}/${row.id}`)
      setRows((current) => (current || []).filter((item) => item.id !== row.id))
      setMessage(`${capitalize(config.crud.singular)} deleted.`)
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not delete this record.')
    } finally {
      setDeletingId(null)
    }
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
          <Button type="button" size="sm" onClick={() => load(search, filters)} loading={loading}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          {hasCrud && <Button type="button" size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New {config.crud.singular}</Button>}
        </form>
      </div>

      {config.summary && <ReportSummary summary={meta?.summary} />}

      {config.filters?.length > 0 && (
        <ReportFilters
          fields={config.filters}
          filters={filters}
          loading={loading}
          onApply={() => load(search, filters)}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onReset={resetFilters}
        />
      )}

      {message && <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">{message}</div>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full ${config.tableMin || 'min-w-[980px]'} text-left text-xs`}>
            <thead className="border-b border-slate-800 bg-slate-800/30 uppercase text-slate-500">
              <tr>
                {columns.map(([key, label]) => <th key={key} className="px-3 py-2 font-semibold">{label}</th>)}
                {hasCrud && <th className="px-3 py-2 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id} className="text-slate-300 transition hover:bg-slate-800/35">
                  {columns.map(([key, , render]) => <td key={key} className="px-3 py-2 align-top">{render(row)}</td>)}
                  {hasCrud && (
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <ActionButton label="View" onClick={() => openRow('view', row)}><Eye className="h-3.5 w-3.5" /></ActionButton>
                        <ActionButton label="Edit" tone="edit" onClick={() => openRow('edit', row)}><Edit3 className="h-3.5 w-3.5" /></ActionButton>
                        <ActionButton label="Delete" tone="delete" disabled={deletingId === row.id} onClick={() => deleteRow(row)}><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (hasCrud ? 1 : 0)} className="px-3 py-12 text-center text-slate-500">
                    <Search className="mx-auto mb-2 h-8 w-8" />No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {hasCrud && (
        <CrudModal
          config={config.crud}
          mode={modalMode}
          form={form}
          errors={errors}
          message={crudMessage}
          saving={saving}
          onClose={closeModal}
          onSubmit={saveCrud}
          onEdit={() => setModalMode('edit')}
          onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        />
      )}
    </div>
  )
}

function CrudModal({ config, mode, form, errors, message, saving, onClose, onSubmit, onEdit, onChange }) {
  const isOpen = Boolean(mode)
  const isView = mode === 'view'
  const title = mode === 'create' ? `New ${config.singular}` : isView ? `View ${config.singular}` : `Edit ${config.singular}`

  return (
    <Modal open={isOpen} title={title} description="Manage the platform record directly from the admin console." onClose={onClose} size="xl">
      <form onSubmit={onSubmit}>
        <div className="space-y-4 p-5">
          {message && <Notice message={message} />}
          {Object.keys(errors || {}).length > 0 && <Notice message={{ type: 'error', text: 'Please fix the highlighted fields.' }} />}
          <div className="grid gap-4 sm:grid-cols-2">
            {config.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={form[field.key]}
                error={errors?.[field.key]?.[0]}
                disabled={isView || saving}
                onChange={(value) => onChange(field.key, value)}
              />
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-800 bg-slate-900 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          {isView ? (
            <Button type="button" onClick={onEdit}><Edit3 className="h-4 w-4" /> Edit</Button>
          ) : (
            <Button type="submit" loading={saving}>Save {config.singular}</Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

function ReportSummary({ summary = {} }) {
  const cards = [
    ['Requests', summary.requests ?? 0],
    ['Tokens used', summary.tokens ?? 0],
    ['Credits used', summary.credits ?? 0],
    ['Models', summary.models ?? 0],
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <Card key={label} className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{Number(value || 0).toLocaleString()}</p>
        </Card>
      ))}
    </div>
  )
}

function ReportFilters({ fields, filters, loading, onApply, onChange, onReset }) {
  return (
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {fields.map((field) => (
          <FilterControl key={field.key} field={field} value={filters[field.key] || ''} onChange={(value) => onChange(field.key, value)} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
        <Button type="button" size="sm" variant="ghost" onClick={onReset}>Reset filters</Button>
        <Button type="button" size="sm" onClick={onApply} loading={loading}>Apply filters</Button>
      </div>
    </Card>
  )
}

function FilterControl({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <label>
        <span className="mb-1.5 block text-sm font-medium text-slate-300">{field.label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          {(field.options || []).map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
        </select>
      </label>
    )
  }

  return (
    <Input
      label={field.label}
      type={field.type || 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
    />
  )
}

function FieldControl({ field, value, error, disabled, onChange }) {
  const className = field.span ? 'sm:col-span-2' : ''
  const common = {
    value: value ?? '',
    disabled,
    onChange: (event) => onChange(event.target.value),
    placeholder: field.placeholder,
    error,
  }

  if (field.type === 'checkbox') {
    return (
      <label className={`flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 ${className}`}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand-600 disabled:opacity-60"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-100">{field.label}</span>
          {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
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
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-70"
        >
          {!field.required && <option value="">None</option>}
          {(field.options || []).map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
        </select>
        {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
      </label>
    )
  }

  if (field.type === 'textarea' || field.type === 'json') {
    return (
      <div className={className}>
        <Textarea label={field.label} rows={field.rows || 4} {...common} />
      </div>
    )
  }

  return (
    <div className={className}>
      <Input
        label={field.label}
        type={field.type === 'datetime' ? 'datetime-local' : field.type || 'text'}
        {...common}
      />
    </div>
  )
}

function ActionButton({ label, tone = 'view', children, ...props }) {
  const tones = {
    view: 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
    edit: 'border-amber-800/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60',
    delete: 'border-rose-800/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60',
  }

  return (
    <button type="button" className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-50 ${tones[tone]}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
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

function ExpandableText({ preview, text, title }) {
  const [open, setOpen] = useState(false)
  const value = text || preview || ''
  if (!value) return <span className="text-slate-500">-</span>

  return (
    <div className="max-w-md">
      <p className={`${open ? 'whitespace-pre-wrap' : 'line-clamp-3'} text-slate-300`}>{open ? value : preview || value}</p>
      {String(value).length > 120 && (
        <button type="button" onClick={() => setOpen((current) => !current)} className="mt-1 text-[11px] font-semibold text-brand-300 hover:text-brand-200">
          {open ? `Collapse ${title.toLowerCase()}` : `View full ${title.toLowerCase()}`}
        </button>
      )}
    </div>
  )
}

function JsonPreview({ value }) {
  const text = jsonToString(value)
  if (!value || text === '{}') return <span className="text-slate-500">-</span>

  return (
    <pre className="max-w-xs overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-[11px] leading-5 text-slate-400">
      {text}
    </pre>
  )
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

function plannerToForm(row = {}) {
  return {
    workspace_id: row.workspace_id || row.workspace?.id || '',
    created_by: row.created_by || row.author?.id || '',
    title: row.title || '',
    status: row.status || 'note',
    scheduled_at: toDateTimeInput(row.scheduled_at),
    categories: arrayToCsv(row.categories),
    tags: arrayToCsv(row.tags),
    content_text: row.content_text || '',
    content_html: row.content_html || '',
  }
}

function plannerToPayload(form) {
  return {
    workspace_id: toIntegerOrNull(form.workspace_id),
    created_by: toIntegerOrNull(form.created_by),
    title: form.title || '',
    status: form.status || 'note',
    scheduled_at: toIsoOrNull(form.scheduled_at),
    categories: csvToArray(form.categories),
    tags: csvToArray(form.tags),
    content_text: form.content_text || '',
    content_html: form.content_html || form.content_text || '',
  }
}

function mediaToForm(row = {}) {
  return {
    workspace_id: row.workspace_id || row.workspace?.id || '',
    uploaded_by: row.uploaded_by || row.uploader?.id || '',
    type: row.type || 'image',
    disk: row.disk || 'public',
    path: row.path || '',
    thumbnail_path: row.thumbnail_path || '',
    original_name: row.original_name || '',
    mime_type: row.mime_type || '',
    size: row.size ?? '',
    width: row.width ?? '',
    height: row.height ?? '',
    duration: row.duration ?? '',
    tags: arrayToCsv(row.tags),
    meta: jsonToString(row.meta),
  }
}

function mediaToPayload(form) {
  return {
    workspace_id: toIntegerOrNull(form.workspace_id),
    uploaded_by: toIntegerOrNull(form.uploaded_by),
    type: form.type || 'image',
    disk: form.disk || 'public',
    path: form.path || '',
    thumbnail_path: form.thumbnail_path || null,
    original_name: form.original_name || '',
    mime_type: form.mime_type || '',
    size: toIntegerOrNull(form.size) ?? 0,
    width: toIntegerOrNull(form.width),
    height: toIntegerOrNull(form.height),
    duration: toIntegerOrNull(form.duration),
    tags: csvToArray(form.tags),
    meta: parseJson(form.meta, 'Metadata JSON'),
  }
}

function automationToForm(row = {}) {
  return {
    workspace_id: row.workspace_id || row.workspace?.id || '',
    created_by: row.created_by || row.creator?.id || '',
    name: row.name || '',
    type: row.type || 'rss_feed',
    is_active: row.is_active ?? true,
    requires_approval: row.requires_approval ?? false,
    use_ai: row.use_ai ?? false,
    social_account_ids: arrayToCsv(row.social_account_ids),
    config: jsonToString(row.config),
    last_run_at: toDateTimeInput(row.last_run_at),
    next_run_at: toDateTimeInput(row.next_run_at),
    items_created: row.items_created ?? 0,
  }
}

function automationToPayload(form) {
  return {
    workspace_id: toIntegerOrNull(form.workspace_id),
    created_by: toIntegerOrNull(form.created_by),
    name: form.name || '',
    type: form.type || 'rss_feed',
    is_active: Boolean(form.is_active),
    requires_approval: Boolean(form.requires_approval),
    use_ai: Boolean(form.use_ai),
    social_account_ids: csvToArray(form.social_account_ids).map((item) => Number(item)).filter((item) => Number.isInteger(item)),
    config: parseJson(form.config, 'Config JSON'),
    last_run_at: toIsoOrNull(form.last_run_at),
    next_run_at: toIsoOrNull(form.next_run_at),
    items_created: toIntegerOrNull(form.items_created) ?? 0,
  }
}

function accountToForm(row = {}) {
  return {
    workspace_id: row.workspace_id || row.workspace?.id || '',
    connected_by: row.connected_by || row.connector?.id || '',
    platform: row.platform || 'facebook',
    provider_account_id: row.provider_account_id || '',
    name: row.name || '',
    username: row.username || '',
    avatar_url: row.avatar_url || '',
    profile_url: row.profile_url || '',
    status: row.status || 'active',
    status_message: row.status_message || '',
    settings: jsonToString(row.settings),
    token_expires_at: toDateTimeInput(row.token_expires_at),
    last_synced_at: toDateTimeInput(row.last_synced_at),
  }
}

function accountToPayload(form) {
  return {
    workspace_id: toIntegerOrNull(form.workspace_id),
    connected_by: toIntegerOrNull(form.connected_by),
    platform: form.platform || 'facebook',
    provider_account_id: form.provider_account_id || '',
    name: form.name || '',
    username: form.username || null,
    avatar_url: form.avatar_url || null,
    profile_url: form.profile_url || null,
    status: form.status || 'active',
    status_message: form.status_message || null,
    settings: parseJson(form.settings, 'Settings JSON'),
    token_expires_at: toIsoOrNull(form.token_expires_at),
    last_synced_at: toIsoOrNull(form.last_synced_at),
  }
}

function notificationSummary(data = {}) {
  return data.message || data.title || data.body || data.post_title || data.account_name || '-'
}

function initialFilters(config) {
  return (config.filters || []).reduce((values, field) => ({ ...values, [field.key]: '' }), {})
}

function activeFilters(filters = {}) {
  return Object.entries(filters).reduce((values, [key, value]) => {
    if (value !== '' && value !== null && value !== undefined) values[key] = value
    return values
  }, {})
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

function arrayToCsv(value) {
  return Array.isArray(value) ? value.join(', ') : ''
}

function csvToArray(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function jsonToString(value) {
  return JSON.stringify(value || {}, null, 2)
}

function parseJson(value, label) {
  const text = String(value || '').trim()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    const error = new Error(`${label} must be valid JSON.`)
    error.messageForUser = error.message
    throw error
  }
}

function toIntegerOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : null
}

function toIsoOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function capitalize(value) {
  return String(value || '').replace(/^./, (letter) => letter.toUpperCase())
}

function Notice({ message }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div>
}
