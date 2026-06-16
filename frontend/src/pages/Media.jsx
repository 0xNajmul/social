import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, FolderOpen, Upload, Trash2, FileVideo, Image as ImageIcon, FileText, Search, X, Play, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { mediaUrl } from '../lib/media'
import { Card, Button, PageLoader, EmptyState, Input, ConfirmDialog, Modal } from '../components/ui'

function isPreviewableImage(type) {
  return type === 'image' || type === 'gif'
}

export default function Media() {
  const [assets, setAssets] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])
  const [folders, setFolders] = useState([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderBusy, setFolderBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [previewIndex, setPreviewIndex] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef()
  const uploadControllers = useRef(new Map())

  const loadFolders = useCallback(() => {
    api.get('/media-folders').then(({ data }) => setFolders(data.data || [])).catch(() => setFolders([]))
  }, [])

  const load = useCallback((query = search, folder = activeFolder) =>
    api
      .get('/media', {
        params: {
          per_page: 100,
          search: query.trim() || undefined,
          folder_id: folder === 'all' ? undefined : folder,
        },
      })
      .then(({ data }) => setAssets(data.data)), [activeFolder, search])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [activeFolder, load, search])

  const upload = (e) => {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    files.forEach(uploadFile)
    e.target.value = ''
  }

  const uploadFile = async (file) => {
    const id = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const controller = new AbortController()
    const localUrl = file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null
    uploadControllers.current.set(id, controller)
    setUploading(true)
    setUploadQueue((current) => [{
      id,
      file,
      localUrl,
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'document',
      size: file.size,
      progress: 0,
      status: 'uploading',
      error: '',
    }, ...current])

    try {
      const form = new FormData()
      form.append('file', file)
      if (activeFolder !== 'all' && activeFolder !== 'root') form.append('folder_id', activeFolder)
      await api.post('/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: (event) => {
          const total = event.total || file.size || 1
          const progress = Math.min(99, Math.round((event.loaded / total) * 100))
          setUploadQueue((current) => current.map((item) => item.id === id ? { ...item, progress } : item))
        },
      })
      setUploadQueue((current) => current.map((item) => item.id === id ? { ...item, progress: 100, status: 'done' } : item))
      await load()
      window.setTimeout(() => {
        setUploadQueue((current) => current.filter((item) => item.id !== id))
        if (localUrl) URL.revokeObjectURL(localUrl)
      }, 1400)
    } catch (err) {
      if (controller.signal.aborted || err.code === 'ERR_CANCELED') {
        setUploadQueue((current) => current.filter((item) => item.id !== id))
      } else {
        setUploadQueue((current) => current.map((item) => item.id === id ? { ...item, status: 'error', error: err.response?.data?.message || 'Upload failed' } : item))
      }
    } finally {
      uploadControllers.current.delete(id)
      setUploading(uploadControllers.current.size > 0)
    }
  }

  const cancelUpload = (id) => {
    uploadControllers.current.get(id)?.abort()
    uploadControllers.current.delete(id)
    setUploadQueue((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item?.localUrl) URL.revokeObjectURL(item.localUrl)
      return current.filter((entry) => entry.id !== id)
    })
    setUploading(uploadControllers.current.size > 0)
  }

  const remove = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    await api.delete(`/media/${confirmDelete.id}`)
    if (assets?.[previewIndex]?.id === confirmDelete.id) setPreviewIndex(null)
    setConfirmDelete(null)
    setDeleting(false)
    load()
  }

  const updateAsset = (updated) => {
    setAssets((current) => current.map((asset) => asset.id === updated.id ? updated : asset))
    loadFolders()
  }

  const createFolder = async (event) => {
    event.preventDefault()
    if (!folderName.trim()) return
    setFolderBusy(true)
    try {
      const { data } = await api.post('/media-folders', { name: folderName.trim() })
      setFolders((current) => [...current, data.data])
      setFolderName('')
      setFolderOpen(false)
      setActiveFolder(data.data.id)
    } finally {
      setFolderBusy(false)
    }
  }

  if (!assets) return <PageLoader />
  const preview = previewIndex !== null ? assets[previewIndex] : null

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
              className="pl-9 pr-9"
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear media search"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <Button variant="secondary" onClick={() => setFolderOpen(true)}>
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
          <Button onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload className="h-4 w-4" /> Upload files
          </Button>
          <input ref={fileRef} type="file" hidden multiple onChange={upload} accept="image/*,video/*,application/pdf" />
        </div>
      </div>

      <Card className="p-3">
        <div className="flex gap-2 overflow-x-auto">
          <FolderChip label="All files" active={activeFolder === 'all'} count={folders.reduce((sum, folder) => sum + Number(folder.assets_count || 0), 0) || assets.length} onClick={() => setActiveFolder('all')} />
          <FolderChip label="Unfiled" active={activeFolder === 'root'} onClick={() => setActiveFolder('root')} />
          {folders.map((folder) => (
            <FolderChip key={folder.id} label={folder.name} active={String(activeFolder) === String(folder.id)} count={folder.assets_count || 0} onClick={() => setActiveFolder(folder.id)} />
          ))}
        </div>
      </Card>

      {uploadQueue.length > 0 && <UploadQueue items={uploadQueue} onCancel={cancelUpload} />}

      {assets.length === 0 && uploadQueue.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={search ? 'No matches' : 'No media yet'}
          description={search ? 'Try a different search term.' : 'Upload your first image or video to get started.'}
          action={!search && <Button onClick={() => fileRef.current?.click()}>Upload media</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((m, index) => (
            <Card key={m.id} className="group relative overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setPreviewIndex(index)}
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
                onClick={() => setConfirmDelete(m)}
                className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 opacity-0 shadow transition group-hover:opacity-100 dark:bg-slate-900/90"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <MediaPreviewModal
          asset={preview}
          hasNavigation={assets.length > 1}
          onClose={() => setPreviewIndex(null)}
          onNext={() => setPreviewIndex((index) => (index + 1) % assets.length)}
          onPrevious={() => setPreviewIndex((index) => (index - 1 + assets.length) % assets.length)}
          folders={folders}
          onSaved={updateAsset}
        />
      )}

      <Modal open={folderOpen} title="Create folder" description="Organize images, videos, and files by campaign or client." onClose={() => setFolderOpen(false)} size="md">
        <form onSubmit={createFolder} className="space-y-4 p-5">
          <Input label="Folder name" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Campaign assets" required />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setFolderOpen(false)}>Cancel</Button>
            <Button type="submit" loading={folderBusy}><FolderPlus className="h-4 w-4" /> Create folder</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete media file"
        description={`Delete "${confirmDelete?.original_name || 'this file'}"? This removes it from the media library.`}
        confirmLabel="Delete file"
        loading={deleting}
        onClose={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </div>
  )
}

function FolderChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${active ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
    >
      <FolderOpen className="h-4 w-4" />
      {label}
      {count !== undefined && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{count}</span>}
    </button>
  )
}

