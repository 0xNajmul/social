import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Eye, EyeOff, Grid3X3, MoreVertical, Plus, RefreshCw, Table2, Trash2, AlertTriangle, CheckCircle2, Sparkles, Search, X, UserRound } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { connectPlatforms, normalizeAccounts } from '../lib/accounts'
import { Card, Button, Badge, PageLoader, EmptyState, ConfirmDialog, Modal } from '../components/ui'
import { AccountIcon } from '../components/PlatformBadge'
import AccountConnectModal from '../components/accounts/AccountConnectModal'
import { DATA_CHANGED_EVENT } from '../lib/appEvents'
import useInfiniteList from '../hooks/useInfiniteList'

const HIDDEN_COMPOSE_ACCOUNTS_KEY = 'postflow_hidden_compose_accounts'
const ACCOUNT_STATUS_FILTERS = [
  ['all', 'All statuses'],
  ['active', 'Active'],
  ['attention', 'Needs attention'],
  ['error', 'Error'],
]

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [accounts, setAccounts] = useState(null)
  const [platforms, setPlatforms] = useState([])
  const [showConnect, setShowConnect] = useState(false)
  const [connectDefaults, setConnectDefaults] = useState(null)
  const [syncing, setSyncing] = useState(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState(null)
  const [accountSearch, setAccountSearch] = useState('')
  const [plannerNotes, setPlannerNotes] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [accountStatusFilter, setAccountStatusFilter] = useState('all')
  const [view, setView] = useState(() => localStorage.getItem('postflow_accounts_view') || 'card')
  const [hiddenComposeIds, setHiddenComposeIds] = useState(() => loadHiddenComposeAccountIds())
  const [openMenuId, setOpenMenuId] = useState(null)

  const load = useCallback(() => {
    Promise.allSettled([
      api.get('/social/accounts'),
      api.get('/social/platforms'),
      api.get('/planner-notes', { params: { limit: 100 } }),
    ]).then(([accountsResult, platformsResult, plannerResult]) => {
      setAccounts(accountsResult.status === 'fulfilled' ? normalizeAccounts(accountsResult.value.data?.data || []) : [])
      setPlatforms(platformsResult.status === 'fulfilled' ? connectPlatforms(platformsResult.value.data?.data || []) : [])
      setPlannerNotes(plannerResult.status === 'fulfilled' ? plannerResult.value.data?.data || [] : [])
    })
  }, [])
  const oauthHandled = useRef(false)

  useEffect(() => {
    load()
    const interval = window.setInterval(load, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, load)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, load)
    }
  }, [load])

  useEffect(() => {
    localStorage.setItem('postflow_accounts_view', view)
  }, [view])

  useEffect(() => {
    if (openMenuId === null) return undefined
    const closeOnOutside = (event) => {
      if (!event.target.closest('[data-account-menu]')) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [openMenuId])

  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('oauth_error')
    if (!connected && !oauthError) return

    const noticeKey = connected ? `connected:${connected}` : `error:${oauthError}`
    if (oauthHandled.current || sessionStorage.getItem(noticeKey)) {
      setSearchParams({}, { replace: true })
      return
    }

    oauthHandled.current = true
    sessionStorage.setItem(noticeKey, '1')
    setSearchParams({}, { replace: true })

    const noticeTimer = window.setTimeout(() => {
      if (connected) {
        setConnectionNotice({ type: 'success', platform: connected, message: `${connected.replace(/_/g, ' ')} connected successfully.` })
        load()
      } else {
        setConnectionNotice({ type: 'error', platform: 'account', message: `Connection failed: ${oauthError}` })
      }
    }, 0)

    return () => window.clearTimeout(noticeTimer)
  }, [load, searchParams, setSearchParams])

  const reconnect = (account) => {
    setConnectDefaults(null)
    if (account.platform === 'bluesky') {
      setConnectDefaults({ directSetup: 'bluesky', blueskyIdentifier: (account.username || '').replace(/^@/, '') })
    }
    setShowConnect(true)
  }

  const disconnect = async () => {
    if (!confirmDisconnect) return
    setDisconnecting(true)
    try {
      await api.delete(`/social/accounts/${confirmDisconnect.id}`)
      setConfirmDisconnect(null)
      load()
    } finally {
      setDisconnecting(false)
    }
  }

  const refresh = async (id) => {
    await api.post(`/social/accounts/${id}/refresh`)
    alert('Token refresh queued.')
  }

  const syncReddit = async (id) => {
    setSyncing(id)
    try {
      const { data } = await api.post(`/social/accounts/${id}/reddit/communities`)
      alert(`${data.data.length} Reddit communities synchronized.`)
      load()
    } catch (error) {
      alert(error.response?.data?.message || 'Could not synchronize Reddit communities.')
    } finally {
      setSyncing(null)
    }
  }

  const toggleComposeVisibility = (event, account) => {
    event.stopPropagation()
    setHiddenComposeIds((current) => {
      const key = String(account.id)
      const next = current.includes(key) ? current.filter((id) => id !== key) : [...current, key]
      saveHiddenComposeAccountIds(next)
      return next
    })
  }

  const visibleAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase()
    return (accounts || [])
      .filter((account) => {
        if (accountStatusFilter === 'all') return true
        if (accountStatusFilter === 'attention') return account.needs_reconnect || account.is_expiring_soon || account.status === 'error'
        return account.status === accountStatusFilter
      })
      .filter((account) => {
        if (!query) return true
        return [
          account.name,
          account.username,
          account.platform,
          account.platform_label,
          account.account_type,
          account.status,
          getAccountConnectedBy(account),
        ].filter(Boolean).join(' ').toLowerCase().includes(query)
      })
  }, [accountSearch, accountStatusFilter, accounts])

  const { hasMore, items: pagedAccounts, sentinelRef } = useInfiniteList(visibleAccounts)

  if (!accounts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Connected accounts</h1>
          <p className="text-sm text-slate-500">Connect and manage all your social profiles.</p>
        </div>
        <Button onClick={() => { setConnectDefaults(null); setShowConnect(true) }}><Plus className="h-4 w-4" /> Connect account</Button>
      </div>

      <Card className="overflow-visible">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full xl:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Search accounts..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {accountSearch && (
              <button type="button" onClick={() => setAccountSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear account search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:justify-end">
            <select
              value={accountStatusFilter}
              onChange={(event) => setAccountStatusFilter(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:w-56"
              aria-label="Filter accounts by status"
            >
              {ACCOUNT_STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <div className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/50 sm:self-auto">
              <ViewButton active={view === 'card'} onClick={() => setView('card')} icon={Grid3X3} label="Card view" />
              <ViewButton active={view === 'table'} onClick={() => setView('table')} icon={Table2} label="Table view" />
            </div>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Plus}
              title="No accounts connected"
              description="Connect your first social account to start scheduling posts."
              action={<Button onClick={() => { setConnectDefaults(null); setShowConnect(true) }}>Connect account</Button>}
            />
          </div>
        ) : visibleAccounts.length === 0 ? (
        <div className="p-8 text-center">
          <p className="font-semibold text-slate-800 dark:text-slate-100">No matching accounts</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try another name, username, platform, or status.</p>
        </div>
        ) : view === 'table' ? (
        <AccountTable
          accounts={pagedAccounts}
          hiddenComposeIds={hiddenComposeIds}
          onOpen={setSelectedAccount}
          onRefresh={refresh}
          onReconnect={reconnect}
          onSyncReddit={syncReddit}
          syncing={syncing}
          onToggleComposeVisibility={toggleComposeVisibility}
          onDisconnect={setConfirmDisconnect}
          openMenuId={openMenuId}
          onToggleMenu={(id) => setOpenMenuId((current) => current === id ? null : id)}
          onCloseMenu={() => setOpenMenuId(null)}
        />
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {pagedAccounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              hidden={hiddenComposeIds.includes(String(acc.id))}
              menuOpen={openMenuId === acc.id}
              syncing={syncing}
              onOpen={setSelectedAccount}
              onRefresh={refresh}
              onReconnect={reconnect}
              onSyncReddit={syncReddit}
              onToggleComposeVisibility={toggleComposeVisibility}
              onDisconnect={setConfirmDisconnect}
              onToggleMenu={(id) => setOpenMenuId((current) => current === id ? null : id)}
              onCloseMenu={() => setOpenMenuId(null)}
            />
          ))}
        </div>
      )}
        {hasMore && <div ref={sentinelRef} className="px-4 pb-5 text-center text-xs font-semibold text-slate-400">Loading more accounts...</div>}
      </Card>

      {showConnect && (
        <AccountConnectModal
          open
          platforms={platforms}
          initialDirectSetup={connectDefaults?.directSetup}
          initialBlueskyIdentifier={connectDefaults?.blueskyIdentifier || ''}
          onClose={() => setShowConnect(false)}
          onConnected={(result) => {
            setConnectionNotice({ type: 'success', platform: result?.platform || 'account', message: `${String(result?.platform || 'Account').replace(/_/g, ' ')} connected successfully.` })
            load()
          }}
        />
      )}

      <ConnectionResultModal notice={connectionNotice} onClose={() => setConnectionNotice(null)} />

      <AccountDetailsModal
        account={selectedAccount}
        hiddenComposeIds={hiddenComposeIds}
        latestPlans={selectedAccount ? latestPlansForAccount(plannerNotes, selectedAccount).slice(0, 5) : []}
        syncing={syncing}
        onClose={() => setSelectedAccount(null)}
        onToggleComposeVisibility={toggleComposeVisibility}
        onRefresh={refresh}
        onReconnect={reconnect}
        onSyncReddit={syncReddit}
        onDisconnect={(account) => {
          setSelectedAccount(null)
          setConfirmDisconnect(account)
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDisconnect)}
        title="Disconnect account"
        description={`Disconnect "${confirmDisconnect?.name || 'this account'}"? Scheduled posts for this profile may stop publishing.`}
        confirmLabel="Disconnect"
        loading={disconnecting}
        onClose={() => setConfirmDisconnect(null)}
        onConfirm={disconnect}
      />
    </div>
  )
}

