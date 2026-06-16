import clsx from 'clsx'
import { Loader2, X } from 'lucide-react'

export function Card({ className, children, ...props }) {
  return <div className={clsx('rounded-2xl border border-slate-800 bg-slate-900 shadow-sm', className)} {...props}>{children}</div>
}

export function Button({ variant = 'primary', size = 'md', className, children, loading, ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60',
    secondary: 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-300 hover:bg-slate-800',
  }
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' }
  return (
    <button className={clsx('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed', variants[variant], sizes[size], className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  )
}

export function Input({ className, label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>}
      <input className={clsx('w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30', error && 'border-rose-500', className)} {...props} />
      {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
    </label>
  )
}

export function Textarea({ className, label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>}
      <textarea className={clsx('min-h-24 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30', error && 'border-rose-500', className)} {...props} />
      {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
    </label>
  )
}

export function Modal({ open, title, description, onClose, children, size = 'lg' }) {
  if (!open) return null
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl', widths[size])} role="dialog" aria-modal="true">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div><h2 className="text-lg font-bold text-white">{title}</h2>{description && <p className="mt-1 text-sm text-slate-400">{description}</p>}</div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const badgeColors = {
  emerald: 'bg-emerald-900/40 text-emerald-300',
  amber: 'bg-amber-900/40 text-amber-300',
  rose: 'bg-rose-900/40 text-rose-300',
  slate: 'bg-slate-800 text-slate-300',
  indigo: 'bg-indigo-900/40 text-indigo-300',
  sky: 'bg-sky-900/40 text-sky-300',
  violet: 'bg-violet-900/40 text-violet-300',
  gray: 'bg-gray-800 text-gray-300',
}
export function Badge({ color = 'slate', children }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badgeColors[color])}>{children}</span>
}

export function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-500" /></div>
}

export function StatCard({ label, value, icon: Icon, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        {Icon && <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/20 text-brand-400"><Icon className="h-5 w-5" /></span>}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}
