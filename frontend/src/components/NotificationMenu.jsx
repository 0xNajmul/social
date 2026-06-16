import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, CircleAlert, CircleCheck, Link2, Loader2 } from 'lucide-react'
import api from '../lib/api'

export default function NotificationMenu({ open, onOpenChange, onSelect }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const menuRef = useRef(null)

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
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (!open) return undefined

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) onOpenChange(false)
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

  const markRead = async (notification) => {
    if (!notification.read_at) {
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
      )))
      setUnreadCount((current) => Math.max(0, current - 1))
      await api.post(`/notifications/${notification.id}/read`).catch(loadNotifications)
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
    await api.post('/notifications/read-all').catch(loadNotifications)
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
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800" role="menu">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
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
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
            >
              Show all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
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
