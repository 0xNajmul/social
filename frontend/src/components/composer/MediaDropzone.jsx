import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Film, FileText, Loader2, Pencil, X, Upload } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import { ACCEPTED_LABEL, ACCEPTED_MIME } from '../../lib/platformMedia'
import { Button, Input, Modal } from '../ui'

export default function MediaDropzone({
  items,
  onChange,
  disabled,
  accept = ACCEPTED_MIME,
  acceptedLabel = ACCEPTED_LABEL,
  multiple = true,
  prompt = 'Drop images, videos, or files here',
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ original_name: '', alt_text: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const uploadFiles = useCallback(
    async (fileList) => {
      const files = multiple ? [...fileList] : [...fileList].slice(0, 1)
      if (!files.length || disabled) return

      setUploading(true)

      try {
        for (const file of files) {
          const localUrl = URL.createObjectURL(file)
          const tempId = `local-${Date.now()}-${Math.random()}`
          const pending = {
            id: tempId,
            localUrl,
            original_name: file.name,
            type: file.type.startsWith('video/')
              ? 'video'
              : file.type.startsWith('image/gif')
                ? 'gif'
                : file.type.startsWith('image/')
                  ? 'image'
                  : 'document',
            mime_type: file.type,
            uploading: true,
          }

          onChange((current) => [...current, pending])

          try {
            const form = new FormData()
            form.append('file', file)
            const { data } = await api.post('/media', form, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })

            const asset = data.data
            onChange((current) =>
              current.map((m) =>
                m.id === tempId
                  ? {
                      ...asset,
                      localUrl,
                      url: mediaUrl(asset.url),
                      thumbnail_url: mediaUrl(asset.thumbnail_url || asset.url),
                    }
                  : m,
              ),
            )
          } catch (e) {
            onChange((current) => current.filter((m) => m.id !== tempId))
            URL.revokeObjectURL(localUrl)
            throw e
          }
        }
      } catch (e) {
        alert(e.response?.data?.message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [disabled, multiple, onChange],
  )

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  const remove = (id) => {
    const item = items.find((m) => m.id === id)
    if (item?.localUrl?.startsWith('blob:')) URL.revokeObjectURL(item.localUrl)
    onChange(items.filter((m) => m.id !== id))
  }

  const openEdit = (item) => {
    setEditing(item)
    setEditForm({ original_name: item.original_name || '', alt_text: item.alt_text || '' })
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editing) return
    setSavingEdit(true)
    try {
      let updated = { ...editing, ...editForm }
      if (typeof editing.id === 'number') {
        const { data } = await api.put(`/media/${editing.id}`, editForm)
        updated = {
          ...editing,
          ...data.data,
          url: mediaUrl(data.data.url || editing.url),
          thumbnail_url: mediaUrl(data.data.thumbnail_url || data.data.url || editing.thumbnail_url || editing.url),
        }
      }
      onChange((current) => current.map((item) => item.id === editing.id ? updated : item))
      setEditing(null)
    } catch (error) {
      alert(error.response?.data?.message || 'Could not update image details.')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          'relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition',
          dragging
            ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-900/20'
            : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50/80 dark:border-slate-600 dark:hover:border-brand-500 dark:hover:bg-slate-800/50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {prompt}
        </p>
        <p className="mt-1 text-xs text-slate-500">or click to browse · {acceptedLabel}</p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => (
            <MediaThumb key={item.id} item={item} onEdit={() => openEdit(item)} onRemove={() => remove(item.id)} />
          ))}
        </div>
      )}

      <Modal open={Boolean(editing)} title="Edit image" description={editing?.original_name} onClose={() => setEditing(null)} size="md">
        <form onSubmit={saveEdit} className="space-y-4 p-5">
          {editing && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
              {editing.type === 'video' ? (
                <video src={mediaUrl(editing.url || editing.localUrl)} className="max-h-64 w-full object-contain" muted controls />
              ) : editing.type === 'document' ? (
                <div className="flex h-44 items-center justify-center text-slate-400"><FileText className="h-10 w-10" /></div>
              ) : (
                <img src={mediaUrl(editing.thumbnail_url || editing.url || editing.localUrl)} alt="" className="max-h-64 w-full object-contain" />
              )}
            </div>
          )}
          <Input label="Image name" value={editForm.original_name} onChange={(event) => setEditForm({ ...editForm, original_name: event.target.value })} required />
          <Input label="Alt text" value={editForm.alt_text} onChange={(event) => setEditForm({ ...editForm, alt_text: event.target.value })} placeholder="Describe this image for accessibility" />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={savingEdit}><Pencil className="h-4 w-4" /> Save image</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function MediaThumb({ item, onEdit, onRemove }) {
  const isVideo = item.type === 'video'
  const isDoc = item.type === 'document'
  const src = mediaUrl(item.thumbnail_url || item.url || item.localUrl)

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      <div className="aspect-[4/3]">
        {isDoc ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-slate-500">
            <FileText className="h-7 w-7" />
            <span className="line-clamp-2 text-center text-[10px]">{item.original_name}</span>
          </div>
        ) : isVideo ? (
          <div className="relative h-full w-full bg-black">
            <video src={src} className="h-full w-full object-cover" muted />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Film className="h-6 w-6 text-white" />
            </span>
          </div>
        ) : (
          <img src={src} alt="" className="h-full w-full object-cover" />
        )}
        {item.uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {!item.uploading && (item.type === 'image' || item.type === 'gif') && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="absolute left-1.5 top-1.5 rounded-full bg-white/95 p-1.5 text-slate-700 opacity-0 shadow transition group-hover:opacity-100 dark:bg-slate-900/95 dark:text-slate-200"
          aria-label={`Edit ${item.original_name || 'image'}`}
          title="Edit image"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
        {isVideo ? 'Video' : isDoc ? 'File' : item.type === 'gif' ? 'GIF' : 'Image'}
      </span>
    </div>
  )
}

export { ImagePlus }
