import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Image as ImageIcon } from 'lucide-react'
import api from '../lib/api'
import { Badge, PageLoader } from '../components/ui'
import PublicSiteLayout from '../components/public/PublicSiteLayout'
import RelatedNewsSidebar from '../components/public/RelatedNewsSidebar'

export default function NewsDetail() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [related, setRelated] = useState([])
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setPost(null)
    setRelated([])
    setMissing(false)
    Promise.all([
      api.get(`/public/news/${slug}`),
      api.get('/public/news', { params: { limit: 8 } }),
    ])
      .then(([postResponse, relatedResponse]) => {
        const newsPost = postResponse?.data?.data
        setPost(newsPost)
        setRelated(relatedResponse?.data?.data || [])
        document.title = newsPost?.meta_title || `${newsPost?.title || 'News'} - Postflow`
        if (newsPost?.meta_description) {
          document.querySelector('meta[name="description"]')?.setAttribute('content', newsPost.meta_description)
        }
      })
      .catch(() => setMissing(true))
  }, [slug])

  if (missing) {
    return (
      <PublicSiteLayout>
        <main className="flex min-h-[55vh] items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-black">News not found</h1>
            <p className="mt-3 text-slate-500 dark:text-slate-400">The update may be unpublished or no longer available.</p>
            <Link to="/news" className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white">View all news</Link>
          </div>
        </main>
      </PublicSiteLayout>
    )
  }

  if (!post) {
    return (
      <PublicSiteLayout>
        <PageLoader />
      </PublicSiteLayout>
    )
  }

  return (
    <PublicSiteLayout>
      <main className="px-5 py-10 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <article className="min-w-0">
            <Link to="/news" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-600 dark:text-slate-400">
              <ArrowLeft className="h-4 w-4" /> All news
            </Link>
            <header className="mt-8">
              <div className="flex flex-wrap items-center gap-3">
                <Badge color="indigo">{post.category || 'News'}</Badge>
                <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400"><CalendarDays className="h-4 w-4" /> {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Published'}</span>
                {post.author && <span className="text-sm text-slate-500 dark:text-slate-400">By {post.author}</span>}
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight tracking-[-0.05em] sm:text-6xl">{post.title}</h1>
              {post.summary && <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{post.summary}</p>}
            </header>

            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-900">
                {post.hero_image_url ? <img src={post.hero_image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-12 w-12" /></div>}
              </div>
              <div className="prose prose-slate max-w-none whitespace-pre-line p-6 text-slate-700 dark:prose-invert dark:text-slate-200 sm:p-8">
                {post.body}
              </div>
            </div>
          </article>

          <RelatedNewsSidebar posts={related} currentSlug={post.slug} title="Related news" />
        </div>
      </main>
    </PublicSiteLayout>
  )
}
