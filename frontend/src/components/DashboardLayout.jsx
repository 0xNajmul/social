import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  LayoutDashboard, PenSquare, CalendarDays, Image, CircleUserRound, Workflow,
  BarChart3, CreditCard, Settings, Code2, Moon, Sun, LogOut,
  Menu, ChevronDown, ChevronRight, Sparkles, UserRound, ClipboardList,
  Building2, Gift, X, PlugZap, Rss,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../lib/api'
import { Button, EmptyState } from './ui'
import NotificationMenu from './NotificationMenu'
import PanelSearch from './PanelSearch'
import QuickActions from './QuickActions'
import WorkspaceCreateModal from './workspaces/WorkspaceCreateModal'
import PostDetailsModal from './posts/PostDetailsModal'
import { NOTIFICATIONS_CHANGED_EVENT } from '../lib/appEvents'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/feed', label: 'Feed', icon: Rss },
  { to: '/app/organizer', label: 'Organizer', icon: CalendarDays },
  { to: '/app/posts', label: 'Posts', icon: PenSquare },
  { to: '/app/planner', label: 'Planner', icon: ClipboardList },
  { to: '/app/accounts', label: 'Accounts', icon: CircleUserRound },
  { to: '/app/media', label: 'Media Library', icon: Image },
  { to: '/app/automations', label: 'Automations', icon: Workflow },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
]

const MOBILE_NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/organizer', label: 'Organizer', icon: CalendarDays },
  { to: '/app/posts', label: 'Posts', icon: PenSquare },
  { to: '/app/planner', label: 'Planner', icon: ClipboardList },
  { to: '/app/analytics', label: 'Analysis', icon: BarChart3 },
]

const ACCOUNT_NAV = [
  { key: 'profile', to: '/app/profile', label: 'Profile', icon: UserRound },
  { key: 'settings', to: '/app/settings', label: 'Settings', icon: Settings },
  { key: 'pricing', to: '/app/pricing-plan', label: 'Pricing plan', icon: CreditCard },
  { key: 'invite', to: '/app/invite', label: 'Invite & earn', icon: Gift },
  { key: 'workspaces', type: 'workspaces' },
  { key: 'integrations', to: '/app/integrations', label: 'Integrations', icon: PlugZap },
  { key: 'developer', to: '/app/developer', label: 'Developer', icon: Code2 },
]

