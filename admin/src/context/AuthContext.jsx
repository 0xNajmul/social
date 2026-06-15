import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { tokenStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) { setLoading(false); return }
    try {
      const { data } = await api.get('/me')
      if (data.user.is_admin) setAdmin(data.user)
      else tokenStore.clear()
    } catch { tokenStore.clear() }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  const login = async (email, password) => {
    const { data } = await api.post('/login', { email, password })
    if (!data.user.is_admin) {
      throw new Error('This account does not have administrator access.')
    }
    tokenStore.set(data.token)
    setAdmin(data.user)
    return data.user
  }

  const logout = async () => {
    try { await api.post('/logout') } catch { /* ignore */ }
    tokenStore.clear()
    setAdmin(null)
  }

  return <AuthContext.Provider value={{ admin, loading, login, logout, reload: loadMe }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
