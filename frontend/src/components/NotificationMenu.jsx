import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, CircleAlert, CircleCheck, Link2, Loader2, X } from 'lucide-react'
import api from '../lib/api'
import { NOTIFICATIONS_CHANGED_EVENT, broadcastNotificationsChanged } from '../lib/appEvents'

export default function NotificationMenu({ open, onOpenChange, onSelect }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [desktopPosition, setDesktopPosition] = useState({ top: 0, right: 16 })
  const menuRef = useRef(null)
  const desktopPanelRef = useRef(null)
  const mobilePanelRef = useRef(null)

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.data || [])
      setUnreadCount(data.unread_count || 0)
    } catch {
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(loadNotifications, 0)
    const interval = window.setInterval(loadNotifications, 60000)
    const refresh = (event) => {
      if (typeof event.detail?.unreadCount === 'number') setUnreadCount(event.detail.unreadCount)
      if (event.detail?.notifications) setNotifications(event.detail.notifications)
      if (event.detail?.reload) loadNotifications()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (!open) return undefined

    const closeMenu = (event) => {
      const inButton = menuRef.current?.contains(event.target)
      const inDesktopPanel = desktopPanelRef.current?.contains(event.target)
      const inMobilePanel = mobilePanelRef.current?.contains(event.target)
      if (!inButton && !inDesktopPanel && !inMobilePanel) onOpenChange(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return undefined

    const updatePosition = () => {
      const rect = menuRef.current?.getBoundingClientRect()
      if (!rect) return
      setDesktopPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const markRead = async (notification) => {
    if (!notification.read_at) {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      )))
      const nextUnreadCount = Math.max(0, unreadCount - 1)
      setUnreadCount(nextUnreadCount)
      broadcastNotificationsChanged({ unreadCount: nextUnreadCount })
      await api.post(`/notifications/${notification.id}/read`).catch(loadNotifications)
      broadcastNotificationsChanged({ unreadCount: nextUnreadCount, reload: true })
    }
    onOpenChange(false)
    onSelect?.(notification)
  }

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({
      ...item,
      read_at: item.read_at || new Date().toISOString(),
    })))
    setUnreadCount(0)
    broadcastNotificationsChanged({ unreadCount: 0 })
    await api.post('/notifications/read-all').catch(loadNotifications)
    broadcastNotificationsChanged({ unreadCount: 0, reload: true })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          onOpenChange(!open)
          if (!open) loadNotifications()
        }}
        className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {typeof document !== 'undefined' && createPortal(
            <div
              ref={desktopPanelRef}
              className="fixed z-[170] hidden max-h-[calc(100vh-5rem)] w-[min(22rem,calc(100vw_-_2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:flex"
              style={{ top: desktopPosition.top, right: desktopPosition.right }}
              role="menu"
            >
              <NotificationPanel
                loading={loading}
                markAllRead={markAllRead}
                markRead={markRead}
                notifications={notifications}
                onClose={() => onOpenChange(false)}
                unreadCount={unreadCount}
              />
            </div>,
            document.body,
          )}
          {typeof document !== 'undefined' && createPortal(
            <div ref={mobilePanelRef} className="fixed inset-0 z-[170] flex flex-col overflow-hidden bg-white shadow-xl dark:bg-slate-800 sm:hidden" role="menu">
            <NotificationPanel
              loading={loading}
              markAllRead={markAllRead}
              markRead={markRead}
              mobile
              notifications={notifications}
              onClose={() => onOpenChange(false)}
              unreadCount={unreadCount}
            />
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}

function NotificationPanel({ loading, markAllRead, markRead, mobile = false, notifications, onClose, unreadCount }) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
          {mobile && (
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Close notifications">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto sm:max-h-96">
        {loading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-600" /></div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">No notifications yet</p>
            <p className="mt-1 text-xs text-slate-400">Publishing and account updates will appear here.</p>
          </div>
        ) : notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onClick={() => markRead(notification)} />
        ))}
      </div>
      <div className="border-t border-slate-100 p-2 dark:border-slate-700">
        <Link
          to="/app/notifications"
          onClick={onClose}
          className="flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
        >
          Show all notifications
        </Link>
      </div>
    </>
  )
}

function NotificationItem({ notification, onClick }) {
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
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/70 ${unread ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}
      role="menuitem"
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`text-sm ${unread ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>{data.title || 'Notification'}</span>
          {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{data.message || 'You have a new update.'}</span>
        <span className="mt-1 block text-[10px] font-medium text-slate-400">{relativeTime(notification.created_at)}</span>
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
