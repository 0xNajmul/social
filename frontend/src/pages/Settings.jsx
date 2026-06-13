import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Card, Button, Input, PageLoader } from '../components/ui'

export default function Settings() {
  const { activeWorkspace, reload } = useAuth()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/workspace').then(({ data }) => setForm({ name: data.data.name, timezone: data.data.timezone, brand_color: data.data.brand_color || '#6366f1' }))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/workspace', form)
      await reload()
      alert('Settings saved.')
    } catch (e) { alert(e.response?.data?.message || 'Could not save') }
    finally { setSaving(false) }
  }

  if (!form) return <PageLoader />

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace settings</h1>
      <Card className="space-y-4 p-6">
        <Input label="Workspace name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Brand color</span>
          <input type="color" value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} className="h-11 w-20 rounded-xl border border-slate-300 dark:border-slate-700" />
        </label>
        <Button onClick={save} loading={saving}>Save changes</Button>
      </Card>
    </div>
  )
}
