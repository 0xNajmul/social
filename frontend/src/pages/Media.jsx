import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, FileVideo, Image as ImageIcon, FileText, Search, X, Play } from 'lucide-react'
import api from '../lib/api'
import { mediaUrl } from '../lib/media'
import { Card, Button, PageLoader, EmptyState, Input } from '../components/ui'

function isPreviewableImage(type) {
  return type === 'image' || type === 'gif'
}

export default function Media() {
  const [assets, setAssets] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()

  const load = (query = search) =>
    api
      .get('/media', { params: { per_page: 100, search: query.trim() || undefined } })
      .then(({ data }) => setAssets(data.data))

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post('/media', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this file?')) return
    await api.delete(`/media/${id}`)
    if (preview?.id === id) setPreview(null)
    load()
  }

  if (!assets) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Media library</h1>
          <p className="text-sm text-slate-500">Upload and reuse images and videos across posts.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
          <input ref={fileRef} type="file" hidden onChange={upload} accept="image/*,video/*,application/pdf" />
        </div>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={search ? 'No matches' : 'No media yet'}
          description={search ? 'Try a different search term.' : 'Upload your first image or video to get started.'}
          action={!search && <Button onClick={() => fileRef.current?.click()}>Upload media</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((m) => (
            <Card key={m.id} className="group relative overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setPreview(m)}
                className="block w-full text-left"
                aria-label={`Preview ${m.original_name}`}
              >
                <div className="relative flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-800">
                  {m.type === 'video' ? (
                    <>
                      <FileVideo className="h-10 w-10 text-slate-400" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                        <Play className="h-8 w-8 text-white drop-shadow" />
                      </span>
                    </>
                  ) : m.type === 'document' ? (
                    <FileText className="h-10 w-10 text-slate-400" />
                  ) : (
                    <img
                      src={mediaUrl(m.thumbnail_url || m.url)}
                      alt={m.original_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs text-slate-600 dark:text-slate-300">{m.original_name}</p>
                  <p className="text-[10px] text-slate-400">{(m.size / 1024).toFixed(0)} KB</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 opacity-0 shadow transition group-hover:opacity-100 dark:bg-slate-900/90"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <MediaPreviewModal asset={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  )
}

function MediaPreviewModal({ asset, onClose }) {
  const src = mediaUrl(asset.url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0 pr-4">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{asset.original_name}</p>
            <p className="text-xs text-slate-500">{asset.mime_type}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex max-h-[70vh] min-h-[200px] items-center justify-center overflow-auto bg-slate-950 p-4">
          {asset.type === 'video' ? (
            <video
              key={asset.id}
              src={src}
              controls
              controlsList="nodownload"
              playsInline
              className="max-h-[65vh] max-w-full rounded-lg"
            />
          ) : isPreviewableImage(asset.type) ? (
            <img src={src} alt={asset.original_name} className="max-h-[65vh] max-w-full rounded-lg object-contain" />
          ) : (
            <div className="text-center text-slate-300">
              <FileText className="mx-auto mb-3 h-12 w-12 opacity-60" />
              <p className="text-sm">Preview not available for this file type.</p>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-brand-400 hover:underline"
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