function MediaPreviewModal({ asset, onClose, onNext, onPrevious, hasNavigation, folders, onSaved }) {
  const src = mediaUrl(asset.url)
  const [form, setForm] = useState({ original_name: asset.original_name || '', alt_text: asset.alt_text || '', folder_id: asset.folder_id || '' })
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(true)

  useEffect(() => {
    setForm({ original_name: asset.original_name || '', alt_text: asset.alt_text || '', folder_id: asset.folder_id || '' })
  }, [asset])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (!hasNavigation) return
      if (event.key === 'ArrowRight') onNext()
      if (event.key === 'ArrowLeft') onPrevious()
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [hasNavigation, onClose, onNext, onPrevious])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.put(`/media/${asset.id}`, { ...form, folder_id: form.folder_id || null })
      onSaved(data.data)
    } catch (error) {
      alert(error.response?.data?.message || 'Could not update media details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(asset)}
      title={asset.original_name}
      description={asset.mime_type}
      onClose={onClose}
      size="screen"
      fullscreenable
    >
        <div className={detailsOpen ? 'grid min-h-0 flex-1 lg:grid-cols-[1.5fr_360px]' : 'grid min-h-0 flex-1'}>
          <div className="relative flex max-h-[76vh] min-h-[360px] items-center justify-center overflow-auto bg-slate-950 p-4">
          <button
            type="button"
            onClick={() => setDetailsOpen((value) => !value)}
            className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-lg transition hover:bg-white dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-700"
          >
            {detailsOpen ? 'Hide details' : 'Show details'}
            {detailsOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          {hasNavigation && (
            <>
              <button
                type="button"
                onClick={onPrevious}
                className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg transition hover:bg-white dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-700"
                aria-label="Previous media"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg transition hover:bg-white dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-700"
                aria-label="Next media"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
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

          {detailsOpen && <form onSubmit={save} className="flex max-h-[76vh] flex-col overflow-y-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:border-l lg:border-t-0">
            <div className="space-y-4 p-5">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Image details</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update the image name, alt text, and review file stats.</p>
              </div>

              <Input label="Image name" value={form.original_name} onChange={(event) => setForm({ ...form, original_name: event.target.value })} />
              <Input label="Alt tag" value={form.alt_text} onChange={(event) => setForm({ ...form, alt_text: event.target.value })} placeholder="Describe this image for accessibility" />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Folder</span>
                <select value={form.folder_id} onChange={(event) => setForm({ ...form, folder_id: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <option value="">Unfiled</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Image stats</p>
                <div className="mt-3 grid gap-3 text-sm">
                  <Stat label="Type" value={asset.type} />
                  <Stat label="Dimensions" value={asset.width && asset.height ? `${asset.width} x ${asset.height}px` : 'Not available'} />
                  <Stat label="Size" value={formatSize(asset.size)} />
                  <Stat label="MIME" value={asset.mime_type || 'Unknown'} />
                  <Stat label="Uploaded" value={asset.created_at ? new Date(asset.created_at).toLocaleString() : 'Unknown'} />
                </div>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 p-5 dark:border-slate-800">
              <Link to={`/app/media/${asset.id}/edit`}>
                <Button type="button" variant="secondary">Edit page</Button>
              </Link>
              <Button type="submit" loading={saving}>Save details</Button>
            </div>
          </form>}
        </div>
    </Modal>
  )
}

function UploadQueue({ items, onCancel }) {
  return (
    <Card className="overflow-hidden border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Uploading files</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Progress is shown in real time. You can cancel any active upload.</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-600 dark:bg-slate-900 dark:text-brand-300">{items.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative flex aspect-video items-center justify-center bg-slate-100 dark:bg-slate-800">
              {item.localUrl && item.type === 'image' ? <img src={item.localUrl} alt="" className="h-full w-full object-cover" /> : item.localUrl && item.type === 'video' ? <video src={item.localUrl} className="h-full w-full object-cover" muted /> : <FileText className="h-8 w-8 text-slate-400" />}
              {item.status === 'uploading' && <div className="absolute inset-0 flex items-center justify-center bg-black/35"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>}
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.name}</p>
                <button type="button" onClick={() => onCancel(item.id)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800" aria-label={`Cancel ${item.name}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${item.status === 'error' ? 'bg-rose-500' : item.status === 'done' ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${item.progress}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{item.status === 'done' ? 'Uploaded' : item.status === 'error' ? item.error : 'Uploading'}</span>
                <span>{item.progress}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="truncate text-right font-medium text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  )
}

function formatSize(size = 0) {
  if (size >= 1048576) return `${(size / 1048576).toFixed(2)} MB`
  return `${(size / 1024).toFixed(0)} KB`
}
