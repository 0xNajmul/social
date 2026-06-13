import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Package, Building2, ListChecks, LogOut, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/plans', label: 'Plans', icon: Package },
  { to: '/workspaces', label: 'Workspaces', icon: Building2 },
  { to: '/jobs', label: 'Jobs & Queue', icon: ListChecks },
]

export default function AdminLayout() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-slate-800 bg-slate-900">
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white"><ShieldAlert className="h-5 w-5" /></div>
          <span className="text-lg font-bold text-white">Admin Console</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}>
              <i.icon className="h-5 w-5" /> {i.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 backdrop-blur">
          <span className="text-sm text-slate-400">Platform administration</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{admin?.name}</span>
            <button onClick={async () => { await logout(); navigate('/login') }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6"><Outlet /></main>
      </div>
    </div>
  )
}
