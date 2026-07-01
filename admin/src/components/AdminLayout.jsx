import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, BarChart3, Bell, Bot, Building2, ChevronDown, CircleUserRound, ClipboardList,
  FilePlus2, History, Image, LayoutDashboard, ListChecks, LogOut, Mail, Menu, Moon,
  Newspaper, Package, Plus, ReceiptText, Rss, Settings, ShieldAlert, Send, Sun, UserCog, UserRound,
  Users, WalletCards, Workflow, X,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../lib/api'
import NotificationMenu from './NotificationMenu'
import PanelSearch from './PanelSearch'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    label: 'Users',
    icon: Users,
    children: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/roles', label: 'Roles', icon: UserCog },
    ],
  },
  { to: '/posts', label: 'Posts', icon: Send },
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/planners', label: 'Planners', icon: ClipboardList },
  { to: '/media', label: 'Media Library', icon: Image },
  { to: '/automations', label: 'Automations', icon: Workflow },
  { to: '/accounts', label: 'Accounts', icon: CircleUserRound },
  { to: '/plans', label: 'Plans', icon: Package },
  { to: '/workspaces', label: 'Workspaces', icon: Building2 },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { to: '/reports/notifications', label: 'Notifications', icon: Bell },
      { to: '/reports/affiliate-incomes', label: 'Affiliate incomes', icon: WalletCards },
      { to: '/reports/login-history', label: 'Login history', icon: History },
      { to: '/reports/ai-usage', label: 'AI usage', icon: Bot },
      { to: '/reports/email-history', label: 'Email history', icon: Mail },
      { to: '/reports/user-transaction-history', label: 'User transaction history', icon: ReceiptText },
      { to: '/reports/activity-logs', label: 'Activity logs', icon: Activity },
    ],
  },
  { to: '/jobs', label: 'Jobs & Queue', icon: ListChecks },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const QUICK_ACTIONS = [
  { to: '/users', label: 'Add user', icon: Users },
  { to: '/roles', label: 'New role', icon: UserCog },
  { to: '/posts', label: 'Review posts', icon: Send },
  { to: '/news', label: 'Add news', icon: Newspaper },
  { to: '/plans', label: 'New plan', icon: Package },
  { to: '/workspaces', label: 'New workspace', icon: Building2 },
  { to: '/settings/general', label: 'Update settings', icon: Settings },
]

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('postflow_admin_sidebar_hidden') === 'true')
  const [branding, setBranding] = useState(null)
  const [navOpen, setNavOpen] = useState({})
  const userMenuRef = useRef(null)
  const quickMenuRef = useRef(null)

  useEffect(() => {
    const closeMenu = (event) => {
      if (!userMenuRef.current?.contains(event.target)) setUserMenuOpen(false)
      if (!quickMenuRef.current?.contains(event.target)) setQuickOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
        setQuickOpen(false)
      }
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    api.get('/public/settings').then(({ data }) => setBranding(data)).catch(() => setBranding(null))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  const toggleSidebar = () => {
    setSidebarHidden((hidden) => {
      const next = !hidden
      localStorage.setItem('postflow_admin_sidebar_hidden', String(next))
      return next
    })
  }
  const brandName = branding?.general?.site_name || branding?.platform_name || 'Postflow'
  const logoUrl = branding?.general?.logo_url
  const lightMode = theme === 'light'

  return (
    <div className={clsx('min-h-screen', lightMode ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100')}>
      <aside className={clsx('fixed inset-y-0 left-0 z-40 w-64 transform border-r transition-transform', lightMode ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900', sidebarOpen && !sidebarHidden ? 'translate-x-0' : '-translate-x-full', sidebarHidden ? 'lg:-translate-x-full' : 'lg:translate-x-0')}>
        <div className={clsx('flex h-16 items-center gap-2 border-b px-5', lightMode ? 'border-slate-200' : 'border-slate-800')}>
          <BrandMark logoUrl={logoUrl} />
          <span className={clsx('min-w-0 text-lg font-bold', lightMode ? 'text-slate-950' : 'text-white')}><span className="truncate">{brandName}</span> <span className="text-slate-400">Admin</span></span>
          <button type="button" onClick={() => setSidebarOpen(false)} className={clsx('ml-auto rounded-lg p-1 text-slate-400 lg:hidden', lightMode ? 'hover:bg-slate-100 hover:text-slate-700' : 'hover:bg-slate-800')}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => item.children ? (
            <SidebarGroup
              key={item.label}
              item={item}
              open={navOpen[item.label]}
              active={item.children.some((child) => isRouteActive(location.pathname, child))}
              lightMode={lightMode}
              onToggle={() => setNavOpen((current) => current[item.label] ? {} : { [item.label]: true })}
              onSelect={() => setSidebarOpen(false)}
            />
          ) : (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-600 text-white' : lightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}>
              <item.icon className="h-5 w-5" /> {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && !sidebarHidden && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className={clsx('transition-[padding] duration-200', sidebarHidden ? 'lg:pl-0' : 'lg:pl-64')}>
        <header className={clsx('sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6', lightMode ? 'border-slate-200 bg-white/85' : 'border-slate-800 bg-slate-900/80')}>
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) toggleSidebar()
                else {
                  setSidebarHidden(false)
                  setSidebarOpen(true)
                }
              }}
              className={clsx('rounded-lg p-2 transition', lightMode ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-300 hover:bg-slate-800')}
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <PanelSearch className="hidden max-w-xl flex-1 md:block" />

          <div className="flex items-center gap-2">
            <div className="relative" ref={quickMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setQuickOpen((open) => !open)
                  setNotificationOpen(false)
                  setUserMenuOpen(false)
                }}
                className={clsx('inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition', lightMode ? 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50' : 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700')}
                aria-expanded={quickOpen}
                aria-haspopup="menu"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New</span>
                <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition', quickOpen && 'rotate-180')} />
              </button>
              {quickOpen && (
                  <div className={clsx('absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border p-1.5 shadow-xl', lightMode ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800')} role="menu">
                    <div className="px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Create or manage</p>
                    </div>
                  {QUICK_ACTIONS.map((action, index) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        setQuickOpen(false)
                        navigate(action.to)
                      }}
                      className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', lightMode ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-700', index > 0 && (lightMode ? 'border-t border-slate-100' : 'border-t border-slate-700/60'))}
                      role="menuitem"
                    >
                      <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', lightMode ? 'bg-brand-50 text-brand-600' : 'bg-slate-700 text-brand-300')}><action.icon className="h-4 w-4" /></span>
                      {action.label}
                      <FilePlus2 className="ml-auto h-4 w-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggle}
              className={clsx('rounded-xl p-2 transition', lightMode ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100')}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationMenu
              open={notificationOpen}
              onOpenChange={(nextOpen) => {
                setNotificationOpen(nextOpen)
                if (nextOpen) {
                  setUserMenuOpen(false)
                  setQuickOpen(false)
                }
              }}
            />
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((value) => !value)
                  setNotificationOpen(false)
                  setQuickOpen(false)
                }}
                className={clsx('flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition', lightMode ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800')}
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
                <span className={clsx('hidden max-w-36 truncate text-sm font-medium sm:block', lightMode ? 'text-slate-700' : 'text-slate-200')}>{admin?.name}</span>
                <ChevronDown className={clsx('hidden h-4 w-4 text-slate-400 transition sm:block', userMenuOpen && 'rotate-180')} />
              </button>

              {userMenuOpen && (
                <div className={clsx('absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border p-1.5 shadow-xl', lightMode ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800')} role="menu">
                  <div className="px-3 py-2">
                    <p className={clsx('truncate text-sm font-semibold', lightMode ? 'text-slate-900' : 'text-white')}>{admin?.name}</p>
                    <p className="truncate text-xs text-slate-400">{admin?.email}</p>
                  </div>
                  <div className={clsx('my-1 border-t', lightMode ? 'border-slate-100' : 'border-slate-700')} />
                  <NavLink
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className={clsx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition', lightMode ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-700')}
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
        <main className="w-full px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  )
}

function BrandMark({ logoUrl }) {
  if (logoUrl) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
      </span>
    )
  }

  return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white"><ShieldAlert className="h-5 w-5" /></div>
}

function SidebarGroup({ item, open, active, lightMode, onToggle, onSelect }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', active ? (lightMode ? 'bg-brand-50 text-brand-700' : 'bg-slate-800 text-white') : lightMode ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}
      >
        <item.icon className="h-5 w-5" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-4">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onSelect}
              className={({ isActive }) => clsx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-600 text-white' : lightMode ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-950' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200')}
            >
              <child.icon className="h-4 w-4" />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function isRouteActive(pathname, item) {
  if (item.to === '/') return pathname === '/'
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
