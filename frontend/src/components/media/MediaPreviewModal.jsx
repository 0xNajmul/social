import { FileText, Image as ImageIcon } from 'lucide-react'
import { Modal } from '../ui'
import { mediaUrl } from '../../lib/media'

export default function MediaPreviewModal({ item, open = Boolean(item), onClose }) {
  const src = mediaUrl(item?.url || item?.thumbnail_url || item?.localUrl)
  const title = item?.original_name || item?.name || 'Media preview'

  return (
    <Modal open={open} title={title} description={item?.mime_type || item?.type || 'Preview'} onClose={onClose} size="screen" fullscreenable>
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-950 p-4">
        {item?.type === 'video' ? (
          <video src={src} className="max-h-[78vh] max-w-full rounded-xl object-contain" controls />
        ) : item?.type === 'document' ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 text-white">
            <FileText className="h-12 w-12" />
            <p className="max-w-sm text-center text-sm">{title}</p>
          </div>
        ) : src ? (
          <img src={src} alt={title} className="max-h-[78vh] max-w-full rounded-xl object-contain shadow-2xl" />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 text-white">
            <ImageIcon className="h-12 w-12" />
            <p className="text-sm">No preview available.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
