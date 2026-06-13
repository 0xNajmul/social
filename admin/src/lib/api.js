import axios from 'axios'

const api = axios.create({ baseURL: '/api', headers: { Accept: 'application/json' } })

export const tokenStore = {
  get: () => localStorage.getItem('admin_token'),
  set: (t) => localStorage.setItem('admin_token', t),
  clear: () => localStorage.removeItem('admin_token'),
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !location.pathname.startsWith('/login')) {
      tokenStore.clear()
      location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
