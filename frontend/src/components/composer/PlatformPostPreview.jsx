import clsx from 'clsx'
import { Film, FileText, Heart, MessageCircle, Repeat2, Send, Share2, ThumbsUp } from 'lucide-react'
import { AccountIcon } from '../PlatformBadge'
import { mediaUrl } from '../../lib/media'
import { platformLimit } from '../../lib/platformMedia'

function MediaBlock({ media, aspect = 'aspect-video', rounded = 'rounded-lg', vertical = false }) {
  if (!media?.length) return null
  const item = media[0]
  const src = mediaUrl(item.thumbnail_url || item.url || item.localUrl)
  const isVideo = item.type === 'video'
  const isDoc = item.type === 'document'

  if (isDoc) {
    return (
      <div className={clsx('mt-3 flex items-center gap-2 border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800', rounded)}>
        <FileText className="h-5 w-5 shrink-0 text-slate-400" />
        <span className="truncate text-xs text-slate-600 dark:text-slate-300">{item.original_name}</span>
      </div>
    )
  }

  const aspectClass = vertical ? 'aspect-[9/16]' : aspect

  return (
    <div className={clsx('mt-3 overflow-hidden bg-black', rounded, aspectClass, media.length > 1 && 'relative')}>
      {isVideo ? (
        <>
          <video src={src} className="h-full w-full object-cover" muted />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Film className="h-10 w-10 text-white drop-shadow" />
          </span>
        </>
      ) : (
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
      {media.length > 1 && (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
          1/{media.length}
        </span>
      )}
    </div>
  )
}

function CharCount({ platform, content, platforms }) {
  const limit = platformLimit(platform, platforms)?.text
  if (!limit) return null
  const len = content?.length ?? 0
  const over = len > limit
  return (
    <p className={clsx('mt-2 text-[10px]', over ? 'text-rose-500' : 'text-slate-400')}>
      {len}/{limit} characters
    </p>
  )
}

function TwitterPreview({ account, content, media, platforms }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black text-white">
      <div className="p-4">
        <div className="flex gap-3">
          <AccountIcon platform="twitter" avatarUrl={account.avatar_url} name={account.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold truncate">{account.name}</span>
              <span className="truncate text-slate-500">{account.username || '@user'}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {content || <span className="text-slate-500">What&apos;s happening?</span>}
            </p>
            <MediaBlock media={media} rounded="rounded-2xl" />
            <CharCount platform="twitter" content={content} platforms={platforms} />
            <div className="mt-3 flex justify-between text-slate-500">
              <MessageCircle className="h-4 w-4" />
              <Repeat2 className="h-4 w-4" />
              <Heart className="h-4 w-4" />
              <Share2 className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InstagramPreview({ account, content, media, platforms }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <AccountIcon platform="instagram" avatarUrl={account.avatar_url} name={account.name} size="xs" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{account.username || account.name}</span>
      </div>
      <div className="aspect-square bg-slate-100 dark:bg-slate-800">
        {media?.length ? (
          media[0].type === 'video' ? (
            <video src={mediaUrl(media[0].url || media[0].localUrl)} className="h-full w-full object-cover" muted />
          ) : (
            <img src={mediaUrl(media[0].thumbnail_url || media[0].url || media[0].localUrl)} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Photo preview</div>
        )}
      </div>
      <div className="flex gap-4 px-3 py-2 text-slate-800 dark:text-slate-200">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
      </div>
      <div className="px-3 pb-3 text-sm">
        <span className="font-semibold text-slate-900 dark:text-white">{account.username || account.name} </span>
        <span className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">
          {content || <span className="text-slate-400">Write a caption…</span>}
        </span>
        <CharCount platform="instagram" content={content} platforms={platforms} />
      </div>
    </div>
  )
}

function FacebookPreview({ account, content, media, platforms }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="p-3">
        <div className="flex items-center gap-2">
          <AccountIcon platform="facebook_page" avatarUrl={account.avatar_url} name={account.name} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{account.name}</p>
            <p className="text-[10px] text-slate-400">Just now · 🌐</p>
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
          {content || <span className="text-slate-400">What&apos;s on your mind?</span>}
        </p>
        <MediaBlock media={media} rounded="rounded-lg" />
        <CharCount platform="facebook_page" content={content} platforms={platforms} />
        <div className="mt-3 flex justify-around border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800">
          <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> Like</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comment</span>
          <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Share</span>
        </div>
      </div>
    </div>
  )
}

function LinkedInPreview({ account, content, media, platforms }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="p-3">
        <div className="flex gap-2">
          <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{account.name}</p>
            <p className="text-[10px] text-slate-500">{account.platform_label} · 1m</p>
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          {content || <span className="text-slate-400">Share an update…</span>}
        </p>
        <MediaBlock media={media} aspect="aspect-[1.91/1]" />
        <CharCount platform="linkedin_profile" content={content} platforms={platforms} />
      </div>
    </div>
  )
}

function TelegramPreview({ account, content, media }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#e8f4fc] p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <AccountIcon platform="telegram" avatarUrl={account.avatar_url} name={account.name} size="xs" />
        <p className="text-xs font-semibold text-[#168acd]">{account.name}</p>
      </div>
      <div className="mt-2 max-w-[95%] rounded-xl rounded-tl-sm bg-white p-2 shadow-sm dark:bg-slate-800">
        {media?.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-lg">
            {media[0].type === 'video' ? (
              <video src={mediaUrl(media[0].url || media[0].localUrl)} className="max-h-48 w-full object-cover" muted />
            ) : media[0].type === 'document' ? (
              <div className="flex items-center gap-2 bg-slate-50 p-2 dark:bg-slate-700">
                <FileText className="h-4 w-4" />
                <span className="truncate text-xs">{media[0].original_name}</span>
              </div>
            ) : (
              <img src={mediaUrl(media[0].url || media[0].localUrl)} alt="" className="max-h-48 w-full object-cover" />
            )}
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
          {content || <span className="text-slate-400">Message…</span>}
        </p>
      </div>
    </div>
  )
}

function TikTokPreview({ account, content, media, options }) {
  const src = mediaUrl(media?.[0]?.url || media?.[0]?.localUrl)
  const isShort = options?.youtube_format === 'short'
  const title = options?.title || content
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
      <div className="relative aspect-[9/16] max-h-80 bg-slate-900">
        {src ? (
          media[0].type === 'video' ? (
            <video src={src} className="h-full w-full object-cover" muted />
          ) : (
            <img src={src} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Video preview</div>
        )}
        {isShort && (
          <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">SHORT</span>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-12">
          <div className="flex items-center gap-2">
            <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="xs" />
            <p className="text-xs font-semibold text-white">{account.name}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-white">{title || 'Video title…'}</p>
          {content && content !== title && (
            <p className="mt-1 line-clamp-2 text-[10px] text-white/80">{content}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function PinterestPreview({ account, content, media }) {
  const src = mediaUrl(media?.[0]?.url || media?.[0]?.localUrl)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="aspect-[2/3] max-h-72 bg-slate-100 dark:bg-slate-800">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Pin image</div>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
          {content || 'Pin title…'}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <AccountIcon platform="pinterest" avatarUrl={account.avatar_url} name={account.name} size="xs" />
          <p className="text-xs text-slate-500">{account.name}</p>
        </div>
      </div>
    </div>
  )
}

function DefaultPreview({ account, content, media, platforms }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <AccountIcon platform={account.platform} avatarUrl={account.avatar_url} name={account.name} size="sm" />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{account.name}</p>
          <p className="text-xs text-slate-400">{account.platform_label}</p>
        </div>
      </div>
      <MediaBlock media={media} />
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
        {content || <span className="text-slate-400">Preview…</span>}
      </p>
      <CharCount platform={account.platform} content={content} platforms={platforms} />
    </div>
  )
}

const PREVIEW_MAP = {
  twitter: TwitterPreview,
  instagram: InstagramPreview,
  facebook_page: FacebookPreview,
  facebook_group: FacebookPreview,
  linkedin_profile: LinkedInPreview,
  linkedin_page: LinkedInPreview,
  telegram: TelegramPreview,
  tiktok: TikTokPreview,
  youtube_shorts: TikTokPreview,
  youtube: TikTokPreview,
  pinterest: PinterestPreview,
}

export default function PlatformPostPreview({ account, content, media, platforms, options, skipped, skipReason }) {
  const Preview = PREVIEW_MAP[account.platform] || DefaultPreview

  return (
    <div className={clsx(skipped && 'opacity-60')}>
      {skipped && (
        <div className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Skipped — {skipReason}
        </div>
      )}
      <Preview account={account} content={content} media={media} platforms={platforms} options={options} />
    </div>
  )
}
