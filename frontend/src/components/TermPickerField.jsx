import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from './ui'

export default function TermPickerField({
  label,
  icon: Icon,
  prefix = '',
  open,
  onOpen,
  onClose,
  selected,
  terms,
  termColors = {},
  onChange,
  onAdd,
  onDelete,
  onColorChange,
  placeholder,
}) {
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [position, setPosition] = useState(null)
  const visibleTerms = terms.filter((term) => term.toLowerCase().includes(search.trim().toLowerCase()))

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return
    const rect = triggerRef.current.getBoundingClientRect()
    const margin = 12
    const gap = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const mobile = viewportWidth < 640
    const width = mobile
      ? viewportWidth - margin * 2
      : Math.min(Math.max(rect.width, 320), viewportWidth - margin * 2)
    const left = mobile ? margin : Math.min(Math.max(rect.left, margin), viewportWidth - width - margin)
    const spaceBelow = viewportHeight - rect.bottom - margin
    const spaceAbove = rect.top - margin
    const openBelow = spaceBelow >= 280 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(220, Math.min(openBelow ? spaceBelow : spaceAbove, 380))

    setPosition(openBelow
      ? { left, top: rect.bottom + gap, width, maxHeight, origin: 'top' }
      : { left, bottom: viewportHeight - rect.top + gap, width, maxHeight, origin: 'bottom' })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => {
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return
      onClose()
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', closeOutside, true)
    document.addEventListener('touchstart', closeOutside, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside, true)
      document.removeEventListener('touchstart', closeOutside, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, open])

  const toggle = (term) => {
    onChange(selected.includes(term) ? selected.filter((item) => item !== term) : [...selected, term])
  }

  const addTerm = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const term = cleanTerm(draft)
    if (!term) return
    onAdd(term)
    if (onColorChange && !termColors[term]) {
      onColorChange(term, DEFAULT_TERM_COLORS[0])
    }
    if (!selected.some((item) => item.toLowerCase() === term.toLowerCase())) {
      onChange([...selected, term])
    }
    setDraft('')
    setSearch('')
  }

  const deleteTerm = (term) => {
    onChange(selected.filter((item) => item !== term))
    onDelete?.(term)
  }

  return (
    <div className="relative">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpen}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm text-slate-900 outline-none transition hover:border-brand-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
          {selected.length ? selected.map((term) => (
            <span key={term} style={termColorStyle(termColors[term])} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{prefix}{term}</span>
          )) : <span className="text-slate-400">{placeholder}</span>}
        </span>
      </button>

      {open && position && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[260] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
          style={{
            left: position.left,
            top: position.top,
            bottom: position.bottom,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label={`Close ${label}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="mt-3 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: Math.max(96, position.maxHeight - 172) }}>
            {visibleTerms.map((term) => (
              <div key={term} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
                  <input type="checkbox" checked={selected.includes(term)} onChange={() => toggle(term)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  {onColorChange && <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: normalizeTermColor(termColors[term]) }} />}
                  <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{prefix}{term}</span>
                </label>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {onColorChange && (
                    <input
                      type="color"
                      value={normalizeTermColor(termColors[term])}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onColorChange(term, event.target.value)}
                      className="h-7 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
                      title={`Color for ${term}`}
                      aria-label={`Color for ${term}`}
                    />
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        deleteTerm(term)
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                      aria-label={`Delete ${term}`}
                      title={`Delete ${term}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {visibleTerms.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400 dark:border-slate-700">No saved {label.toLowerCase()} yet.</p>}
          </div>
          <form onSubmit={addTerm} className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Add ${label === 'Categories' ? 'category' : 'tag'}`}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <Button type="submit" size="sm"><Plus className="h-3.5 w-3.5" /> Add</Button>
          </form>
        </div>,
        document.body,
      )}
    </div>
  )
}

function cleanTerm(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

const DEFAULT_TERM_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7']

function normalizeTermColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : DEFAULT_TERM_COLORS[0]
}

function termColorStyle(value) {
  if (!value) return undefined
  const color = normalizeTermColor(value)
  return { backgroundColor: color, color: '#ffffff' }
}
