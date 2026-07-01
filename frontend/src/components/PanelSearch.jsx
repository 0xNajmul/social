import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import clsx from 'clsx'

const USER_SEARCH_ITEMS = [
  { label: 'Dashboard', to: '/app', keywords: 'home overview stats' },
  { label: 'Feed', to: '/app/feed', keywords: 'explore rss news latest feeds articles' },
  { label: 'Posts', to: '/app/posts', keywords: 'composer create post write publish drafts scheduled' },
  { label: 'Organizer', to: '/app/organizer', keywords: 'table kanban timeline calendar posts' },
  { label: 'Calendar', to: '/app/organizer', keywords: 'schedule drag drop dates' },
  { label: 'Planner', to: '/app/planner', keywords: 'plans notes ai draft' },
  { label: 'Accounts', to: '/app/accounts', keywords: 'channels social connect' },
  { label: 'Media Library', to: '/app/media', keywords: 'images videos files assets' },
  { label: 'Automations', to: '/app/automations', keywords: 'rss workflow auto post' },
  { label: 'Analytics', to: '/app/analytics', keywords: 'reports metrics insights' },
  { label: 'Profile', to: '/app/profile', keywords: 'user account avatar' },
  { label: 'Public Profile', to: '/app/public-profile', keywords: 'about page bio links public website' },
  { label: 'Settings', to: '/app/settings', keywords: 'workspace preferences timezone' },
  { label: 'Pricing plan', to: '/app/pricing-plan', keywords: 'billing subscription package' },
  { label: 'Invite & earn', to: '/app/invite', keywords: 'referral affiliate earn' },
  { label: 'Workspaces', to: '/app/workspaces', keywords: 'workspace switch team space' },
  { label: 'Integrations', to: '/app/integrations', keywords: 'google sheets drive airtable notion n8n csv rss wordpress webhooks api zapier dropbox onedrive box s3 figma canva slack discord teams' },
  { label: 'Developer', to: '/app/developer', keywords: 'api keys webhooks' },
]

export default function PanelSearch({ className }) {
  const navigate = useNavigate()
  const wrapperRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState(USER_SEARCH_ITEMS.slice(0, 7))

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return USER_SEARCH_ITEMS.slice(0, 7)

    return USER_SEARCH_ITEMS
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
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
        placeholder="Search pages, tools, settings..."
        className="h-10 w-full rounded-xl border border-slate-200 bg-white/90 pl-9 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800/90 dark:text-white"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setOpen(true)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 transform-gpu overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl will-change-transform dark:border-slate-700 dark:bg-slate-900">
          {results.length ? results.map((item) => (
            <button
              key={`${item.label}-${item.to}`}
              type="button"
              onClick={() => selectItem(item)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <span>{item.label}</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          )) : (
            <div className="px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400">No matches found.</div>
          )}
        </div>
      )}
    </div>
  )
}
