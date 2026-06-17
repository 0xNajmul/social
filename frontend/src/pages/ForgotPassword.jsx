import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button, Input } from '../components/ui'
import api from '../lib/api'
import { AuthShell } from './Login'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/forgot-password', { email })
      setMessage(data.message || 'Check your email for reset instructions.')
    } catch (err) {
      setError(err.response?.data?.errors?.email?.[0] || err.response?.data?.message || 'Could not send reset instructions.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we will send reset instructions.">
      <form onSubmit={submit} className="space-y-4">
        {message && (
          <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">{error}</div>}
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
        <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it? <Link to="/login" className="font-semibold text-brand-600">Log in</Link>
      </p>
    </AuthShell>
  )
}
