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
      window.location.assign(data.url)
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
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200">Forgot password?</Link>
        </div>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden min-h-screen flex-col overflow-hidden border-r border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#ecfeff_100%)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a_0%,#111827_55%,#082f49_100%)] lg:flex">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(15,23,42,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.07)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-30 dark:[background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)]" />
          <div className="relative flex h-20 items-center px-6 lg:px-10">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold text-slate-950 dark:text-white">Postflow</span>
            </Link>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
            <div className="w-full max-w-xl space-y-4">
              <div className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-black/20">
                <span className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold uppercase text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">Social automation suite</span>
                <h2 className="mt-4 max-w-lg text-3xl font-extrabold text-slate-950 dark:text-white">Plan, publish, and measure every channel from one calm workspace.</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">Composer, organizer, analytics, media, automations, and approvals stay connected for teams that publish every day.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AuthStat icon={CalendarCheck2} label="Scheduled posts" value="12k+" tone="brand" />
                <AuthStat icon={Users} label="Team actions" value="38k" tone="emerald" />
                <AuthStat icon={BarChart3} label="Tracked impressions" value="4.8M" tone="sky" />
                <AuthStat icon={ShieldCheck} label="Workspace uptime" value="99.9%" tone="amber" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <AuthInfoCard title="Campaign command" text="Review drafts, approvals, and schedules from one operational view." />
                <AuthInfoCard title="Connected reporting" text="Keep publishing context and performance signals close together." />
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-white/85 px-6 py-10 dark:bg-slate-950 lg:px-12">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Postflow</span>
            </Link>
            <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
              <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function AuthStat({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-200',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-200',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-200',
  }

  return (
    <div className="rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone] || tones.brand}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function AuthInfoCard({ title, text }) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  )
}
