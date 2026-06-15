import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PenSquare, CalendarDays, Image, Share2, Workflow,
  BarChart3, Users, CreditCard, Settings, Code2, Moon, Sun, LogOut,
  Menu, ChevronDown, Sparkles, UserRound, ClipboardList,
  Building2, Gift,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import NotificationMenu from './NotificationMenu'
import PanelSearch from './PanelSearch'
import QuickActions from './QuickActions'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/composer', label: 'Composer', icon: PenSquare },
  { to: '/app/organizer', label: 'Organizer', icon: CalendarDays },
  { to: '/app/planner', label: 'Planner', icon: ClipboardList },
  { to: '/app/accounts', label: 'Accounts', icon: Share2 },
  { to: '/app/media', label: 'Media Library', icon: Image },
  { to: '/app/automations', label: 'Automations', icon: Workflow },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
]

const ACCOUNT_NAV = [
  { to: '/app/profile', label: 'Profile', icon: UserRound },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/pricing-plan', label: 'Pricing plan', icon: CreditCard },
  { to: '/app/invite', label: 'Invite & earn', icon: Gift },
  { to: '/app/workspaces', label: 'Workspaces', icon: Building2 },
  { to: '/app/team', label: 'Team', icon: Users },
  { to: '/app/developer', label: 'Developer', icon: Code2 },
]

export default function DashboardLayout() {
  const { user, activeWorkspace, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('postflow_sidebar_hidden') === 'true')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarUserMenuOpen, setSidebarUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const userMenuRef = useRef(null)
  const sidebarUserMenuRef = useRef(null)

  useEffect(() => {
    const closeMenu = (event) => {
      const inHeaderMenu = userMenuRef.current?.contains(event.target)
      const inSidebarMenu = sidebarUserMenuRef.current?.contains(event.target)
      if (!inHeaderMenu) setUserMenuOpen(false)
      if (!inSidebarMenu) setSidebarUserMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
        setSidebarUserMenuOpen(false)
      }
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
  const currentPlan = activeWorkspace?.subscription?.plan?.name || activeWorkspace?.subscription?.plan_name || 'Free plan'
  const toggleSidebar = () => {
    setSidebarHidden((hidden) => {
      const next = !hidden
      localStorage.setItem('postflow_sidebar_hidden', String(next))
      return next
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900',
          open && !sidebarHidden ? 'translate-x-0' : '-translate-x-full',
          sidebarHidden ? 'lg:-translate-x-full' : 'lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Postflow</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
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

        <div className="relative border-t border-slate-200 p-3 dark:border-slate-800" ref={sidebarUserMenuRef}>
          {sidebarUserMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="menu">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              {ACCOUNT_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                    setSidebarUserMenuOpen(false)
                    setOpen(false)
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  role="menuitem"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
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
          <button
            type="button"
            onClick={() => {
              setSidebarUserMenuOpen((value) => !value)
              setUserMenuOpen(false)
              setNotificationOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-left transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800"
            aria-expanded={sidebarUserMenuOpen}
            aria-haspopup="menu"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white">
                {user?.name?.[0] || 'U'}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name || 'User'}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{currentPlan}</span>
            </span>
            <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition', sidebarUserMenuOpen && 'rotate-180')} />
          </button>
        </div>
      </aside>

      {open && !sidebarHidden && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className={clsx('transition-[padding] duration-200', sidebarHidden ? 'lg:pl-0' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 md:w-56">
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) toggleSidebar()
                else {
                  setSidebarHidden(false)
                  setOpen(true)
                }
              }}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <PanelSearch className="hidden max-w-xl flex-1 md:block" />

          <div className="flex items-center gap-2">
            <QuickActions />
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
                  setSidebarUserMenuOpen(false)
                }
              }}
              onSelect={(notification) => {
                const type = notification.data?.type || ''
                if (type.startsWith('post.')) navigate('/app/organizer')
                if (type === 'account.token_expiring') navigate('/app/accounts')
              }}
            />
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((value) => !value)
                  setSidebarUserMenuOpen(false)
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
                    <p className="mt-1 max-w-full truncate text-xs font-medium text-brand-600 dark:text-brand-300" title={activeWorkspace?.name || 'Workspace'}>
                      {activeWorkspace?.name || 'Workspace'}
                    </p>
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
                  <NavLink
                    to="/app/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    role="menuitem"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </NavLink>
                  <NavLink
                    to="/app/pricing-plan"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    role="menuitem"
                  >
                    <CreditCard className="h-4 w-4" />
                    Pricing plan
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