function AccountStatusBadge({ account }) {
  if (account.status === 'active' && !account.is_expiring_soon) {
    return <Badge color="emerald"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
  }
  if (account.is_expiring_soon) {
    return <Badge color="amber"><AlertTriangle className="mr-1 h-3 w-3" /> Expiring</Badge>
  }
  return <Badge color="rose">{account.status}</Badge>
}

function AccountCard({ account, hidden, menuOpen, syncing, onOpen, onRefresh, onReconnect, onSyncReddit, onToggleComposeVisibility, onDisconnect, onToggleMenu, onCloseMenu }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(account)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(account)
        }
      }}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{account.name}</p>
            <p className="truncate text-xs text-slate-400">{account.username || account.platform_label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AccountStatusBadge account={account} />
          <AccountActionsMenu
            account={account}
            open={menuOpen}
            syncing={syncing}
            onToggle={() => onToggleMenu(account.id)}
            onClose={onCloseMenu}
            onRefresh={onRefresh}
            onReconnect={onReconnect}
            onSyncReddit={onSyncReddit}
            onDisconnect={onDisconnect}
          />
        </div>
      </div>

      {account.needs_reconnect && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {account.reconnect_reason || 'This account needs to be reconnected.'}
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{account.platform_label || account.platform}</p>
        {account.account_type && <p className="text-xs font-medium text-slate-500 dark:text-slate-300">{account.account_type} account</p>}
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <UserRound className="h-3.5 w-3.5" /> Connected by {getAccountConnectedBy(account)}
        </p>
        {account.platform === 'reddit' && (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
            {account.reddit_communities?.length || 0} communities ready
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end">
        <ComposeSwitch checked={!hidden} onChange={(event) => onToggleComposeVisibility(event, account)} label={`${hidden ? 'Show' : 'Hide'} ${account.name} in composer`} />
      </div>
    </article>
  )
}

function AccountTable({ accounts, hiddenComposeIds, onOpen, onRefresh, onReconnect, onSyncReddit, syncing, onToggleComposeVisibility, onDisconnect, openMenuId, onToggleMenu, onCloseMenu }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-900 dark:text-slate-500">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Connected by</th>
              <th className="px-4 py-3">Composer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {accounts.map((account) => {
              const hidden = hiddenComposeIds.includes(String(account.id))
              return (
                <tr key={account.id} role="button" tabIndex={0} onClick={() => onOpen(account)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpen(account)
                  }
                }} className="cursor-pointer transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="md" />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{account.name}</p>
                        <p className="text-xs text-slate-400">{account.username || account.platform_label}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{getAccountConnectedBy(account)}</td>
                  <td className="px-4 py-3">
                    <ComposeSwitch checked={!hidden} onChange={(event) => onToggleComposeVisibility(event, account)} />
                  </td>
                  <td className="px-4 py-3"><AccountStatusBadge account={account} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <AccountActionsMenu
                        account={account}
                        open={openMenuId === account.id}
                        syncing={syncing}
                        onToggle={() => onToggleMenu(account.id)}
                        onClose={onCloseMenu}
                        onRefresh={onRefresh}
                        onReconnect={onReconnect}
                        onSyncReddit={onSyncReddit}
                        onDisconnect={onDisconnect}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
      </table>
    </div>
  )
}

function AccountActionsMenu({ account, open, syncing, onToggle, onClose, onRefresh, onReconnect, onSyncReddit, onDisconnect }) {
  const runAction = (event, action) => {
    event.stopPropagation()
    onClose()
    action()
  }

  return (
    <div data-account-menu className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label="Account actions"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-[170] w-48 rounded-2xl border border-slate-200 bg-white p-1.5 text-sm shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          {account.needs_reconnect ? (
            <button type="button" onClick={(event) => runAction(event, () => onReconnect(account))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              <RefreshCw className="h-4 w-4" /> Reconnect
            </button>
          ) : (
            <button type="button" onClick={(event) => runAction(event, () => onRefresh(account.id))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          )}
          {account.platform === 'reddit' && (
            <button type="button" disabled={syncing === account.id} onClick={(event) => runAction(event, () => onSyncReddit(account.id))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800">
              <RefreshCw className={clsx('h-4 w-4', syncing === account.id && 'animate-spin')} /> Sync communities
            </button>
          )}
          <button type="button" onClick={(event) => runAction(event, () => onDisconnect(account))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

function ComposeSwitch({ checked, onChange, label = 'Toggle composer visibility' }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function AccountDetailsModal({ account, hiddenComposeIds, latestPlans, syncing, onClose, onToggleComposeVisibility, onRefresh, onReconnect, onSyncReddit, onDisconnect }) {
  if (!account) return null
  const hidden = hiddenComposeIds.includes(String(account.id))

  return (
    <Modal open={Boolean(account)} title={account.name || 'Account details'} description="Channel metadata, compose visibility, and linked planning work." onClose={onClose} size="lg">
      <div className="space-y-5 p-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="lg" />
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{account.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{account.username || account.platform_label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <AccountStatusBadge account={account} />
                <Badge color={hidden ? 'amber' : 'emerald'}>{hidden ? 'Hidden from composer' : 'Visible in composer'}</Badge>
              </div>
            </div>
          </div>
          <button type="button" onClick={(event) => onToggleComposeVisibility(event, account)} className={clsx('inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition', hidden ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300')}>
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {hidden ? 'Show in composer' : 'Hide from composer'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Platform" value={account.platform_label || account.platform} />
          <Detail label="Type" value={account.account_type ? `${account.account_type} account` : 'Social account'} />
          <Detail label="Connected by" value={getAccountConnectedBy(account)} />
          <Detail label="Expires" value={account.expires_at ? new Date(account.expires_at).toLocaleString() : 'Not provided'} />
          <Detail label="Account ID" value={account.provider_account_id || account.external_id || account.id} />
          <Detail label="Last sync" value={account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Not synced yet'} />
        </div>

        {account.needs_reconnect && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            {account.reconnect_reason || 'This account needs to be reconnected.'}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="font-semibold text-slate-900 dark:text-white">Latest plans for this account</p>
            <Badge color="indigo">{latestPlans.length}</Badge>
          </div>
          {latestPlans.length === 0 ? (
            <p className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">No linked plans yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {latestPlans.map((plan) => (
                <div key={plan.id} className="flex items-start gap-3 px-4 py-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-semibold text-slate-800 dark:text-slate-100">{plan.title || 'Untitled plan'}</p>
                    <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{stripHtml(plan.content || plan.description || 'No description')}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{formatDate(plan.updated_at || plan.created_at || plan.scheduled_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {account.needs_reconnect ? (
            <Button type="button" variant="secondary" onClick={() => onReconnect(account)}><RefreshCw className="h-4 w-4" /> Reconnect</Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => onRefresh(account.id)}><RefreshCw className="h-4 w-4" /> Refresh token</Button>
          )}
          {account.platform === 'reddit' && (
            <Button type="button" variant="secondary" loading={syncing === account.id} onClick={() => onSyncReddit(account.id)}>Sync communities</Button>
          )}
          <Button type="button" variant="ghost" className="text-rose-500" onClick={() => onDisconnect(account)}><Trash2 className="h-4 w-4" /> Disconnect</Button>
        </div>
      </div>
    </Modal>
  )
}

function ViewButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition focus:outline-none focus:ring-2 focus:ring-brand-500/25',
        active ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-300' : 'text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800',
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{value || 'Not provided'}</p>
    </div>
  )
}

function ConnectionResultModal({ notice, onClose }) {
  if (!notice) return null
  const success = notice.type === 'success'
  const platform = notice.platform || 'account'

  return (
    <Modal
      open={Boolean(notice)}
      title={success ? 'Channel connected' : 'Connection failed'}
      description={success ? 'Your workspace can now use this channel for publishing.' : 'Review the connection details and try again.'}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-5 p-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
          {success ? <AccountIcon platform={platform} size="lg" /> : <AlertTriangle className="h-8 w-8 text-rose-500" />}
        </div>
        <div>
          <p className="text-base font-bold text-slate-900 dark:text-white">
            {success ? `${platform.replace(/_/g, ' ')} is ready` : 'Could not connect account'}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{notice.message}</p>
        </div>
        {success && (
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm dark:border-slate-800 dark:bg-slate-950/40">
            <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100"><Sparkles className="h-4 w-4 text-brand-500" /> Next steps</p>
            <p className="text-slate-500 dark:text-slate-400">Create a post, choose this profile in Publish to, and schedule or publish immediately.</p>
          </div>
        )}
        <div className="flex justify-center">
          <Button type="button" onClick={onClose}>{success ? 'Done' : 'Close'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function loadHiddenComposeAccountIds() {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_COMPOSE_ACCOUNTS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function saveHiddenComposeAccountIds(ids) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(HIDDEN_COMPOSE_ACCOUNTS_KEY, JSON.stringify(ids.map(String)))
}

function getAccountConnectedBy(account) {
  return account.connected_by?.name
    || account.connected_by_name
    || account.user?.name
    || account.owner?.name
    || account.created_by?.name
    || 'Workspace member'
}

function getPlanAccountId(plan) {
  return String(plan.social_account_id || plan.meta?.social_account_id || plan.metadata?.social_account_id || '')
}

function latestPlansForAccount(plannerNotes, account) {
  const accountId = String(account?.id || '')
  return (plannerNotes || [])
    .filter((plan) => getPlanAccountId(plan) === accountId)
    .sort((a, b) => new Date(b.updated_at || b.created_at || b.scheduled_at || 0) - new Date(a.updated_at || a.created_at || a.scheduled_at || 0))
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDate(value) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return date.toLocaleDateString()
}
