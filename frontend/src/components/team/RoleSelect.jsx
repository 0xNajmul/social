import { ROLE_DETAILS } from './teamRoles'

export default function RoleSelect({ label, value, roles, onChange, disabled, compact = false }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`rounded-xl border border-slate-300 bg-white text-sm capitalize text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${compact ? 'px-3 py-1.5' : 'w-full px-3.5 py-2.5'}`}>
        {roles.map((item) => <option key={item} value={item}>{ROLE_DETAILS[item]?.label || item}</option>)}
      </select>
    </label>
  )
}
