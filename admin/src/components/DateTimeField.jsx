import { CalendarDays, Clock3 } from 'lucide-react'
import clsx from 'clsx'

export default function DateTimeField({ label, type = 'date', value, onChange, error, className, ...props }) {
  const Icon = type === 'datetime-local' ? Clock3 : CalendarDays

  return (
    <label className={clsx('block', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>}
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          className={clsx(
            'w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none transition [color-scheme:dark] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30',
            error && 'border-rose-500',
          )}
          {...props}
        />
      </span>
      {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
    </label>
  )
}
