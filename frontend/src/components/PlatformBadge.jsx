import clsx from 'clsx'

// Brand colours + short glyphs for each platform group. Used to render a
// consistent, colourful avatar for every supported network.
const PLATFORMS = {
  facebook_page: { c: '#1877F2', g: 'f' },
  facebook_group: { c: '#1877F2', g: 'fg' },
  instagram: { c: '#E4405F', g: 'ig' },
  tiktok: { c: '#111827', g: 'tt' },
  youtube: { c: '#FF0000', g: 'yt' },
  youtube_shorts: { c: '#FF0000', g: 'sh' },
  twitter: { c: '#111827', g: 'X' },
  linkedin_profile: { c: '#0A66C2', g: 'in' },
  linkedin_page: { c: '#0A66C2', g: 'in' },
  pinterest: { c: '#BD081C', g: 'p' },
  reddit: { c: '#FF4500', g: 'r' },
  threads: { c: '#111827', g: '@' },
  bluesky: { c: '#0085FF', g: 'bs' },
  mastodon: { c: '#6364FF', g: 'm' },
  google_business: { c: '#4285F4', g: 'gb' },
  telegram: { c: '#26A5E4', g: 'tg' },
  discord: { c: '#5865F2', g: 'dc' },
  whatsapp: { c: '#25D366', g: 'wa' },
  snapchat: { c: '#FFB800', g: 'sc' },
}

export default function PlatformBadge({ platform, size = 'md', className }) {
  const meta = PLATFORMS[platform] || { c: '#64748b', g: '?' }
  const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded-xl font-bold uppercase text-white shadow-sm', sizes[size], className)}
      style={{ backgroundColor: meta.c }}
      title={platform}
    >
      {meta.g}
    </span>
  )
}

export { PLATFORMS }
