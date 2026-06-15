import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PenSquare, CalendarDays, Image, Share2, Workflow,
  BarChart3, Users, CreditCard, Settings, Code2, Moon, Sun, LogOut,
  Menu, ChevronDown, Sparkles, UserRound, ClipboardList,
  Building2,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import NotificationMenu from './NotificationMenu'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/workspaces', label: 'Workspaces', icon: Building2 },
  { to: '/app/composer', label: 'Composer', icon: PenSquare },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/planner', label: 'Planner', icon: ClipboardList },
  { to: '/app/accounts', label: 'Accounts', icon: Share2 },
  { to: '/app/media', label: 'Media Library', icon: Image },
  { to: '/app/automations', label: 'Automations', icon: Workflow },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/team', label: 'Team', icon: Users },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
  { to: '/app/developer', label: 'Developer', icon: Code2 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout() {
  const { user, activeWorkspace, workspaces, switchWorkspace, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [wsOpen, setWsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Postflow</span>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
          </button>

          {/* Workspace switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setWsOpen((value) => !value)
                setUserMenuOpen(false)
                setNotificationOpen(false)
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {activeWorkspace?.name?.[0] || 'W'}
              </span>
              {activeWorkspace?.name || 'Workspace'}
              <ChevronDown className="h-4 w-4" />
            </button>
            {wsOpen && (
              <div className="absolute left-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { switchWorkspace(w.slug); setWsOpen(false); window.location.reload() }}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700',
                      w.slug === activeWorkspace?.slug ? 'font-semibold text-brand-600' : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {w.name}
                    {w.on_trial && <span className="text-[10px] uppercase text-amber-500">trial</span>}
                  </button>
                ))}
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <NavLink
                  to="/app/workspaces"
                  onClick={() => setWsOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Building2 className="h-4 w-4" /> Manage workspaces
                </NavLink>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationMenu
              open={notificationOpen}
              onOpenChange={(nextOpen) => {
                setNotificationOpen(nextOpen)
                if (nextOpen) {
                  setUserMenuOpen(false)
                  setWsOpen(false)
                }
              }}
              onSelect={(notification) => {
                const type = notification.data?.type || ''
                if (type.startsWith('post.')) navigate('/app/calendar')
                if (type === 'account.token_expiring') navigate('/app/accounts')
              }}
            />
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((value) => !value)
                  setWsOpen(false)
                  setNotificationOpen(false)
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white">
                    {user?.name?.[0] || 'U'}
                  </span>
                )}
                <span className="hidden max-w-36 truncate text-sm font-medium text-slate-700 dark:text-slate-200 sm:block">{user?.name}</span>
                <ChevronDown className={clsx('hidden h-4 w-4 text-slate-400 transition sm:block', userMenuOpen && 'rotate-180')} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800" role="menu">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  </div>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  <NavLink
                    to="/app/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    role="menuitem"
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </NavLink>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
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

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
