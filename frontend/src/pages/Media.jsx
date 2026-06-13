import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, FileVideo, Image as ImageIcon } from 'lucide-react'
import api from '../lib/api'
import { Card, Button, PageLoader, EmptyState } from '../components/ui'

export default function Media() {
  const [assets, setAssets] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const load = () => api.get('/media').then(({ data }) => setAssets(data.data))
  useEffect(() => { load() }, [])

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
    load()
  }

  if (!assets) return <PageLoader />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Media library</h1>
          <p className="text-sm text-slate-500">Upload and reuse images and videos across posts.</p>
        </div>
        <Button onClick={() => fileRef.current?.click()} loading={uploading}><Upload className="h-4 w-4" /> Upload</Button>
        <input ref={fileRef} type="file" hidden onChange={upload} accept="image/*,video/*" />
      </div>

      {assets.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No media yet" description="Upload your first image or video to get started." action={<Button onClick={() => fileRef.current?.click()}>Upload media</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((m) => (
            <Card key={m.id} className="group relative overflow-hidden p-0">
              <div className="flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-800">
                {m.type === 'video' ? (
                  <FileVideo className="h-10 w-10 text-slate-400" />
                ) : (
                  <img src={m.thumbnail_url || m.url} alt={m.original_name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs text-slate-600 dark:text-slate-300">{m.original_name}</p>
                <p className="text-[10px] text-slate-400">{(m.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => remove(m.id)} className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 opacity-0 shadow transition group-hover:opacity-100 dark:bg-slate-900/90">
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
