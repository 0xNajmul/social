import { useEffect, useMemo, useState } from 'react'
import { Search, Share2, X } from 'lucide-react'
import api from '../../lib/api'
import { connectPlatforms } from '../../lib/accounts'
import { Button, Input, Modal } from '../ui'
import PlatformBadge from '../PlatformBadge'

export default function AccountConnectModal({
  open,
  platforms,
  initialDirectSetup = null,
  initialBlueskyIdentifier = '',
  onClose,
  onConnected,
}) {
  const [loadedPlatforms, setLoadedPlatforms] = useState([])
  const [connecting, setConnecting] = useState(null)
  const [botSetup, setBotSetup] = useState(initialDirectSetup)
  const [chatId, setChatId] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [blueskyIdentifier, setBlueskyIdentifier] = useState(initialBlueskyIdentifier)
  const [whatsAppPhoneNumberId, setWhatsAppPhoneNumberId] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open || platforms) return
    api.get('/social/platforms')
      .then(({ data }) => setLoadedPlatforms(connectPlatforms(data.data || [])))
      .catch(() => setLoadedPlatforms([]))
  }, [open, platforms])

  const platformOptions = useMemo(() => platforms || loadedPlatforms, [loadedPlatforms, platforms])
  const visiblePlatformOptions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return platformOptions
    return platformOptions.filter((platform) => [
      platform.label,
      platform.key,
      platform.group,
      ...(platform.capabilities || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(query))
  }, [platformOptions, search])

  const close = () => {
    setBotSetup(null)
    setChatId('')
    setWebhookUrl('')
    setBlueskyIdentifier('')
    setWhatsAppPhoneNumberId('')
    setMessage('')
    setSearch('')
    onClose?.()
  }

  const connect = async (platform, extra = {}) => {
    setConnecting(platform)
    setMessage('')
    try {
      const { data } = await api.post('/social/accounts/connect', { platform, ...extra })
      if (data.mode === 'oauth') {
        window.location.assign(data.redirect_url)
        return
      }
      onConnected?.({ ...data, platform })
      close()
    } catch (error) {
      const msg = error.response?.data?.message
      const hint = error.response?.data?.hint
      setMessage(hint ? `${msg}\n\n${hint}` : msg || 'Could not connect this account.')
    } finally {
      setConnecting(null)
    }
  }

  const pickPlatform = (platform) => {
    setMessage('')
    if (platform === 'telegram' || platform === 'discord' || platform === 'bluesky' || platform === 'whatsapp') {
      setBotSetup(platform)
      return
    }
    connect(platform)
  }

  return (
    <Modal open={open} title="Choose a platform" description="Connect a social profile, page, channel, or community to this workspace." onClose={close} size="lg">
      <div className="space-y-5 p-5">
        {message && <div className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}

        {!botSetup && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Facebook, YouTube, Telegram..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Clear platform search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visiblePlatformOptions.map((platform) => (
            <button
              key={platform.key}
              type="button"
              onClick={() => pickPlatform(platform.key)}
              disabled={connecting === platform.key}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <PlatformBadge platform={platform.key} size="md" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{platform.label}</span>
            </button>
          ))}
          {visiblePlatformOptions.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No platforms match your search.
            </div>
          )}
        </div>

        {botSetup === 'telegram' && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Telegram channel</p>
            <p className="text-xs leading-5 text-slate-500">
              Create a bot with @BotFather, add the bot as an admin of your channel, then enter the channel username or chat id.
            </p>
            <Input
              placeholder="@YourChannelName or -1001234567890"
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                loading={connecting === 'telegram'}
                disabled={!chatId.trim()}
                onClick={() => connect('telegram', { chat_id: chatId.trim() })}
              >
                <Share2 className="h-4 w-4" /> Connect Telegram
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
            </div>
          </div>
        )}

        {botSetup === 'discord' && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Discord webhook</p>
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                loading={connecting === 'discord'}
                disabled={!webhookUrl.trim()}
                onClick={() => connect('discord', { webhook_url: webhookUrl.trim() })}
              >
                <Share2 className="h-4 w-4" /> Connect Discord
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
            </div>
          </div>
        )}

        {botSetup === 'bluesky' && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Bluesky account</p>
            <p className="text-xs leading-5 text-slate-500">Enter the handle or email belonging to the configured Bluesky app password.</p>
            <Input
              placeholder="your-handle.bsky.social or account email"
              value={blueskyIdentifier}
              onChange={(event) => setBlueskyIdentifier(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                loading={connecting === 'bluesky'}
                disabled={!blueskyIdentifier.trim()}
                onClick={() => connect('bluesky', { identifier: blueskyIdentifier.trim() })}
              >
                <Share2 className="h-4 w-4" /> Connect Bluesky
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
            </div>
          </div>
        )}

        {botSetup === 'whatsapp' && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">WhatsApp Business phone number</p>
            <p className="text-xs leading-5 text-slate-500">Enter the phone number ID from Meta Business Manager. The server uses the configured WhatsApp access token to verify it.</p>
            <Input
              placeholder="123456789012345"
              value={whatsAppPhoneNumberId}
              onChange={(event) => setWhatsAppPhoneNumberId(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                loading={connecting === 'whatsapp'}
                disabled={!whatsAppPhoneNumberId.trim()}
                onClick={() => connect('whatsapp', { phone_number_id: whatsAppPhoneNumberId.trim() })}
              >
                <Share2 className="h-4 w-4" /> Connect WhatsApp
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBotSetup(null)}>Back</Button>
            </div>
          </div>
        )}

        {!botSetup && (
          <p className="text-center text-xs text-slate-400">
            OAuth platforms need API keys in backend/.env. Bluesky uses an app password, and WhatsApp uses a Cloud API token plus phone number ID.
          </p>
        )}
      </div>
    </Modal>
  )
}
