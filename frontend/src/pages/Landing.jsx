import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Calendar, Workflow, BarChart3, Users, Wand2, ShieldCheck,
  Check, ArrowRight, Image as ImageIcon, Clock,
} from 'lucide-react'
import api from '../lib/api'
import { Button } from '../components/ui'
import { PLATFORMS } from '../components/PlatformBadge'

const FEATURES = [
  { icon: Calendar, title: 'Schedule everywhere', desc: 'Compose once and publish to 19+ networks at the perfect time with a drag-and-drop calendar.' },
  { icon: Wand2, title: 'AI copywriter', desc: 'Generate captions, hooks, hashtags and platform variations in a click.' },
  { icon: Workflow, title: 'Automations', desc: 'Auto-post from RSS, recycle evergreen content, and repost your best performers.' },
  { icon: BarChart3, title: 'Unified analytics', desc: 'Track reach, engagement and growth across every account in one dashboard.' },
  { icon: Users, title: 'Team collaboration', desc: 'Approval workflows, roles, comments and an activity log for your whole team.' },
  { icon: ShieldCheck, title: 'Secure by design', desc: 'Encrypted tokens, 2FA, audit logs and granular role-based access control.' },
]

export default function Landing() {
  const [plans, setPlans] = useState([])
  const [yearly, setYearly] = useState(false)

  useEffect(() => {
    api.get('/plans').then(({ data }) => setPlans(data.data)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">Postflow</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <a href="#features" className="hover:text-brand-600">Features</a>
            <a href="#platforms" className="hover:text-brand-600">Platforms</a>
            <a href="#pricing" className="hover:text-brand-600">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300">Log in</Link>
            <Link to="/register"><Button size="sm">Start free</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />
        <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
            <Sparkles className="h-4 w-4" /> All your social media, automated
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-extrabold tracking-tight sm:text-6xl">
            Schedule, automate &amp; grow on
            <span className="bg-gradient-to-r from-brand-600 to-violet-500 bg-clip-text text-transparent"> every platform</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Connect Facebook, Instagram, TikTok, X, LinkedIn, YouTube and more. Plan content,
            collaborate with your team, and let AI + automations do the heavy lifting.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register"><Button size="lg" className="w-full sm:w-auto">Start your free trial <ArrowRight className="h-4 w-4" /></Button></Link>
            <a href="#pricing"><Button size="lg" variant="secondary" className="w-full sm:w-auto">View pricing</Button></a>
          </div>
          <p className="mt-4 text-sm text-slate-400">No credit card required · 14-day Pro trial</p>

          {/* Mock dashboard preview */}
          <div className="mx-auto mt-16 max-w-5xl rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-2 shadow-2xl dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <div className="grid grid-cols-3 gap-2">
              {['Scheduled', 'Published', 'Engagement'].map((t, i) => (
                <div key={t} className="rounded-xl bg-white p-4 text-left shadow-sm dark:bg-slate-800">
                  <div className="text-xs text-slate-400">{t}</div>
                  <div className="mt-1 text-2xl font-bold">{[128, 1240, '4.8%'][i]}</div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-emerald-500"><Clock className="h-3 w-3" /> live demo</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section id="platforms" className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Publish to 19+ networks</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {Object.entries(PLATFORMS).map(([key, meta]) => (
              <div key={key} className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold uppercase text-white shadow-sm" style={{ backgroundColor: meta.c }}>
                {meta.g}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold tracking-tight">Everything you need to run social</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            A complete command center for creators, teams and agencies.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-slate-200 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h2>
            <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-slate-300 bg-white p-1 text-sm dark:border-slate-700 dark:bg-slate-800">
              <button onClick={() => setYearly(false)} className={`rounded-full px-4 py-1.5 ${!yearly ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>Monthly</button>
              <button onClick={() => setYearly(true)} className={`rounded-full px-4 py-1.5 ${yearly ? 'bg-brand-600 text-white' : 'text-slate-500'}`}>Yearly · save 20%</button>
            </div>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm dark:bg-slate-900 ${
                  plan.is_featured ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {plan.is_featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-extrabold">${yearly ? plan.price_yearly : plan.price_monthly}</span>
                  <span className="pb-1 text-sm text-slate-400">/{yearly ? 'yr' : 'mo'}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {(plan.features || []).map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="mt-6">
                  <Button variant={plan.is_featured ? 'primary' : 'secondary'} className="w-full">
                    {plan.price_monthly === 0 ? 'Get started' : 'Start trial'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-brand-600 to-violet-600 px-8 py-16 text-center text-white">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to put your social media on autopilot?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-100">Join thousands of creators and teams scheduling smarter.</p>
          <Link to="/register" className="mt-8 inline-block">
            <Button size="lg" variant="secondary">Create your free account</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          <span className="font-semibold text-slate-600 dark:text-slate-300">Postflow</span>
        </div>
        <p className="mt-2">Social Automation SaaS · Built with Laravel + React</p>
      </footer>
    </div>
  )
}
