import { useEffect, useState } from 'react'
import { Camera, UserRound } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button, Card, Input } from '../components/ui'

export default function Profile() {
  const { user, reload } = useAuth()
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    timezone: user.timezone || 'UTC',
    locale: user.locale || 'en',
  })
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState(null)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setMessage('')
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setMessage('')

    const payload = new FormData()
    Object.entries(form).forEach(([key, value]) => payload.append(key, value))
    if (avatar) payload.append('avatar', avatar)

    try {
      await api.post('/profile', payload)
      await reload()
      setAvatar(null)
      setPreview(null)
      setMessage('Your profile has been updated.')
    } catch (error) {
      setErrors(error.response?.data?.errors || {})
      setMessage(error.response?.data?.message || 'Could not update your profile.')
    } finally {
      setSaving(false)
    }
  }

  const avatarUrl = preview || user?.avatar_url

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update your personal details and profile picture.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile preview" className="h-24 w-24 rounded-2xl object-cover ring-4 ring-slate-100 dark:ring-slate-800" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 ring-4 ring-slate-100 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-slate-800">
                <UserRound className="h-10 w-10" />
              </div>
            )}

            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                <Camera className="h-4 w-4" />
                Choose photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    setAvatar(file)
                    setPreview(file ? URL.createObjectURL(file) : null)
                    setErrors((current) => ({ ...current, avatar: undefined }))
                    setMessage('')
                  }}
                />
              </label>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">JPG, PNG, or WebP. Maximum size 2 MB.</p>
              {errors.avatar && <p className="mt-1 text-xs text-rose-500">{errors.avatar[0]}</p>}
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Personal information</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">These details are used across your workspace.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={updateField('name')} error={errors.name?.[0]} required />
            <Input label="Email address" type="email" value={form.email} onChange={updateField('email')} error={errors.email?.[0]} required />
            <Input label="Timezone" value={form.timezone} onChange={updateField('timezone')} error={errors.timezone?.[0]} placeholder="Asia/Dhaka" required />
            <Input label="Language" value={form.locale} onChange={updateField('locale')} error={errors.locale?.[0]} placeholder="en" required />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className={message.startsWith('Your') ? 'text-sm text-emerald-600 dark:text-emerald-400' : 'text-sm text-rose-600 dark:text-rose-400'}>
              {message}
            </p>
            <Button type="submit" loading={saving}>Save changes</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
