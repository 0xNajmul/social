import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import clsx from 'clsx'

const ADMIN_SEARCH_ITEMS = [
  { label: 'Dashboard', to: '/', keywords: 'overview stats metrics' },
  { label: 'Users', to: '/users', keywords: 'customers accounts members' },
  { label: 'Roles', to: '/roles', keywords: 'admin permissions access control' },
  { label: 'Posts', to: '/posts', keywords: 'scheduled published content filter' },
  { label: 'News', to: '/news', keywords: 'article blog announcement category seo publish draft' },
  { label: 'Plans', to: '/plans', keywords: 'pricing packages billing' },
  { label: 'Workspaces', to: '/workspaces', keywords: 'teams owners organizations' },
  { label: 'Jobs & Queue', to: '/jobs', keywords: 'scheduled failed queue' },
  { label: 'Settings', to: '/settings', keywords: 'system configuration platform' },
  { label: 'General settings', to: '/settings/general', keywords: 'site name logo social' },
  { label: 'SEO settings', to: '/settings/seo', keywords: 'meta open graph schema' },
  { label: 'Email settings', to: '/settings/email', keywords: 'smtp brevo mail' },
  { label: 'Security settings', to: '/settings/security', keywords: '2fa turnstile blocked domains' },
  { label: 'Payment settings', to: '/settings/payments', keywords: 'dodo creem billing' },
  { label: 'Profile', to: '/profile', keywords: 'admin account avatar' },
]

export default function PanelSearch({ className }) {
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState(ADMIN_SEARCH_ITEMS.slice(0, 7))

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return ADMIN_SEARCH_ITEMS.slice(0, 7)

    return ADMIN_SEARCH_ITEMS
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(term))
      .slice(0, 8)
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => setResults(matches), 120)
    return () => window.clearTimeout(timer)
  }, [matches])

  useEffect(() => {
    const close = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectItem = (item) => {
    setQuery('')
    setOpen(false)
    navigate(item.to)
  }

  return (
    <div className={clsx('relative', className)} ref={wrapperRef}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && results[0]) selectItem(results[0])
        }}
        placeholder="Search admin pages..."
        className="h-9 w-full rounded-xl border border-slate-700 bg-slate-800/90 pl-9 pr-9 text-sm text-slate-100 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setOpen(true)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:bg-slate-700 hover:text-white"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
          {results.length ? results.map((item) => (
            <button
              key={`${item.label}-${item.to}`}
              type="button"
              onClick={() => selectItem(item)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              <span>{item.label}</span>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </button>
          )) : (
            <div className="px-3 py-5 text-center text-sm text-slate-500">No matches found.</div>
          )}
        </div>
      )}
    </div>
  )
}