export default function DashboardLayout() {
  const { user, workspaces, activeWorkspace, switchWorkspace, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('postflow_sidebar_hidden') === 'true')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarUserMenuOpen, setSidebarUserMenuOpen] = useState(false)
  const [workspaceSetupOpen, setWorkspaceSetupOpen] = useState(true)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [branding, setBranding] = useState(null)
  const [userMenuPosition, setUserMenuPosition] = useState({ top: 0, right: 16 })
  const [postPopup, setPostPopup] = useState({ id: null, item: null })
  const userMenuRef = useRef(null)
  const userMenuPanelRef = useRef(null)
  const sidebarUserMenuRef = useRef(null)

  useEffect(() => {
    const closeMenu = (event) => {
      const inHeaderMenu = userMenuRef.current?.contains(event.target) || userMenuPanelRef.current?.contains(event.target)
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
    const closeAfterGuardedNavigation = () => {
      setOpen(false)
      setUserMenuOpen(false)
      setSidebarUserMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('postflow:navigation-confirmed', closeAfterGuardedNavigation)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('postflow:navigation-confirmed', closeAfterGuardedNavigation)
    }
  }, [])

  useEffect(() => {
    const openPost = (event) => {
      const item = event.detail?.item || null
      const id = event.detail?.id || item?.id
      if (!id) return
      setPostPopup({ id, item })
    }

    window.addEventListener('postflow:open-post', openPost)
    return () => window.removeEventListener('postflow:open-post', openPost)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) return undefined

    const updatePosition = () => {
      const rect = userMenuRef.current?.getBoundingClientRect()
      if (!rect) return
      setUserMenuPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [userMenuOpen])

  useEffect(() => {
    const loadCount = () => api.get('/notifications').then(({ data }) => setNotificationCount(data.unread_count || 0)).catch(() => setNotificationCount(0))
    const syncCount = (event) => {
      if (typeof event.detail?.unreadCount === 'number') setNotificationCount(event.detail.unreadCount)
      else loadCount()
    }
    loadCount()
    const timer = window.setInterval(loadCount, 60000)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, syncCount)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, syncCount)
    }
  }, [])

  useEffect(() => {
    api.get('/public/settings').then(({ data }) => setBranding(data)).catch(() => setBranding(null))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }
  const currentPlan = activeWorkspace?.subscription?.plan?.name || activeWorkspace?.subscription?.plan_name || 'Free plan'
  const workspaceCount = workspaces?.length || 0
  const needsWorkspace = workspaceCount === 0
  const contentFullWidth = user?.settings?.content_width === 'full' || activeWorkspace?.settings?.content_width === 'full'
  const brandName = branding?.general?.site_name || branding?.platform_name || 'Postflow'
  const logoUrl = branding?.general?.logo_url
  const toggleSidebar = () => {
    setSidebarHidden((hidden) => {
      const next = !hidden
      localStorage.setItem('postflow_sidebar_hidden', String(next))
      window.dispatchEvent(new CustomEvent('postflow:sidebar-toggled'))
      return next
    })
  }

  const guardedNavigation = (event, to, onNavigate) => {
    const popup = window.__postflowActivePopup
    const dialog = document.querySelector('[role="dialog"]')
    const dialogTitle = dialog?.querySelector('h2')?.textContent || ''
    const guardedPopupOpen = popup?.active || ['New post', 'Create plan'].includes(dialogTitle)
    if (guardedPopupOpen) {
      event.preventDefault()
      const dirty = popup?.dirty ?? isDialogDirty(dialog)
      if (dirty && !window.confirm('You have unsaved popup changes. Press OK to discard them and open the page, or Cancel to keep editing.')) {
        return
      }
      window.dispatchEvent(new CustomEvent('postflow:force-close-popup'))
      navigate(to)
      window.dispatchEvent(new CustomEvent('postflow:navigation-confirmed'))
      return
    }
    onNavigate?.()
  }

  const switchFromSidebar = async (workspace) => {
    if (!workspace || workspace.slug === activeWorkspace?.slug) return
    setSidebarUserMenuOpen(false)
    await switchWorkspace(workspace.slug)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-[180] flex w-64 transform flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900',
          open && !sidebarHidden ? 'translate-x-0' : '-translate-x-full',
          sidebarHidden ? 'lg:-translate-x-full' : 'lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <NavLink
            to="/app"
            onClick={(event) => guardedNavigation(event, '/app')}
            className="flex min-w-0 items-center gap-2 rounded-xl transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            aria-label={`${brandName} dashboard`}
          >
            <BrandMark logoUrl={logoUrl} />
            <span className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">{brandName}</span>
          </NavLink>
          <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden" aria-label="Close sidebar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(event) => guardedNavigation(event, item.to, () => setOpen(false))}
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
            <div className="absolute bottom-full left-3 right-3 z-[170] mb-2 transform-gpu overflow-visible rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl will-change-transform dark:border-slate-700 dark:bg-slate-800" role="menu">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{workspaceCount} workspaces</span>
                </div>
              </div>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              {ACCOUNT_NAV.map((item) => (
                <Fragment key={item.key}>
                  {item.type === 'workspaces' ? (
                    <WorkspaceSwitcherMenuItem
                      activeWorkspace={activeWorkspace}
                      onClose={() => {
                        setSidebarUserMenuOpen(false)
                        setOpen(false)
                      }}
                      switchFromSidebar={switchFromSidebar}
                      workspaceCount={workspaceCount}
                      workspaces={workspaces}
                    />
                  ) : (
                    <NavLink
                      to={item.to}
                      onClick={(event) => {
                        guardedNavigation(event, item.to, () => {
                          setSidebarUserMenuOpen(false)
                          setOpen(false)
                        })
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      role="menuitem"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </NavLink>
                  )}
                </Fragment>
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

      {open && !sidebarHidden && <div className="fixed inset-0 z-[175] bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className={clsx('transition-[padding] duration-200', sidebarHidden ? 'lg:pl-0' : 'lg:pl-64')}>
        <header className="sticky top-0 z-[130] flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
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
            <NavLink to="/app" className="flex min-w-0 items-center gap-2 lg:hidden" aria-label={brandName}>
              <BrandMark logoUrl={logoUrl} />
              <span className="max-w-32 truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">{brandName}</span>
            </NavLink>
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
                const invitationToken = notification.data?.invitation_token
                if (type === 'workspace.invitation' && invitationToken) navigate(`/invitations/${invitationToken}`)
                if (type.startsWith('post.') && notification.data?.post_id) {
                  window.dispatchEvent(new CustomEvent('postflow:open-post', { detail: { id: notification.data.post_id } }))
                } else if (type.startsWith('post.')) navigate('/app/organizer')
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
                <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition', userMenuOpen && 'rotate-180')} />
              </button>
            </div>
          </div>
        </header>

        <main className={clsx('px-4 pb-24 pt-6 sm:px-6 lg:pb-6 animate-fade-in', contentFullWidth ? 'w-full' : 'mx-auto max-w-7xl')}>
          {needsWorkspace ? (
            <WorkspaceRequiredPrompt onCreate={() => setWorkspaceSetupOpen(true)} />
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-[120] grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 py-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden" aria-label="Mobile navigation">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={(event) => guardedNavigation(event, item.to)}
            className={({ isActive }) => clsx(
              'flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition',
              isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {typeof document !== 'undefined' && userMenuOpen && createPortal(
        <div
          ref={userMenuPanelRef}
          className="fixed z-[170] w-[min(16rem,calc(100vw_-_2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          style={{ top: userMenuPosition.top, right: userMenuPosition.right }}
          role="menu"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            <p className="mt-1 flex max-w-full items-center gap-1.5 truncate text-xs font-medium text-brand-600 dark:text-brand-300" title={activeWorkspace?.name || 'Workspace'}>
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{activeWorkspace?.name || 'Workspace'}</span>
            </p>
          </div>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
          <NavLink
            to="/app/profile"
            onClick={(event) => guardedNavigation(event, '/app/profile', () => setUserMenuOpen(false))}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            role="menuitem"
          >
            <UserRound className="h-4 w-4" />
            Profile
          </NavLink>
          <NavLink
            to="/app/notifications"
            onClick={(event) => guardedNavigation(event, '/app/notifications', () => setUserMenuOpen(false))}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            role="menuitem"
          >
            <Bell className="h-4 w-4" />
            <span className="min-w-0 flex-1">Notifications</span>
            {notificationCount > 0 && <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}
          </NavLink>
          <NavLink
            to="/app/settings"
            onClick={(event) => guardedNavigation(event, '/app/settings', () => setUserMenuOpen(false))}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            role="menuitem"
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
          <NavLink
            to="/app/pricing-plan"
            onClick={(event) => guardedNavigation(event, '/app/pricing-plan', () => setUserMenuOpen(false))}
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
        </div>,
        document.body,
      )}

      <WorkspaceCreateModal
        open={needsWorkspace && workspaceSetupOpen}
        title="Create your first workspace"
        description="Start by creating a workspace for your brand, team, connected accounts, and posts."
        canCancel={false}
        onCreated={() => window.location.assign('/app')}
      />

      <PostDetailsModal
        open={Boolean(postPopup.id)}
        post={postPopup.item}
        postId={postPopup.id}
        onClose={() => setPostPopup({ id: null, item: null })}
        onChanged={(item) => setPostPopup({ id: item.id, item })}
        onDeleted={() => setPostPopup({ id: null, item: null })}
      />
    </div>
  )
}

function isDialogDirty(dialog) {
  if (!dialog) return false
  const fields = Array.from(dialog.querySelectorAll('input, textarea, [contenteditable="true"]'))
  return fields.some((field) => {
    if (field.getAttribute('type') === 'checkbox') return field.checked
    if (field.isContentEditable) return field.textContent?.trim()
    return field.value?.trim()
  })
}

function WorkspaceRequiredPrompt({ onCreate }) {
  return (
    <EmptyState
      icon={Building2}
      title="Create a workspace"
      description="A workspace is required before dashboard tools, posts, accounts, media, and automations can load."
      action={<Button onClick={onCreate}><Building2 className="h-4 w-4" /> New workspace</Button>}
    />
  )
}

function BrandMark({ logoUrl }) {
  if (logoUrl) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 dark:ring-slate-700">
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
      </span>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
      <Sparkles className="h-5 w-5" />
    </div>
  )
}

function WorkspaceSwitcherMenuItem({ activeWorkspace, onClose, switchFromSidebar, workspaceCount, workspaces }) {
  return (
    <div className="group/workspace relative">
      <NavLink
        to="/app/workspaces"
        onClick={onClose}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
        role="menuitem"
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Workspaces</span>
        <span className="rounded-full bg-brand-50 px-1.5 text-[11px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{workspaceCount}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </NavLink>
      <div className="invisible absolute bottom-0 left-full z-[171] w-80 translate-x-1 transform-gpu pl-2 opacity-0 transition will-change-transform group-hover/workspace:visible group-hover/workspace:translate-x-0 group-hover/workspace:opacity-100">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Switch workspace</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{workspaceCount} workspaces</p>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {(workspaces || []).map((workspace) => {
              const active = workspace.slug === activeWorkspace?.slug
              return (
                <div key={workspace.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold text-white" style={{ backgroundColor: workspace.brand_color || '#4f46e5' }}>
                    {workspace.logo_url ? <img src={workspace.logo_url} alt="" className="h-full w-full object-cover" /> : workspace.name?.[0]?.toUpperCase() || 'W'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{workspace.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{workspace.members_count ?? 0} members · {workspace.social_accounts_count ?? 0} accounts</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => switchFromSidebar(workspace)}
                    disabled={active}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-white disabled:border-brand-200 disabled:bg-brand-50 disabled:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:disabled:border-brand-900/60 dark:disabled:bg-brand-950/40 dark:disabled:text-brand-300"
                  >
                    {active ? 'Active' : 'Switch'}
                  </button>
                </div>
              )
            })}
          </div>
          <NavLink
            to="/app/workspaces"
            onClick={onClose}
            className="mt-2 flex items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Manage workspaces
          </NavLink>
        </div>
      </div>
    </div>
  )
}
