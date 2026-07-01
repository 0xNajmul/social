import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Image as ImageIcon } from 'lucide-react'

export default function RelatedNewsSidebar({ posts = [], currentSlug, title = 'Related news' }) {
  const related = posts.filter((post) => post.slug !== currentSlug).slice(0, 5)

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">Newsroom</p>
            <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{title}</h2>
          </div>
          <Link to="/news" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400">All</Link>
        </div>

        <div className="mt-4 space-y-3">
          {related.map((post) => (
            <Link key={post.id || post.slug} to={`/news/${post.slug}`} className="group grid grid-cols-[5.25rem_1fr] gap-3 rounded-2xl p-2 transition hover:bg-slate-50 dark:hover:bg-slate-800/70">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {post.hero_image_url ? <img src={post.hero_image_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-5 w-5" /></div>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="max-w-24 truncate font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">{post.category || 'News'}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Published'}</span>
                </div>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-300">{post.title}</h3>
                {post.meta_description || post.summary ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{post.meta_description || post.summary}</p> : null}
              </div>
            </Link>
          ))}

          {related.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              More published news will appear here.
            </div>
          )}
        </div>

        <Link to="/news" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 dark:bg-white dark:text-slate-950 dark:hover:bg-brand-100">
          Browse newsroom <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  )
}
