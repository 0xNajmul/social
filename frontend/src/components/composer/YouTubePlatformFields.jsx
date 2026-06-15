import { Input } from '../ui'
import PlatformBadge from '../PlatformBadge'

export default function YouTubePlatformFields({ account, options, onChange }) {
  const update = (key, value) => onChange({ ...options, [key]: value })

  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="mb-3 flex items-center gap-2">
        <PlatformBadge platform="youtube" size="xs" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">YouTube settings</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Video title *</span>
          <Input
            value={options.title || ''}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Title shown on YouTube"
            maxLength={100}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Publish as</span>
          <select
            value={options.youtube_format || 'video'}
            onChange={(e) => update('youtube_format', e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="video">Regular video</option>
            <option value="short">YouTube Short (≤60s vertical)</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Privacy</span>
          <select
            value={options.privacy || 'public'}
            onChange={(e) => update('privacy', e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Description uses your post caption. Shorts automatically append <code>#Shorts</code>.
      </p>
    </div>
  )
}

export function isYouTubeAccount(account) {
  return account?.platform === 'youtube' || account?.platform === 'youtube_shorts'
}

export function defaultYouTubeOptions() {
  return { youtube_format: 'video', title: '', privacy: 'public' }
}
