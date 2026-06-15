import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'
import api, { tokenStore } from '../lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
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

  useEffect(() => {
    const token = params.get('google_token')
    if (!token) return
    tokenStore.set(token)
    window.location.replace('/')
  }, [navigate, params])

  const googleLogin = async () => {
    setError('')
    try {
      const { data } = await api.get('/auth/google/redirect', { params: { admin: 1 } })
      window.location.href = data.url
    } catch (err) {
      setError(err.response?.data?.message || 'Google login is not configured yet.')
    }
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
            {(error || params.get('google_error')) && <div className="rounded-xl bg-rose-900/30 px-4 py-3 text-sm text-rose-300">{error || `Google login failed: ${params.get('google_error')}`}</div>}
            <Button type="button" variant="secondary" onClick={googleLogin} className="w-full">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-slate-800">G</span>
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-800" /> or <span className="h-px flex-1 bg-slate-800" /></div>
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
