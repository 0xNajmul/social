import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUp, FileText, FileVideo, Folder, FolderOpen, FolderPlus, Image as ImageIcon, LayoutGrid, List, Loader2, PanelLeftClose, PanelLeftOpen, Pencil, Play, Search, Table2, Trash2, Upload, X } from 'lucide-react'
import api from '../lib/api'
import { mediaUrl } from '../lib/media'
import { Card, Button, PageLoader, EmptyState, Input, ConfirmDialog, Modal } from '../components/ui'
import { DATA_CHANGED_EVENT } from '../lib/appEvents'
import useInfiniteList from '../hooks/useInfiniteList'
import usePageSize from '../hooks/usePageSize'

function isPreviewableImage(type) {
  return type === 'image' || type === 'gif'
}

export default function Media() {
  const pageSize = usePageSize('media_assets', 36)
  const [assets, setAssets] = useState(null)
  const [assetMeta, setAssetMeta] = useState(null)
  const [loadingMoreAssets, setLoadingMoreAssets] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])
  const [uploadPanelOpen, setUploadPanelOpen] = useState(true)
  const [folders, setFolders] = useState([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState(() => new Set())
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('media_view_mode') || 'card')
  const [sortMode, setSortMode] = useState(() => localStorage.getItem('media_sort_mode') || 'newest')
  const [dragActive, setDragActive] = useState(false)
  const [folderContentLoading, setFolderContentLoading] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [editingFolder, setEditingFolder] = useState(null)
  const [confirmFolderDelete, setConfirmFolderDelete] = useState(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef()
  const actionMenuRef = useRef(null)
  const uploadControllers = useRef(new Map())

  const loadFolders = useCallback(() => {
    return api.get('/media-folders').then(({ data }) => setFolders(data.data || [])).catch(() => setFolders([]))
  }, [])

  const load = useCallback((query = search, folder = activeFolder, page = 1, append = false) => {
    if (append) setLoadingMoreAssets(true)
    return api
      .get('/media', {
        params: {
          per_page: pageSize,
          page,
          search: query.trim() || undefined,
          folder_id: folder === 'all' ? undefined : folder,
        },
      })
      .then(({ data }) => {
        const nextAssets = data.data || []
        setAssets((current) => append ? [...(current || []), ...nextAssets] : nextAssets)
        setAssetMeta(data.meta || null)
      })
      .catch(() => {
        if (!append) {
          setAssets([])
          setAssetMeta(null)
        }
      })
      .finally(() => {
        setFolderContentLoading(false)
        if (append) setLoadingMoreAssets(false)
      })
  }, [activeFolder, pageSize, search])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [activeFolder, load, search])

  useEffect(() => {
    const refresh = () => {
      load(search)
      loadFolders()
    }
    const interval = window.setInterval(refresh, 30000)
    window.addEventListener(DATA_CHANGED_EVENT, refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(DATA_CHANGED_EVENT, refresh)
    }
  }, [load, loadFolders, search])

  useEffect(() => {
    if (!actionMenuOpen) return undefined

    const closeMenu = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) setActionMenuOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActionMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [actionMenuOpen])

  const upload = (e) => {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    uploadFiles(files)
    e.target.value = ''
  }

  const openUploadPicker = () => {
    setActionMenuOpen(false)
    fileRef.current?.click()
  }

  const uploadFiles = (files, folder = activeFolder) => {
    setUploadPanelOpen(true)
    files.forEach((file) => uploadFile(file, folder))
  }

  const uploadFile = async (file, targetFolder = activeFolder) => {
    const id = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const controller = new AbortController()
    const localUrl = file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null
    uploadControllers.current.set(id, controller)
    setUploading(true)
    setUploadPanelOpen(true)
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
      if (targetFolder !== 'all' && targetFolder !== 'root') form.append('folder_id', targetFolder)
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
      loadFolders()
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

  const handleDragOver = (event) => {
    if (!hasFileDrag(event)) return
    event.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setDragActive(false)
  }

  const handleDrop = (event, folder = activeFolder) => {
    if (!hasFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    const files = [...(event.dataTransfer?.files || [])]
    if (files.length) uploadFiles(files, folder)
  }

  const remove = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    await api.delete(`/media/${confirmDelete.id}`)
    if (assets?.[previewIndex]?.id === confirmDelete.id) setPreviewIndex(null)
    setConfirmDelete(null)
    setDeleting(false)
    load()
    loadFolders()
  }

  const updateAsset = (updated) => {
    setAssets((current) => current.map((asset) => asset.id === updated.id ? updated : asset))
    loadFolders()
  }

  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const folderMap = useMemo(() => buildFolderMap(folderTree), [folderTree])
  const activeFolderRecord = useMemo(() => folders.find((folder) => String(folder.id) === String(activeFolder)), [activeFolder, folders])
  const activeBreadcrumb = useMemo(() => buildBreadcrumb(activeFolder, folderMap), [activeFolder, folderMap])
  const visibleFolders = useMemo(() => {
    if (activeFolder === 'all') return folderTree
    if (activeFolder === 'root') return []
    return folderMap.get(String(activeFolder))?.children || []
  }, [activeFolder, folderMap, folderTree])
  const allFileCount = folders.reduce((sum, folder) => sum + Number(folder.assets_count || 0), 0) || assets?.length || 0
  const sortedAssets = useMemo(() => sortAssets(assets || [], sortMode), [assets, sortMode])
  const hasServerMore = Boolean(assetMeta && assetMeta.current_page < assetMeta.last_page)
  const loadMoreAssets = useCallback(() => {
    if (!hasServerMore || loadingMoreAssets) return
    load(search, activeFolder, assetMeta.current_page + 1, true)
  }, [activeFolder, assetMeta, hasServerMore, load, loadingMoreAssets, search])
  const { hasMore, items: pagedAssets, sentinelRef } = useInfiniteList(sortedAssets, {
    pageSize,
    hasExternalMore: hasServerMore,
    externalLoading: loadingMoreAssets,
    onEndReached: loadMoreAssets,
    resetKey: [search, activeFolder, sortMode].join('::'),
  })

  useEffect(() => {
    if (activeFolder === 'all' || activeFolder === 'root') return
    const idsToExpand = new Set([String(activeFolder)])
    let current = folderMap.get(String(activeFolder))
    while (current?.parent_id) {
      idsToExpand.add(String(current.parent_id))
      current = folderMap.get(String(current.parent_id))
    }
    if (idsToExpand.size === 0) return
    setExpandedFolders((currentExpanded) => {
      let changed = false
      const next = new Set(currentExpanded)
      idsToExpand.forEach((id) => {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      })
      return changed ? next : currentExpanded
    })
  }, [activeFolder, folderMap])

  const toggleFolder = (folderId) => {
    setExpandedFolders((current) => {
      const next = new Set(current)
      const key = String(folderId)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const changeViewMode = (nextMode) => {
    setViewMode(nextMode)
    localStorage.setItem('media_view_mode', nextMode)
  }

  const changeSortMode = (nextMode) => {
    setSortMode(nextMode)
    localStorage.setItem('media_sort_mode', nextMode)
  }

  const openFolder = (folderId) => {
    if (String(folderId) === String(activeFolder)) return
    setFolderContentLoading(true)
    setActiveFolder(folderId)
  }

  const openCreateFolder = () => {
    setEditingFolder(null)
    setFolderName('')
    setFolderOpen(true)
  }

  const openRenameFolder = (folder) => {
    setEditingFolder(folder)
    setFolderName(folder.name || '')
    setFolderOpen(true)
  }

  const submitFolder = async (event) => {
    event.preventDefault()
    if (!folderName.trim()) return
    setFolderBusy(true)
    try {
      const payload = { name: folderName.trim() }
      const parentId = activeFolderRecord?.id
      if (!editingFolder && parentId) payload.parent_id = parentId
      const { data } = editingFolder
        ? await api.put(`/media-folders/${editingFolder.id}`, payload)
        : await api.post('/media-folders', payload)
      setFolders((current) => {
        if (editingFolder) return current.map((folder) => folder.id === data.data.id ? data.data : folder)
        return [...current, data.data]
      })
      if (!editingFolder && parentId) {
        setExpandedFolders((current) => new Set([...current, String(parentId)]))
      }
      setFolderName('')
      setEditingFolder(null)
      setFolderOpen(false)
      setActiveFolder(data.data.id)
    } finally {
      setFolderBusy(false)
    }
  }

  const deleteFolder = async () => {
    if (!confirmFolderDelete) return
    setFolderBusy(true)
    try {
      await api.delete(`/media-folders/${confirmFolderDelete.id}`)
      const deletedIds = collectFolderIds(confirmFolderDelete)
      setFolders((current) => current.filter((folder) => !deletedIds.has(String(folder.id))))
      if (deletedIds.has(String(activeFolder))) {
        setActiveFolder('all')
        load(search, 'all')
      } else {
        load()
      }
      loadFolders()
      setConfirmFolderDelete(null)
    } finally {
      setFolderBusy(false)
    }
  }

  if (!assets) return <PageLoader />
  const preview = previewIndex !== null ? sortedAssets[previewIndex] : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Media library</h1>
          <p className="text-sm text-slate-500">Upload and reuse images and videos across posts.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <MediaActionMenu
            busy={uploading}
            menuOpen={actionMenuOpen}
            menuRef={actionMenuRef}
            onCreateFolder={() => {
              setActionMenuOpen(false)
              openCreateFolder()
            }}
            onOpenChange={setActionMenuOpen}
            onUpload={openUploadPicker}
          />
          <input ref={fileRef} type="file" hidden multiple onChange={upload} accept="image/*,video/*,application/pdf" />
        </div>
      </div>

      {uploadQueue.length > 0 && uploadPanelOpen && (
        <UploadQueue items={uploadQueue} onCancel={cancelUpload} onClose={() => setUploadPanelOpen(false)} />
      )}

      <div className={clsx('grid gap-5', folderSidebarOpen ? 'lg:grid-cols-[300px_minmax(0,1fr)]' : 'lg:grid-cols-[64px_minmax(0,1fr)]')}>
        <MediaFolderSidebar
          activeFolder={activeFolder}
          allFileCount={allFileCount}
          collapsed={!folderSidebarOpen}
          expandedFolders={expandedFolders}
          folderTree={folderTree}
          folders={folders}
          onCollapse={() => setFolderSidebarOpen(false)}
          onCreate={openCreateFolder}
          onDelete={setConfirmFolderDelete}
          onExpand={() => setFolderSidebarOpen(true)}
          onCollapseAll={() => setExpandedFolders(new Set())}
          onRename={openRenameFolder}
          onSelect={openFolder}
          onToggle={toggleFolder}
        />

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0 flex-1">
              <FolderBreadcrumb items={activeBreadcrumb} onSelect={openFolder} />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {assets.length} file{assets.length === 1 ? '' : 's'} shown
                {visibleFolders.length > 0 ? ` · ${visibleFolders.length} folder${visibleFolders.length === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <select
                value={sortMode}
                onChange={(event) => changeSortMode(event.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                aria-label="Sort media"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="size_desc">Largest first</option>
                <option value="size_asc">Smallest first</option>
              </select>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 pr-9"
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white" aria-label="Clear media search"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <ViewModeControl value={viewMode} onChange={changeViewMode} />
            </div>
          </div>

          <div
            className={clsx(
              'relative rounded-2xl border border-dashed border-transparent transition',
              dragActive && 'border-brand-400 bg-brand-50/60 p-3 dark:border-brand-700 dark:bg-brand-950/20',
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {dragActive && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-brand-600/10 text-sm font-semibold text-brand-700 ring-2 ring-brand-500/40 dark:text-brand-200">
                {`Drop files to upload into ${activeFolderRecord?.name || (activeFolder === 'root' ? 'Unfiled' : 'the media library')}`}
              </div>
            )}
            {folderContentLoading && (
              <div className="pointer-events-none absolute inset-0 z-30 flex min-h-64 items-center justify-center rounded-2xl bg-white/85 backdrop-blur-sm dark:bg-slate-950/75">
                <div className="text-center">
                  <FolderContentLoader />
                  <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Loading folder contents</p>
                </div>
              </div>
            )}

          {sortedAssets.length === 0 && visibleFolders.length === 0 && uploadQueue.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title={search ? 'No matches' : 'No media yet'}
              description={search ? 'Try a different search term.' : activeFolderRecord ? 'Upload files into this folder or create a nested folder to organize the library.' : 'Upload your first image or video to get started.'}
              action={!search && <Button onClick={() => fileRef.current?.click()}>Upload media</Button>}
            />
          ) : (
              <MediaContentView
              assets={pagedAssets}
              folders={visibleFolders}
              viewMode={viewMode}
              onDelete={setConfirmDelete}
              onDropFiles={uploadFiles}
              onPreview={setPreviewIndex}
              onSelectFolder={openFolder}
            />
          )}
            {hasMore && <div ref={sentinelRef} className="px-4 py-5 text-center text-xs font-semibold text-slate-400">Loading more media...</div>}
          </div>
        </div>
      </div>

      {preview && (
        <MediaPreviewModal
          key={preview.id}
          asset={preview}
          hasNavigation={sortedAssets.length > 1}
          onClose={() => setPreviewIndex(null)}
          onNext={() => setPreviewIndex((index) => (index + 1) % sortedAssets.length)}
          onPrevious={() => setPreviewIndex((index) => (index - 1 + sortedAssets.length) % sortedAssets.length)}
          folders={folders}
          onSaved={updateAsset}
        />
      )}

      <Modal open={folderOpen} title={editingFolder ? 'Rename folder' : 'Create folder'} description={editingFolder ? 'Update the folder name everywhere it appears in the media library.' : activeFolderRecord ? `Create a folder inside ${activeFolderRecord.name}.` : 'Organize images, videos, and files by campaign or client.'} onClose={() => setFolderOpen(false)} size="md">
        <form onSubmit={submitFolder} className="space-y-4 p-5">
          <Input label="Folder name" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Campaign assets" required />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setFolderOpen(false)}>Cancel</Button>
            <Button type="submit" loading={folderBusy}>
              {editingFolder ? <Pencil className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
              {editingFolder ? 'Save folder' : 'Create folder'}
            </Button>
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

      <ConfirmDialog
        open={Boolean(confirmFolderDelete)}
        title="Delete folder"
        description={`Delete "${confirmFolderDelete?.name || 'this folder'}"? Files in this folder will stay in the media library as unfiled items.`}
        confirmLabel="Delete folder"
        loading={folderBusy}
        onClose={() => setConfirmFolderDelete(null)}
        onConfirm={deleteFolder}
      />
    </div>
  )
}

function MediaActionMenu({ busy, menuOpen, menuRef, onCreateFolder, onOpenChange, onUpload }) {
  return (
    <div className="relative flex-1 sm:flex-none" ref={menuRef}>
      <div className="flex w-full overflow-hidden rounded-xl shadow-sm sm:w-auto">
        <Button
          type="button"
          className="min-w-0 flex-1 rounded-r-none sm:flex-none"
          loading={busy}
          onClick={onUpload}
        >
          <Upload className="h-4 w-4" /> Upload files
        </Button>
        <button
          type="button"
          onClick={() => onOpenChange((value) => !value)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-l border-white/20 bg-brand-600 text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          aria-label="Open media actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <ChevronDown className={clsx('h-4 w-4 transition', menuOpen && 'rotate-180')} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 z-[60] mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800" role="menu">
          <button
            type="button"
            onClick={onUpload}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            role="menuitem"
          >
            <Upload className="h-4 w-4 text-brand-500" />
            Upload files
          </button>
          <button
            type="button"
            onClick={onCreateFolder}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            role="menuitem"
          >
            <FolderPlus className="h-4 w-4 text-brand-500" />
            New folder
          </button>
        </div>
      )}
    </div>
  )
}

function MediaFolderSidebar({
  activeFolder,
  allFileCount,
  collapsed,
  expandedFolders,
  folderTree,
  folders,
  onCollapse,
  onCollapseAll,
  onCreate,
  onDelete,
  onExpand,
  onRename,
  onSelect,
  onToggle,
}) {
  if (collapsed) {
    return (
      <Card className="hidden h-fit flex-col items-center gap-3 p-2 lg:sticky lg:top-20 lg:flex">
        <button type="button" onClick={onExpand} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" title="Show folder tree" aria-label="Show folder tree">
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => onSelect('all')} className={clsx('rounded-xl p-2', activeFolder === 'all' ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')} title="All files" aria-label="All files">
          <FolderOpen className="h-5 w-5" />
        </button>
        <button type="button" onClick={onCreate} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" title="New folder" aria-label="New folder">
          <FolderPlus className="h-5 w-5" />
        </button>
      </Card>
    )
  }

  return (
    <Card className="hidden h-fit overflow-hidden lg:sticky lg:top-20 lg:block">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Folders</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{folders.length} folder{folders.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onCollapseAll} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" title="Collapse all folders" aria-label="Collapse all folders">
            <ChevronsUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCreate} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" title="New folder" aria-label="New folder">
            <FolderPlus className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCollapse} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" title="Hide folder tree" aria-label="Hide folder tree">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-3">
        <FolderNavButton icon={FolderOpen} label="All files" count={allFileCount} active={activeFolder === 'all'} onClick={() => onSelect('all')} />
        <div className="mt-2 space-y-1">
          {folderTree.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Create folders for campaigns, clients, or channels.
            </div>
          ) : folderTree.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              activeFolder={activeFolder}
              expandedFolders={expandedFolders}
              folder={folder}
              level={0}
              onDelete={onDelete}
              onRename={onRename}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}

function FolderNavButton({ icon: Icon, label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
        active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className={clsx('rounded-full px-1.5 text-[10px]', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>{count}</span>}
    </button>
  )
}

function FolderTreeItem({ activeFolder, expandedFolders, folder, level, onDelete, onRename, onSelect, onToggle }) {
  const hasChildren = folder.children.length > 0
  const expanded = expandedFolders.has(String(folder.id))
  const active = String(activeFolder) === String(folder.id)

  return (
    <div>
      <div className={clsx('group flex items-center rounded-xl transition', active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')} style={{ paddingLeft: `${Math.min(level * 14, 42)}px` }}>
        <span className="ml-1 flex h-8 w-7 shrink-0 items-center justify-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(folder.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={expanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="h-3.5 w-3.5" />}
        </span>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSelect(folder.id)
          }}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-1 text-left"
          title="Open folder"
        >
          {active ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{folder.name}</span>
          <span className={clsx('rounded-full px-1.5 text-[10px]', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400')}>{folder.assets_count || 0}</span>
        </button>
        <div className={clsx('mr-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100', active && 'opacity-100')}>
          <button type="button" onClick={() => onRename(folder)} className={clsx('rounded-lg p-1.5', active ? 'text-white/90 hover:bg-white/15' : 'text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white')} title={`Rename ${folder.name}`} aria-label={`Rename ${folder.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(folder)} className={clsx('rounded-lg p-1.5', active ? 'text-white/90 hover:bg-white/15' : 'text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-slate-900')} title={`Delete ${folder.name}`} aria-label={`Delete ${folder.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              activeFolder={activeFolder}
              expandedFolders={expandedFolders}
              folder={child}
              level={level + 1}
              onDelete={onDelete}
              onRename={onRename}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function buildFolderTree(folders) {
  const map = new Map()
  folders.forEach((folder) => map.set(String(folder.id), { ...folder, children: [] }))
  const roots = []
  map.forEach((folder) => {
    const parent = folder.parent_id ? map.get(String(folder.parent_id)) : null
    if (parent) parent.children.push(folder)
    else roots.push(folder)
  })
  const sortByName = (items) => {
    items.sort((a, b) => String(a.name).localeCompare(String(b.name)))
    items.forEach((item) => sortByName(item.children))
    return items
  }
  return sortByName(roots)
}

function collectFolderIds(folder) {
  const ids = new Set([String(folder.id)])
  ;(folder.children || []).forEach((child) => {
    collectFolderIds(child).forEach((id) => ids.add(id))
  })
  return ids
}

function buildFolderMap(folderTree) {
  const map = new Map()
  const visit = (folder) => {
    map.set(String(folder.id), folder)
    folder.children.forEach(visit)
  }
  folderTree.forEach(visit)
  return map
}

function buildBreadcrumb(activeFolder, folderMap) {
  if (activeFolder === 'all') return [{ id: 'all', label: 'All media files' }]
  if (activeFolder === 'root') return [{ id: 'root', label: 'Unfiled media' }]

  const path = []
  let current = folderMap.get(String(activeFolder))
  while (current) {
    path.unshift({ id: current.id, label: current.name })
    current = current.parent_id ? folderMap.get(String(current.parent_id)) : null
  }

  return [{ id: 'all', label: 'All files' }, ...path]
}

function hasFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

function sortAssets(items, sortMode) {
  const list = [...items]
  return list.sort((a, b) => {
    if (sortMode === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0)
    if (sortMode === 'name_asc') return String(a.original_name || '').localeCompare(String(b.original_name || ''))
    if (sortMode === 'name_desc') return String(b.original_name || '').localeCompare(String(a.original_name || ''))
    if (sortMode === 'size_desc') return Number(b.size || 0) - Number(a.size || 0)
    if (sortMode === 'size_asc') return Number(a.size || 0) - Number(b.size || 0)
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })
}

function FolderBreadcrumb({ items, onSelect }) {
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm font-semibold" aria-label="Media folder breadcrumb">
      {items.map((item, index) => {
        const current = index === items.length - 1
        return (
          <span key={`${item.id}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
            <button
              type="button"
              onClick={() => !current && onSelect(item.id)}
              className={clsx(
                'max-w-[12rem] truncate rounded-lg px-1.5 py-1 text-left transition',
                current
                  ? 'cursor-default text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
              )}
            >
              {item.label}
            </button>
          </span>
        )
      })}
    </nav>
  )
}

function ViewModeControl({ value, onChange }) {
  const options = [
    { key: 'card', label: 'Card view', icon: LayoutGrid },
    { key: 'compact', label: 'Small card view', icon: List },
    { key: 'table', label: 'Table view', icon: Table2 },
  ]

  return (
    <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" aria-label="Media view">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={clsx(
            'inline-flex h-9 w-10 items-center justify-center rounded-lg transition',
            value === key
              ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
          )}
          title={label}
          aria-label={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

function FolderContentLoader() {
  return (
    <span className="inline-flex items-center gap-3 rounded-2xl border border-brand-200 bg-white/95 px-4 py-3 text-sm font-semibold text-brand-700 shadow-xl dark:border-brand-900/60 dark:bg-slate-900/95 dark:text-brand-300">
      <Loader2 className="h-4 w-4 animate-spin" />
      Opening folder...
    </span>
  )
}

function MediaContentView({ assets, folders, viewMode, onDelete, onDropFiles, onPreview, onSelectFolder }) {
  if (viewMode === 'table') {
    return (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Kind</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {folders.map((folder) => (
                <FolderTableRow key={`folder-${folder.id}`} folder={folder} onDropFiles={onDropFiles} onSelect={onSelectFolder} />
              ))}
              {assets.map((asset, index) => (
                <tr key={asset.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onPreview(index)} className="flex min-w-0 items-center gap-3 text-left">
                      <MediaThumb asset={asset} compact />
                      <span className="min-w-0">
                        <span className="block max-w-sm truncate font-semibold text-slate-800 dark:text-slate-100">{asset.original_name}</span>
                        <span className="block text-xs text-slate-400">{asset.mime_type || asset.type}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{asset.type}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatSize(asset.size)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => onDelete(asset)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30" aria-label={`Delete ${asset.original_name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  const compact = viewMode === 'compact'
  const gridClass = compact
    ? 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8'
    : 'grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5'

  return (
    <div className={gridClass}>
      {folders.map((folder) => (
        <FolderTile key={`folder-${folder.id}`} folder={folder} compact={compact} onDropFiles={onDropFiles} onSelect={onSelectFolder} />
      ))}
      {assets.map((asset, index) => (
        <AssetCard key={asset.id} asset={asset} compact={compact} onDelete={onDelete} onPreview={() => onPreview(index)} />
      ))}
    </div>
  )
}

function FolderTile({ folder, compact, onDropFiles, onSelect }) {
  const [over, setOver] = useState(false)

  const drop = (event) => {
    if (!hasFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    setOver(false)
    const files = [...(event.dataTransfer?.files || [])]
    if (files.length) onDropFiles(files, folder.id)
  }

  return (
    <Card className={clsx('group overflow-hidden p-0 transition hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700', over && 'border-brand-400 ring-2 ring-brand-500/30')}>
      <button
        type="button"
        onDoubleClick={() => onSelect(folder.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSelect(folder.id)
        }}
        onDragOver={(event) => {
          if (!hasFileDrag(event)) return
          event.preventDefault()
          event.stopPropagation()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className="block w-full text-left"
        aria-label={`Open folder ${folder.name}`}
        title="Double-click to open folder"
      >
        <div className={clsx('relative flex aspect-square items-center justify-center bg-amber-50 dark:bg-amber-950/25', compact && 'aspect-[1.15]')}>
          {over && <span className="absolute inset-2 rounded-xl border-2 border-dashed border-brand-400 bg-white/50 dark:bg-slate-900/40" />}
          <FolderOpen className={clsx('text-amber-500', compact ? 'h-9 w-9' : 'h-14 w-14')} />
        </div>
        <div className={compact ? 'p-2' : 'p-3'}>
          <p className={clsx('truncate font-semibold text-slate-700 dark:text-slate-200', compact ? 'text-xs' : 'text-sm')}>{folder.name}</p>
          <p className="text-[10px] text-slate-400">{folder.assets_count || 0} files · {folder.children.length} folders</p>
        </div>
      </button>
    </Card>
  )
}

function FolderTableRow({ folder, onDropFiles, onSelect }) {
  const [over, setOver] = useState(false)

  const drop = (event) => {
    if (!hasFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    setOver(false)
    const files = [...(event.dataTransfer?.files || [])]
    if (files.length) onDropFiles(files, folder.id)
  }

  return (
    <tr
      className={clsx('cursor-pointer transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40', over && 'bg-brand-50 dark:bg-brand-950/20')}
      onDoubleClick={() => onSelect(folder.id)}
      onDragOver={(event) => {
        if (!hasFileDrag(event)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
          }}
          className="flex min-w-0 items-center gap-3 text-left"
          onDoubleClick={() => onSelect(folder.id)}
          title="Double-click to open folder"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/30">
            <FolderOpen className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-sm truncate font-semibold text-slate-800 dark:text-slate-100">{folder.name}</span>
            <span className="block text-xs text-slate-400">Drop files here to upload into this folder</span>
          </span>
        </button>
      </td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">folder</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{folder.assets_count || 0} files</td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">-</td>
      <td className="px-4 py-3 text-right text-slate-400">{folder.children.length} subfolders</td>
    </tr>
  )
}

function AssetCard({ asset, compact, onDelete, onPreview }) {
  return (
    <Card className="group relative overflow-hidden p-0">
      <button
        type="button"
        onClick={onPreview}
        className="block w-full text-left"
        aria-label={`Preview ${asset.original_name}`}
      >
        <div className={clsx('relative flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-800', compact && 'aspect-[1.15]')}>
          <MediaThumb asset={asset} large={!compact} />
        </div>
        <div className={compact ? 'p-2' : 'p-2'}>
          <p className="truncate text-xs text-slate-600 dark:text-slate-300">{asset.original_name}</p>
          <p className="text-[10px] text-slate-400">{formatSize(asset.size)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onDelete(asset)}
        className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 opacity-0 shadow transition group-hover:opacity-100 dark:bg-slate-900/90"
        aria-label={`Delete ${asset.original_name}`}
      >
        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
      </button>
    </Card>
  )
}

function MediaThumb({ asset, compact = false, large = false }) {
  if (compact) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
        {asset.type === 'video' ? (
          <FileVideo className="h-5 w-5 text-slate-400" />
        ) : asset.type === 'document' ? (
          <FileText className="h-5 w-5 text-slate-400" />
        ) : (
          <img src={mediaUrl(asset.thumbnail_url || asset.url)} alt={asset.original_name} className="h-full w-full object-cover" loading="lazy" />
        )}
      </span>
    )
  }

  if (asset.type === 'video') {
    return (
      <>
        <FileVideo className={clsx('text-slate-400', compact ? 'h-5 w-5' : large ? 'h-10 w-10' : 'h-8 w-8')} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
          <Play className="h-8 w-8 text-white drop-shadow" />
        </span>
      </>
    )
  }

  if (asset.type === 'document') {
    return <FileText className={clsx('text-slate-400', compact ? 'h-5 w-5' : large ? 'h-10 w-10' : 'h-8 w-8')} />
  }

  return (
    <img
      src={mediaUrl(asset.thumbnail_url || asset.url)}
      alt={asset.original_name}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  )
}

function MediaPreviewModal({ asset, onClose, onNext, onPrevious, hasNavigation, folders, onSaved }) {
  const src = mediaUrl(asset.url)
  const [form, setForm] = useState({ original_name: asset.original_name || '', alt_text: asset.alt_text || '', folder_id: asset.folder_id || '' })
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(true)

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

function UploadQueue({ items, onCancel, onClose }) {
  const activeCount = items.filter((item) => item.status === 'uploading').length

  return (
    <div className="fixed bottom-4 right-4 z-[95] w-[min(28rem,calc(100vw_-_2rem))]">
      <Card className="overflow-hidden border-brand-200 bg-white p-0 shadow-2xl shadow-slate-900/15 dark:border-brand-900/50 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white">Uploading files</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeCount > 0 ? `${activeCount} active upload${activeCount === 1 ? '' : 's'}` : 'Uploads finished'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">{items.length}</span>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close upload progress">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto p-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {item.localUrl && item.type === 'image' ? <img src={item.localUrl} alt="" className="h-full w-full object-cover" /> : item.localUrl && item.type === 'video' ? <video src={item.localUrl} className="h-full w-full object-cover" muted /> : <FileText className="h-6 w-6 text-slate-400" />}
                {item.status === 'uploading' && <span className="absolute inset-0 flex items-center justify-center bg-black/35"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.name}</p>
                    <p className="text-[11px] text-slate-400">{formatSize(item.size)}</p>
                  </div>
                  <button type="button" onClick={() => onCancel(item.id)} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-rose-500 dark:hover:bg-slate-800" aria-label={`Cancel ${item.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full rounded-full transition-all duration-300 ${item.status === 'error' ? 'bg-rose-500' : item.status === 'done' ? 'bg-emerald-500' : 'bg-brand-600'}`} style={{ width: `${item.progress}%` }} />
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
    </div>
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
