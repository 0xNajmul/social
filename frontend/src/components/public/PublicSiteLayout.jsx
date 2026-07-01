import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LogOut, Menu, X } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  ['Home', '/'],
  ['Product', '/#product'],
  ['Pricing', '/#pricing'],
  ['News', '/news'],
]

export default function PublicSiteLayout({ children }) {
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    api.get('/public/settings').then(({ data }) => setSettings(data.data || data)).catch(() => setSettings(null))
  }, [])

  const brandName = settings?.general?.site_name || settings?.platform_name || 'Postflow'
  const logoUrl = settings?.general?.logo_url

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-950 dark:bg-[#090c12] dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-900/5 bg-[#f8f7f3]/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#080b12]/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-900/10 p-2 text-slate-700 dark:border-white/10 dark:text-slate-200 lg:hidden" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="flex items-center gap-2.5" aria-label={`${brandName} home`}>
              <LogoMark logoUrl={logoUrl} />
              <span className="text-lg font-extrabold tracking-[-0.035em]">{brandName}</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 dark:text-slate-300 lg:flex">
            {NAV.map(([label, href]) => <Link key={label} to={href} className="transition hover:text-slate-950 dark:hover:text-white">{label}</Link>)}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link to="/app" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-600 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-100">Dashboard <ArrowRight className="h-4 w-4" /></Link>
                <button type="button" onClick={logout} className="hidden rounded-xl border border-slate-900/10 p-2 text-slate-500 transition hover:text-slate-950 dark:border-white/10 dark:hover:text-white sm:inline-flex" aria-label="Log out">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hidden px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white sm:inline-flex">Log in</Link>
                <Link to="/register" className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-600 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-100">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm lg:hidden">
          <div className="ml-auto flex h-full w-full max-w-sm flex-col bg-white p-5 shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
                <LogoMark logoUrl={logoUrl} />
                <span className="text-lg font-extrabold">{brandName}</span>
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close navigation"><X className="h-5 w-5" /></button>
            </div>
            <nav className="mt-8 grid gap-2">
              {NAV.map(([label, href]) => (
                <Link key={label} to={href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">{label}</Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {children}

      <footer className="border-t border-slate-900/10 bg-white/55 dark:border-white/10 dark:bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5"><LogoMark logoUrl={logoUrl} /><span className="text-lg font-black tracking-[-0.04em]">{brandName}</span></div>
              <p className="mt-4 max-w-sm leading-7 text-slate-500 dark:text-slate-400">A focused social media workspace for planning, publishing, automation and team collaboration.</p>
            </div>
            <FooterColumn title="Product" links={[['Composer', '/#product'], ['Calendar', '/#product'], ['Automations', '/#workflow'], ['Pricing', '/#pricing']]} />
            <FooterColumn title="Company" links={[['News', '/news'], ['Security', '/#product'], ['Developers', '/#product']]} />
            <FooterColumn title="Account" links={user ? [['Dashboard', '/app'], ['Settings', '/app/settings'], ['Pricing plan', '/app/pricing-plan']] : [['Log in', '/login'], ['Create account', '/register'], ['Pricing', '/#pricing']]} />
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-slate-900/10 pt-6 text-xs text-slate-400 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {brandName}. Social publishing, in one flow.</p>
            <div className="flex gap-5"><span>Privacy</span><span>Terms</span><span>Security</span></div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <p className="text-sm font-black">{title}</p>
      <ul className="mt-4 space-y-3 text-sm text-slate-500 dark:text-slate-400">
        {links.map(([label, href]) => <li key={label}><Link to={href} className="transition hover:text-slate-950 dark:hover:text-white">{label}</Link></li>)}
      </ul>
    </div>
  )
}

function LogoMark({ logoUrl }) {
  if (logoUrl) {
    return (
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white text-white shadow-lg shadow-indigo-500/20 ring-1 ring-slate-900/10 dark:ring-white/10">
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
      </span>
    )
  }

  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white shadow-lg shadow-indigo-500/25">
      P
    </span>
  )
}
