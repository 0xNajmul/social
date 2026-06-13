import axios from 'axios'

/**
 * Central axios instance. Attaches the bearer token and active workspace slug
 * to every request, and redirects to /login on 401.
 */
const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

export const tokenStore = {
  get: () => localStorage.getItem('token'),
  set: (t) => localStorage.setItem('token', t),
  clear: () => localStorage.removeItem('token'),
}

export const workspaceStore = {
  get: () => localStorage.getItem('workspace'),
  set: (w) => localStorage.setItem('workspace', w),
  clear: () => localStorage.removeItem('workspace'),
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`

  const ws = workspaceStore.get()
  if (ws) config.headers['X-Workspace'] = ws

  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      tokenStore.clear()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
