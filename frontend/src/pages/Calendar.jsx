import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import { Card, Badge, PageLoader } from '../components/ui'
import PlatformBadge from '../components/PlatformBadge'

export default function Calendar() {
  const [cursor, setCursor] = useState(() => new Date())
  const [posts, setPosts] = useState(null)

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor])
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor])

  useEffect(() => {
    setPosts(null)
    api.get('/calendar', { params: { from: fmt(monthStart), to: fmt(monthEnd) } })
      .then(({ data }) => setPosts(data.data))
  }, [monthStart, monthEnd])

  const days = useMemo(() => buildGrid(monthStart), [monthStart])

  const byDay = useMemo(() => {
    const map = {}
    ;(posts || []).forEach((p) => {
      if (!p.scheduled_at) return
      const key = p.scheduled_at.slice(0, 10)
      ;(map[key] ||= []).push(p)
    })
    return map
  }, [posts])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button>
          <span className="w-40 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
            {cursor.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {posts === null ? <PageLoader /> : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const key = fmt(day)
              const inMonth = day.getMonth() === cursor.getMonth()
              const items = byDay[key] || []
              const isToday = key === fmt(new Date())
              return (
                <div key={i} className={`min-h-28 border-b border-r border-slate-100 p-1.5 dark:border-slate-800 ${inMonth ? '' : 'bg-slate-50/50 dark:bg-slate-950/40'}`}>
                  <div className={`mb-1 text-right text-xs ${isToday ? 'font-bold text-brand-600' : 'text-slate-400'}`}>{day.getDate()}</div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-1 dark:bg-slate-800" title={p.content}>
                        {p.variants.slice(0, 2).map((v) => <PlatformBadge key={v.id} platform={v.platform} size="xs" />)}
                        <span className="truncate text-[11px] text-slate-600 dark:text-slate-300">{p.content || 'Post'}</span>
                      </div>
                    ))}
                    {items.length > 3 && <div className="text-[10px] text-slate-400">+{items.length - 3} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

const fmt = (d) => d.toISOString().slice(0, 10)

function buildGrid(monthStart) {
  const start = new Date(monthStart)
  start.setDate(1 - start.getDay()) // back to Sunday
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}
