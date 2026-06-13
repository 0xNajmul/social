import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

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

export function Input({ className, label, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>}
      <input className={clsx('w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30', className)} {...props} />
    </label>
  )
}

const badgeColors = {
  emerald: 'bg-emerald-900/40 text-emerald-300',
  amber: 'bg-amber-900/40 text-amber-300',
  rose: 'bg-rose-900/40 text-rose-300',
  slate: 'bg-slate-800 text-slate-300',
  indigo: 'bg-indigo-900/40 text-indigo-300',
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
