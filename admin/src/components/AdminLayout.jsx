import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, LayoutDashboard, ListChecks, LogOut, Menu, Package, Settings, ShieldAlert, UserRound, Users, X } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import NotificationMenu from './NotificationMenu'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/plans', label: 'Plans', icon: Package },
  { to: '/workspaces', label: 'Workspaces', icon: Building2 },
  { to: '/jobs', label: 'Jobs & Queue', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const closeMenu = (event) => {
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className={clsx('fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-800 bg-slate-900 transition-transform lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white"><ShieldAlert className="h-5 w-5" /></div>
          <span className="text-lg font-bold text-white">Admin Console</span>
          <button type="button" onClick={() => setSidebarOpen(false)} className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-800 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}>
              <i.icon className="h-5 w-5" /> {i.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3"><button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"><Menu className="h-5 w-5" /></button><span className="text-sm text-slate-400">Platform administration</span></div>
          <div className="flex items-center gap-2">
            <NotificationMenu
              open={notificationOpen}
              onOpenChange={(nextOpen) => {
                setNotificationOpen(nextOpen)
                if (nextOpen) setUserMenuOpen(false)
              }}
            />
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((value) => !value)
                  setNotificationOpen(false)
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-2.5 py-1.5 text-left transition hover:bg-slate-800"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {admin?.avatar_url ? (
                  <img src={admin.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white">
                    {admin?.name?.[0] || 'A'}
                  </span>
                )}
                <span className="hidden max-w-36 truncate text-sm font-medium text-slate-200 sm:block">{admin?.name}</span>
                <ChevronDown className={clsx('hidden h-4 w-4 text-slate-400 transition sm:block', userMenuOpen && 'rotate-180')} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 p-1.5 shadow-xl" role="menu">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-white">{admin?.name}</p>
                    <p className="truncate text-xs text-slate-400">{admin?.email}</p>
                  </div>
                  <div className="my-1 border-t border-slate-700" />
                  <NavLink
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                    role="menuitem"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </NavLink>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-400 transition hover:bg-rose-950/40"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6"><Outlet /></main>
      </div>
    </div>
  )
}
