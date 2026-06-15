import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Film, FileText, Loader2, X, Upload } from 'lucide-react'
import clsx from 'clsx'
import api from '../../lib/api'
import { mediaUrl } from '../../lib/media'
import { ACCEPTED_LABEL, ACCEPTED_MIME } from '../../lib/platformMedia'

export default function MediaDropzone({ items, onChange, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const uploadFiles = useCallback(
    async (fileList) => {
      const files = [...fileList]
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
    [disabled, onChange],
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
          multiple
          accept={ACCEPTED_MIME}
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
          Drop images, videos, or files here
        </p>
        <p className="mt-1 text-xs text-slate-500">or click to browse · {ACCEPTED_LABEL}</p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <MediaThumb key={item.id} item={item} onRemove={() => remove(item.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MediaThumb({ item, onRemove }) {
  const isVideo = item.type === 'video'
  const isDoc = item.type === 'document'
  const src = mediaUrl(item.thumbnail_url || item.url || item.localUrl)

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      <div className="aspect-square">
        {isDoc ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-slate-500">
            <FileText className="h-10 w-10" />
            <span className="line-clamp-2 text-center text-[10px]">{item.original_name}</span>
          </div>
        ) : isVideo ? (
          <div className="relative h-full w-full bg-black">
            <video src={src} className="h-full w-full object-cover" muted />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Film className="h-8 w-8 text-white" />
            </span>
          </div>
        ) : (
          <img src={src} alt="" className="h-full w-full object-cover" />
        )}
        {item.uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <span className="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
        {isVideo ? 'Video' : isDoc ? 'File' : item.type === 'gif' ? 'GIF' : 'Image'}
      </span>
    </div>
  )
}

export { ImagePlus }
