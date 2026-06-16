/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { tokenStore, workspaceStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/me')
      setUser(data.user)
      setWorkspaces(data.workspaces)
      const slug = workspaceStore.get() || data.workspaces[0]?.slug
      if (slug) {
        workspaceStore.set(slug)
        setActiveWorkspace(data.workspaces.find((w) => w.slug === slug) || data.workspaces[0])
      } else {
        workspaceStore.clear()
        setActiveWorkspace(null)
      }
    } catch {
      tokenStore.clear()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe()
  }, [loadMe])

  const login = async (email, password) => {
    const { data } = await api.post('/login', { email, password })
    tokenStore.set(data.token)
    await loadMe()
    return data.user
  }

  const register = async (payload) => {
    const { data } = await api.post('/register', payload)
    tokenStore.set(data.token)
    await loadMe()
    return data.user
  }

  const logout = async () => {
    try { await api.post('/logout') } catch { /* ignore */ }
    tokenStore.clear()
    workspaceStore.clear()
    setUser(null)
    setWorkspaces([])
    setActiveWorkspace(null)
  }

  const switchWorkspace = async (slug) => {
    workspaceStore.set(slug)
    const ws = workspaces.find((w) => w.slug === slug)
    setActiveWorkspace(ws)
    await api.post(`/workspaces/${slug}/switch`).catch(() => {})
  }

  return (
    <AuthContext.Provider
      value={{ user, workspaces, activeWorkspace, loading, login, register, logout, switchWorkspace, reload: loadMe }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
