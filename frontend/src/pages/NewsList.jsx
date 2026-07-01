import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Image as ImageIcon, Search, X } from 'lucide-react'
import api from '../lib/api'
import { Badge, Card, PageLoader } from '../components/ui'
import PublicSiteLayout from '../components/public/PublicSiteLayout'

export default function NewsList() {
  const [posts, setPosts] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.title = 'Latest news - Postflow'
    api.get('/public/news', { params: { limit: 24 } })
      .then(({ data }) => setPosts(data.data || []))
      .catch(() => setPosts([]))
  }, [])

  const filteredPosts = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return posts || []

    return (posts || []).filter((post) => {
      const keywords = Array.isArray(post.meta_keywords) ? post.meta_keywords.join(' ') : ''
      return [
        post.title,
        post.summary,
        post.meta_description,
        post.category,
        post.author,
        keywords,
      ].filter(Boolean).join(' ').toLowerCase().includes(term)
    })
  }, [posts, query])

  if (!posts) {
    return (
      <PublicSiteLayout>
        <PageLoader />
      </PublicSiteLayout>
    )
  }

  return (
    <PublicSiteLayout>
      <main className="px-5 py-10 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-8 dark:border-slate-800 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">Newsroom</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Latest news</h1>
              <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">Product updates, company announcements, publishing tips, and platform news from Postflow.</p>
            </div>
            <div className="w-full space-y-3 lg:max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search news..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label="Clear news search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex justify-start lg:justify-end">
                <Badge color="indigo">{query ? `${filteredPosts.length} of ${posts.length}` : posts.length} updates</Badge>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPosts.map((post) => (
              <Link key={post.id} to={`/news/${post.slug}`} className="group">
                <Card className="h-full overflow-hidden transition group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-slate-900/10 dark:group-hover:shadow-black/30">
                  <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-900">
                    {post.hero_image_url ? <img src={post.hero_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-10 w-10" /></div>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">{post.category || 'News'}</span>
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Published'}</span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-xl font-bold text-slate-950 dark:text-white">{post.title}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{post.summary || post.meta_description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-600 dark:text-brand-300">Read story <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {posts.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-bold">No news published yet</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Published admin news posts will appear here automatically.</p>
            </div>
          )}

          {posts.length > 0 && filteredPosts.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-bold">No matching news</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try a different title, category, author, or keyword.</p>
            </div>
          )}
        </div>
      </main>
    </PublicSiteLayout>
  )
}
