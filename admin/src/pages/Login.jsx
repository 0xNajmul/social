import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@social-automation.test')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await login(email, password); navigate('/') }
    catch (err) { setError(err.response?.data?.message || err.message || 'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white"><ShieldAlert className="h-5 w-5" /></div>
          <span className="text-xl font-bold text-white">Admin Console</span>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h1 className="text-2xl font-bold text-white">Administrator sign in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-400">Restricted to platform operators.</p>
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-xl bg-rose-900/30 px-4 py-3 text-sm text-rose-300">{error}</div>}
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" loading={loading} className="w-full">Sign in</Button>
          </form>
          <p className="mt-3 rounded-lg bg-slate-800 p-3 text-center text-xs text-slate-500">Demo: admin@social-automation.test / password</p>
        </div>
      </div>
    </div>
  )
}
