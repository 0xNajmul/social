import { ExternalLink, Image, MessageSquareText } from 'lucide-react'
import { Input } from '../ui'

export default function RedditPlatformFields({ account, options, onChange }) {
  const update = (key, value) => onChange({ ...options, [key]: value })
  const communities = account.reddit_communities || []
  const type = options.reddit_post_type || 'self'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Reddit post settings</h3>
          <p className="mt-1 text-xs text-slate-500">
            Publishing as {account.username || account.name}. Community rules still apply when the post is submitted.
          </p>
        </div>
        <span className="rounded-full bg-[#ff4500]/10 px-2.5 py-1 text-[10px] font-bold uppercase text-[#ff4500]">
          Reddit
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Community *</span>
          <div className="flex rounded-xl border border-slate-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800">
            <span className="flex items-center border-r border-slate-200 px-3 text-sm font-semibold text-slate-400 dark:border-slate-700">r/</span>
            <input
              list={`reddit-communities-${account.id}`}
              value={options.subreddit || ''}
              onChange={(event) => update('subreddit', event.target.value.replace(/^r\//i, ''))}
              placeholder="community"
              className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none dark:text-slate-100"
              required
            />
          </div>
          <datalist id={`reddit-communities-${account.id}`}>
            {communities.map((community) => <option key={community.name} value={community.name}>{community.title}</option>)}
          </datalist>
          <span className="mt-1 block text-xs text-slate-400">
            {communities.length ? `${communities.length} subscribed or moderated communities available.` : 'Type any community where this account can post.'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Post type</span>
          <select
            value={type}
            onChange={(event) => update('reddit_post_type', event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="self">Text post</option>
            <option value="link">Link post</option>
            <option value="image">Image post</option>
          </select>
        </label>
      </div>

      <div>
        <Input
          label="Reddit title *"
          maxLength={300}
          value={options.reddit_title || ''}
          onChange={(event) => update('reddit_title', event.target.value)}
          placeholder="A clear title for the Reddit post"
          required
        />
        <p className="mt-1 text-right text-xs text-slate-400">{(options.reddit_title || '').length}/300</p>
      </div>

      {type === 'link' && (
        <Input
          label="Destination URL *"
          type="url"
          value={options.reddit_url || ''}
          onChange={(event) => update('reddit_url', event.target.value)}
          placeholder="https://example.com/article"
          required
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
          {type === 'self' && <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[#ff4500]" />}
          {type === 'link' && <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#ff4500]" />}
          {type === 'image' && <Image className="mt-0.5 h-4 w-4 shrink-0 text-[#ff4500]" />}
          <span>
            {type === 'self' && 'The main composer text becomes the Reddit post body. Remove uploaded media for this target.'}
            {type === 'link' && 'Reddit will publish the title and destination URL. The main composer text is not used.'}
            {type === 'image' && 'Attach exactly one image. In production, APP_URL must expose the media publicly so Reddit can fetch it.'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Toggle label="Reply notifications" checked={options.sendreplies !== false} onChange={(value) => update('sendreplies', value)} />
        <Toggle label="NSFW" checked={Boolean(options.nsfw)} onChange={(value) => update('nsfw', value)} />
        <Toggle label="Spoiler" checked={Boolean(options.spoiler)} onChange={(value) => update('spoiler', value)} />
        <Toggle label="Allow duplicate links" checked={options.resubmit !== false} onChange={(value) => update('resubmit', value)} />
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-[#ff4500] focus:ring-[#ff4500]"
      />
      {label}
    </label>
  )
}
