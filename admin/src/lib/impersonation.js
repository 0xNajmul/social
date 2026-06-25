const USER_FRONTEND_URL = (import.meta.env.VITE_USER_FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

export function impersonationUrl(token) {
  return `${USER_FRONTEND_URL}/impersonate?token=${encodeURIComponent(token)}`
}
