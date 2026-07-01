import { ExternalLink } from 'lucide-react'
import { Badge, Modal } from '../ui'

export default function FeedItemModal({ item, onClose }) {
  return (
    <Modal
      open={Boolean(item)}
      title={item?.title || 'Feed item'}
      description={item ? `${item.source || item.feed?.title || 'RSS feed'} - ${formatDate(item.published_at || item.created_at)}` : ''}
      onClose={onClose}
      size="lg"
      fullscreenable
    >
      {item && (
        <div className="space-y-4 p-5">
          {item.image_url && <img src={item.image_url} alt="" className="max-h-80 w-full rounded-2xl object-cover" />}
          <div className="flex flex-wrap gap-2">
            <Badge color="sky">{item.category || 'General'}</Badge>
            <Badge>{item.country || 'Global'}</Badge>
          </div>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{item.summary || 'No summary available.'}</p>
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Open original <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </Modal>
  )
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString()
}
