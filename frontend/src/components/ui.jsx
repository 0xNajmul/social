import { useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { AlertTriangle, Loader2, Maximize2, Minimize2, Sparkles, X } from 'lucide-react'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Button({ variant = 'primary', size = 'md', className, children, loading, ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60',
    secondary:
      'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Input({ className, label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <input
        className={clsx(
          'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
          error && 'border-rose-500',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  )
}

export function Textarea({ className, label, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <textarea
        className={clsx(
          'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
          error && 'border-rose-500',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  )
}

export function Modal({ open, title, description, onClose, children, size = 'lg', fullscreenable = false }) {
  if (!open) return null

  return (
    <ModalContent title={title} description={description} onClose={onClose} size={size} fullscreenable={fullscreenable}>
      {children}
    </ModalContent>
  )
}

function ModalContent({ title, description, onClose, children, size, fullscreenable }) {
  const [stage, setStage] = useState(() => (fullscreenable ? preferredPopupStage() : 0))
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', screen: 'max-w-7xl' }
  const nextStage = () => setStage((value) => (value + 1) % 3)
  const sidebarHidden = typeof localStorage !== 'undefined' && localStorage.getItem('postflow_sidebar_hidden') === 'true'
  const contentLeft = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches && !sidebarHidden ? '16rem' : '0px'
  const contentMode = fullscreenable && stage === 1
  const fullMode = fullscreenable && stage === 2
  const stageLabel = stage === 0 ? 'Open in content area' : stage === 1 ? 'Open fullscreen' : 'Exit fullscreen'

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={clsx(
        'fixed z-[80] flex overflow-y-auto',
        contentMode && 'bottom-0 right-0 top-16 items-stretch justify-stretch bg-transparent p-0',
        fullMode && 'inset-0 z-[90] items-stretch justify-stretch bg-slate-950/70 p-0',
        !contentMode && !fullMode && 'inset-0 items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6',
      )}
      style={contentMode ? { left: contentLeft } : undefined}
      onMouseDown={(event) => event.target === event.currentTarget && !contentMode && onClose()}
    >
      <div
        className={clsx(
          'w-full overflow-y-auto bg-white shadow-2xl dark:bg-slate-900',
          contentMode && 'h-full max-h-none rounded-none border-0 shadow-none',
          fullMode && 'h-screen max-h-none max-w-none rounded-none border-0 shadow-none',
          !contentMode && !fullMode && 'my-auto rounded-2xl border border-slate-200 dark:border-slate-700',
          !contentMode && !fullMode && 'max-h-[92vh]',
          !contentMode && !fullMode && (widths[size] || widths.lg),
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-30 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <div className="flex items-center gap-1">
            {fullscreenable && (
              <button
                type="button"
                onClick={nextStage}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={stageLabel}
                title={stageLabel}
              >
                {stage === 2 ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function preferredPopupStage() {
  if (typeof localStorage === 'undefined') return 0
  const preferred = Number(localStorage.getItem('postflow_popup_default_stage') || '0')
  return [0, 1, 2].includes(preferred) ? preferred : 0
}

const badgeColors = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function Badge({ color = 'slate', children, className }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badgeColors[color] || badgeColors.slate, className)}>
      {children}
    </span>
  )
}

export function Spinner({ className }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-brand-600', className)} />
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-3xl bg-brand-500/10 blur-xl" />
          <span className="absolute h-16 w-16 animate-spin rounded-3xl border-2 border-transparent border-t-brand-500 border-r-brand-300" />
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
            <Sparkles className="h-5 w-5" />
          </span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Loading workspace</p>
          <p className="mt-1 text-xs text-slate-400">Preparing your dashboard...</p>
        </div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null

  return (
    <Modal open={open} title={title} description={description} onClose={onClose} size="md">
      <div className="space-y-5 p-5">
        <div className={clsx(
          'flex items-start gap-3 rounded-2xl border p-4',
          tone === 'danger'
            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
        )}>
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm leading-6">{description || 'This action cannot be undone.'}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button type="button" variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
      {Icon && <Icon className="mb-3 h-10 w-10 text-slate-400" />}
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, accent = 'brand', hint }) {
  const accents = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300',
  }
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && (
          <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', accents[accent])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  )
}
