import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'
import { AuthShell } from './Login'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '', workspace_name: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      await register({ ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      navigate('/app')
    } catch (err) {
      setErrors(err.response?.data?.errors || { email: [err.response?.data?.message || 'Something went wrong'] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Start your 14-day free trial">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Full name" value={form.name} onChange={set('name')} required error={errors.name?.[0]} />
        <Input label="Work email" type="email" value={form.email} onChange={set('email')} required error={errors.email?.[0]} />
        <Input label="Workspace name" value={form.workspace_name} onChange={set('workspace_name')} placeholder="My Brand" />
        <Input label="Password" type="password" value={form.password} onChange={set('password')} required error={errors.password?.[0]} />
        <Input label="Confirm password" type="password" value={form.password_confirmation} onChange={set('password_confirmation')} required />
        <Button type="submit" loading={loading} className="w-full">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <Link to="/login" className="font-semibold text-brand-600">Log in</Link>
      </p>
    </AuthShell>
  )
}
