import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import api from '../lib/api'
import { connectPlatforms, normalizeAccounts } from '../lib/accounts'
import { Card, Button, Badge, PageLoader, EmptyState, Input } from '../components/ui'
import PlatformBadge, { AccountIcon } from '../components/PlatformBadge'

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [accounts, setAccounts] = useState(null)
  const [platforms, setPlatforms] = useState([])
  const [showConnect, setShowConnect] = useState(false)
  const [connecting, setConnecting] = useState(null)
  const [botSetup, setBotSetup] = useState(null) // credential-based connection form
  const [chatId, setChatId] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [blueskyIdentifier, setBlueskyIdentifier] = useState('')

  const load = () => {
    api.get('/social/accounts').then(({ data }) => setAccounts(normalizeAccounts(data.data)))
    api.get('/social/platforms').then(({ data }) => setPlatforms(connectPlatforms(data.data)))
  }
  const oauthHandled = useRef(false)

  useEffect(load, [])

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

    if (connected) {
      alert(`Successfully connected ${connected.replace(/_/g, ' ')}!`)
      load()
    } else {
      alert(`Connection failed: ${oauthError}`)
    }
  }, [searchParams, setSearchParams])

  const connect = async (platform, extra = {}) => {
    setConnecting(platform)
    try {
      const { data } = await api.post('/social/accounts/connect', { platform, ...extra })
      if (data.mode === 'oauth') {
        window.location.assign(data.redirect_url)
      } else {
        setShowConnect(false)
        setBotSetup(null)
        setChatId('')
        setWebhookUrl('')
        setBlueskyIdentifier('')
        alert(`Successfully connected ${platform.replace(/_/g, ' ')}!`)
        load()
      }
    } catch (e) {
      const msg = e.response?.data?.message
      const hint = e.response?.data?.hint
      alert(hint ? `${msg}\n\n${hint}` : msg || 'Could not connect')
    } finally {
      setConnecting(null)
    }
  }

  const pickPlatform = (platform) => {
    if (platform === 'telegram' || platform === 'discord' || platform === 'bluesky') {
      setBotSetup(platform)
      return
    }
    connect(platform)
  }

  const reconnect = (account) => {
    if (account.platform === 'bluesky') {
      setBlueskyIdentifier((account.username || '').replace(/^@/, ''))
      setBotSetup('bluesky')
      setShowConnect(true)
      return
    }

    connect(account.platform)
  }

  const disconnect = async (id) => {
    if (!confirm('Disconnect this account?')) return
    await api.delete(`/social/accounts/${id}`)
    load()
  }

  const refresh = async (id) => {
    await api.post(`/social/accounts/${id}/refresh`)
    alert('Token refresh queued.')
  }

  if (!accounts) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Connected accounts</h1>
          <p className="text-sm text-slate-500">Connect and manage all your social profiles.</p>
        </div>
        <Button onClick={() => setShowConnect(true)}><Plus className="h-4 w-4" /> Connect account</Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No accounts connected"
          description="Connect your first social account to start scheduling posts."
          action={<Button onClick={() => setShowConnect(true)}>Connect account</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <AccountIcon
                    platform={acc.platform}
                    avatarUrl={acc.avatar_url}
                    name={acc.name}
                    size="lg"
                  />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{acc.name}</p>
                    <p className="text-xs text-slate-400">{acc.username}</p>
                  </div>
                </div>
                {acc.status === 'active' && !acc.is_expiring_soon ? (
                  <Badge color="emerald"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
                ) : acc.is_expiring_soon ? (
                  <Badge color="amber"><AlertTriangle className="mr-1 h-3 w-3" /> Expiring</Badge>
                ) : (
                  <Badge color="rose">{acc.status}</Badge>
                )}
              </div>
                {acc.needs_reconnect && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {acc.reconnect_reason || 'This account needs to be reconnected.'}
                  </p>
                )}
              <p className="mt-3 text-xs text-slate-400">{acc.platform_label}</p>
              {acc.account_type && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300">{acc.account_type} account</p>}
              <div className="mt-4 flex gap-2">
                {acc.needs_reconnect ? (
                  <Button size="sm" variant="secondary" onClick={() => reconnect(acc)} loading={connecting === acc.platform}>
                    <RefreshCw className="h-3.5 w-3.5" /> Reconnect
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => refresh(acc.id)}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => disconnect(acc.id)} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Connect modal */}
      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowConnect(false)}>
          <Card className="max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Choose a platform</h2>
              <button onClick={() => setShowConnect(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {platforms.map((p) => (
                <button
                  key={p.key}
                  onClick={() => pickPlatform(p.key)}
                  disabled={connecting === p.key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <PlatformBadge platform={p.key} size="md" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
                </button>
              ))}
            </div>

            {botSetup === 'telegram' && (
              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Telegram channel</p>
                <p className="text-xs text-slate-500">
                  1. Create a bot with @BotFather and set <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">TELEGRAM_BOT_TOKEN</code> in backend/.env<br />
                  2. Add the bot as <strong>admin</strong> of your channel<br />
                  3. Enter the channel username or chat id below
                </p>
                <Input
                  placeholder="@YourChannelName or -1001234567890"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    loading={connecting === 'telegram'}
                    disabled={!chatId.trim()}
                    onClick={() => connect('telegram', { chat_id: chatId.trim() })}
                  >
                    Connect Telegram
                  </Button>
                  <Button variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
                </div>
              </div>
            )}

            {botSetup === 'discord' && (
              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Discord webhook</p>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    loading={connecting === 'discord'}
                    disabled={!webhookUrl.trim()}
                    onClick={() => connect('discord', { webhook_url: webhookUrl.trim() })}
                  >
                    Connect Discord
                  </Button>
                  <Button variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
                </div>
              </div>
            )}

            {botSetup === 'bluesky' && (
              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Bluesky account</p>
                <p className="text-xs text-slate-500">
                  Enter the handle or email belonging to the app password configured in <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">backend/.env</code>.
                </p>
                <Input
                  placeholder="your-handle.bsky.social or account email"
                  value={blueskyIdentifier}
                  onChange={(e) => setBlueskyIdentifier(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    loading={connecting === 'bluesky'}
                    disabled={!blueskyIdentifier.trim()}
                    onClick={() => connect('bluesky', { identifier: blueskyIdentifier.trim() })}
                  >
                    Connect Bluesky
                  </Button>
                  <Button variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
                </div>
              </div>
            )}

            {!botSetup && (
            <p className="mt-4 text-center text-xs text-slate-400">
              OAuth platforms need API keys in backend/.env. Bluesky uses an app password plus your handle.
            </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
