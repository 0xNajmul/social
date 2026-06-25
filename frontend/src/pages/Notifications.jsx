import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, CircleAlert, CircleCheck, Link2 } from 'lucide-react'
import api from '../lib/api'
import { Button, Card, PageLoader } from '../components/ui'
import { NOTIFICATIONS_CHANGED_EVENT, broadcastNotificationsChanged } from '../lib/appEvents'
import useInfiniteList from '../hooks/useInfiniteList'

export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get('/notifications')
      .then(({ data }) => {
        setNotifications(data.data || [])
        setUnreadCount(data.unread_count || 0)
      })
      .catch(() => {
        setNotifications([])
        setUnreadCount(0)
      })
  }, [])

  useEffect(() => {
    load()
    const refresh = (event) => {
      if (typeof event.detail?.unreadCount === 'number') setUnreadCount(event.detail.unreadCount)
      if (event.detail?.reload) load()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
  }, [load])

  const markRead = async (notification) => {
    if (!notification.read_at) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
      const nextUnreadCount = Math.max(0, unreadCount - 1)
      setUnreadCount(nextUnreadCount)
      broadcastNotificationsChanged({ unreadCount: nextUnreadCount })
      await api.post(`/notifications/${notification.id}/read`).catch(load)
      broadcastNotificationsChanged({ unreadCount: nextUnreadCount, reload: true })
    }
    openNotificationTarget(notification, navigate)
  }

  const markAllRead = async () => {
    setBusy(true)
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })))
    setUnreadCount(0)
    broadcastNotificationsChanged({ unreadCount: 0 })
    await api.post('/notifications/read-all').catch(load)
    broadcastNotificationsChanged({ unreadCount: 0, reload: true })
    setBusy(false)
  }

  const { hasMore, items: pagedNotifications, sentinelRef } = useInfiniteList(notifications || [])

  if (!notifications) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All publishing, account, workspace, and system updates in one list.</p>
        </div>
        <Button variant="secondary" onClick={markAllRead} loading={busy} disabled={unreadCount === 0}><CheckCheck className="h-4 w-4" /> Mark all read</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">{unreadCount} unread notifications</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {pagedNotifications.map((notification) => <NotificationRow key={notification.id} notification={notification} onClick={() => markRead(notification)} />)}
          {notifications.length === 0 && (
            <div className="px-6 py-16 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">No notifications yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Updates will appear here when there is activity.</p>
            </div>
          )}
        </div>
        {hasMore && <div ref={sentinelRef} className="px-5 py-4 text-center text-xs font-semibold text-slate-400">Loading more notifications...</div>}
      </Card>
    </div>
  )
}

function openNotificationTarget(notification, navigate) {
  const data = notification.data || {}
  const type = data.type || ''
  if (type === 'workspace.invitation' && data.invitation_token) {
    navigate(`/invitations/${data.invitation_token}`)
  } else if (type.startsWith('post.') && data.post_id) {
    window.dispatchEvent(new CustomEvent('postflow:open-post', { detail: { id: data.post_id } }))
  } else if (type.startsWith('post.')) {
    navigate('/app/organizer')
  } else if (type === 'account.token_expiring') {
    navigate('/app/accounts')
  }
}

function NotificationRow({ notification, onClick }) {
  const data = notification.data || {}
  const type = data.type || notification.type || ''
  const unread = !notification.read_at
  const Icon = type.includes('failed') ? CircleAlert : type.includes('published') ? CircleCheck : type.includes('token') ? Link2 : Bell
  const iconClass = type.includes('failed')
    ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
    : type.includes('published')
      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
      : type.includes('token')
        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'

  return (
    <button type="button" onClick={onClick} className={`flex w-full gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${unread ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={`text-sm ${unread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>{data.title || 'Notification'}</span>
          {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
        </span>
        <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">{data.message || 'You have a new update.'}</span>
        <span className="mt-2 block text-xs font-medium text-slate-400">{relativeTime(notification.created_at)}</span>
      </span>
    </button>
  )
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}
