export const DATA_CHANGED_EVENT = 'postflow:data-changed'
export const NOTIFICATIONS_CHANGED_EVENT = 'postflow:notifications-changed'

export function broadcastDataChanged(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail }))
}

export function broadcastNotificationsChanged(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail }))
}
