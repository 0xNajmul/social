import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, CalendarCheck2, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'
import api from '../lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('demo@social-automation.test')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = async () => {
    setError('')
    try {
      const { data } = await api.get('/auth/google/redirect')
      window.location.href = data.url
    } catch (err) {
      setError(err.response?.data?.message || 'Google login is not configured yet.')
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Postflow account">
      <form onSubmit={submit} className="space-y-4">
        {(error || params.get('google_error')) && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">{error || `Google login failed: ${params.get('google_error')}`}</div>}
        <Button type="button" variant="secondary" onClick={googleLogin} className="w-full">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-slate-800">G</span>
          Continue with Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" loading={loading} className="w-full">Log in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        No account? <Link to="/register" className="font-semibold text-brand-600">Sign up free</Link>
      </p>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-400 dark:bg-slate-800">
        Demo: demo@social-automation.test / password
      </p>
    </AuthShell>
  )
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden lg:block">
          <Link to="/" className="mb-8 inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Postflow</span>
          </Link>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white p-8 shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative">
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">Social automation suite</span>
              <h2 className="mt-5 max-w-xl text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">Plan, publish, and measure every channel from one calm workspace.</h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">Create reusable publishing workflows, coordinate teams, automate social posts, and keep reporting close to the work.</p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <AuthStat icon={CalendarCheck2} label="Scheduled posts" value="12k+" />
                <AuthStat icon={Users} label="Team actions" value="38k" />
                <AuthStat icon={BarChart3} label="Tracked impressions" value="4.8M" />
                <AuthStat icon={ShieldCheck} label="Workspace uptime" value="99.9%" />
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Built for teams that publish daily</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Composer, organizer, analytics, media, automations, and approvals stay connected so campaigns do not drift across tools.</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">Postflow</span>
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <Icon className="h-5 w-5 text-brand-500" />
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
