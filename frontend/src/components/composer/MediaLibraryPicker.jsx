import { useEffect, useState } from 'react'
import { Check, FileVideo, Image as ImageIcon, Loader2, Search, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import { Button, Input } from '../ui'

export default function MediaLibraryPicker({ open, onClose, onAdd, existingIds = [] }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState([])

  useEffect(() => {
    if (!open) return
    setPicked([])
    setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const timer = setTimeout(() => {
      api
        .get('/media', { params: { per_page: 100, search: search || undefined } })
        .then(({ data }) => setAssets(data.data || []))
        .finally(() => setLoading(false))
    }, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [open, search])

  if (!open) return null

  const toggle = (asset) => {
    setPicked((prev) =>
      prev.some((a) => a.id === asset.id) ? prev.filter((a) => a.id !== asset.id) : [...prev, asset],
    )
  }

  const addSelected = () => {
    const normalized = picked.map((a) => ({
      ...a,
      url: mediaUrl(a.url),
      thumbnail_url: mediaUrl(a.thumbnail_url || a.url),
    }))
    onAdd(normalized)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Media library</h2>
            <p className="text-xs text-slate-500">Select one or more files to attach to your post.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No media found. Upload files in the Media library first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((asset) => {
                const selected = picked.some((a) => a.id === asset.id)
                const already = existingIds.includes(asset.id)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    disabled={already}
                    onClick={() => !already && toggle(asset)}
                    className={clsx(
                      'group relative overflow-hidden rounded-xl border text-left transition',
                      selected && 'border-brand-500 ring-2 ring-brand-500/40',
                      already && 'cursor-not-allowed opacity-50',
                      !selected && !already && 'border-slate-200 hover:border-brand-400 dark:border-slate-700',
                    )}
                  >
                    <div className="aspect-square bg-slate-100 dark:bg-slate-800">
                      {asset.type === 'video' ? (
                        <div className="flex h-full flex-col items-center justify-center text-slate-400">
                          <FileVideo className="h-8 w-8" />
                        </div>
                      ) : asset.type === 'document' ? (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <span className="text-xs">PDF</span>
                        </div>
                      ) : (
                        <img src={mediaUrl(asset.thumbnail_url || asset.url)} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="truncate px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{asset.original_name}</p>
                    {selected && (
                      <span className="absolute right-2 top-2 rounded-full bg-brand-500 p-1 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    {already && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">Added</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="text-sm text-slate-500">{picked.length} selected</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button disabled={picked.length === 0} onClick={addSelected}>
              Add to post
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
