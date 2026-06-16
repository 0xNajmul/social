import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Image as ImageIcon } from 'lucide-react'
import api from '../lib/api'
import { mediaUrl } from '../lib/media'
import { Button, Card, Input, PageLoader, Textarea } from '../components/ui'

export default function MediaEdit() {
  const { id } = useParams()
  const [asset, setAsset] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', name: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get(`/media/${id}`).then(({ data }) => {
      const item = data.data
      setAsset(item)
      setForm({
        title: item.original_name || '',
        description: item.alt_text || '',
        name: item.original_name || '',
        content: '',
      })
    }).catch(() => setAsset(false))
  }, [id])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const { data } = await api.put(`/media/${id}`, {
        original_name: form.name || form.title,
        alt_text: form.description,
      })
      setAsset(data.data)
      setMessage('Media details saved.')
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not save media details.')
    } finally {
      setSaving(false)
    }
  }

  if (asset === null) return <PageLoader />
  if (asset === false) {
    return (
      <Card className="p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-3 font-semibold text-slate-900 dark:text-white">Media not found</p>
        <Link to="/app/media" className="mt-4 inline-block"><Button variant="secondary">Back to media</Button></Link>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/app/media" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
          <ArrowLeft className="h-4 w-4" /> Back to media
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit media</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update title, description, name, and content notes for this asset.</p>
      </div>

      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.startsWith('Media') ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'}`}>{message}</div>}

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-800">
            {asset.type === 'image' || asset.type === 'gif' ? (
              <img src={mediaUrl(asset.thumbnail_url || asset.url)} alt={asset.alt_text || asset.original_name} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-12 w-12 text-slate-400" />
            )}
          </div>
          <div className="p-4">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{asset.original_name}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ID #{asset.id} · {asset.mime_type}</p>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Textarea label="Content" rows={8} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="" />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link to="/app/media"><Button type="button" variant="ghost">Cancel</Button></Link>
            <Button type="submit" loading={saving}>Save media</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
