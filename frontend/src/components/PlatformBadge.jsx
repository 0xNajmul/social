import { useState } from 'react'
import clsx from 'clsx'

const PLATFORMS = {
  facebook_page: { color: '#1877F2', label: 'Facebook' },
  facebook_group: { color: '#1877F2', label: 'Facebook Group' },
  instagram: { color: '#E4405F', label: 'Instagram', gradient: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' },
  tiktok: { color: '#050505', label: 'TikTok' },
  youtube: { color: '#FF0000', label: 'YouTube' },
  youtube_shorts: { color: '#FF0000', label: 'YouTube Shorts' },
  twitter: { color: '#050505', label: 'X' },
  linkedin_profile: { color: '#0A66C2', label: 'LinkedIn' },
  linkedin_page: { color: '#0A66C2', label: 'LinkedIn Page' },
  pinterest: { color: '#BD081C', label: 'Pinterest' },
  reddit: { color: '#FF4500', label: 'Reddit' },
  threads: { color: '#050505', label: 'Threads' },
  bluesky: { color: '#0085FF', label: 'Bluesky' },
  mastodon: { color: '#6364FF', label: 'Mastodon' },
  google_business: { color: '#4285F4', label: 'Google Business' },
  telegram: { color: '#26A5E4', label: 'Telegram' },
  discord: { color: '#5865F2', label: 'Discord' },
  whatsapp: { color: '#25D366', label: 'WhatsApp' },
  snapchat: { color: '#FFFC00', foreground: '#111827', label: 'Snapchat' },
}

const BADGE_SIZES = {
  xs: 'h-6 w-6 p-1',
  sm: 'h-8 w-8 p-1.5',
  md: 'h-10 w-10 p-2',
  lg: 'h-12 w-12 p-2.5',
}

const ACCOUNT_SIZES = {
  xs: { frame: 'h-7 w-7', overlay: '!h-3.5 !w-3.5 !rounded-md !p-0.5' },
  sm: { frame: 'h-9 w-9', overlay: '!h-4 !w-4 !rounded-md !p-0.5' },
  md: { frame: 'h-11 w-11', overlay: '!h-5 !w-5 !rounded-md !p-1' },
  lg: { frame: 'h-13 w-13', overlay: '!h-5 !w-5 !rounded-md !p-1' },
}

export default function PlatformBadge({ platform, size = 'md', className }) {
  const meta = PLATFORMS[platform] || { color: '#64748b', label: platform || 'Social account' }

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
        BADGE_SIZES[size],
        className,
      )}
      style={{
        background: meta.gradient || meta.color,
        color: meta.foreground || '#fff',
      }}
      title={meta.label}
      aria-label={meta.label}
    >
      <BrandIcon platform={platform} className="h-full w-full" />
    </span>
  )
}

export function AccountIcon({ platform, avatarUrl, name, size = 'md', className }) {
  const [failedUrl, setFailedUrl] = useState(null)
  const sizing = ACCOUNT_SIZES[size] || ACCOUNT_SIZES.md
  const showAvatar = Boolean(avatarUrl) && failedUrl !== avatarUrl

  if (!showAvatar) {
    return <PlatformBadge platform={platform} size={size} className={className} />
  }

  return (
    <span className={clsx('relative inline-flex shrink-0', sizing.frame, className)}>
      <img
        src={avatarUrl}
        alt={`${name || 'Social account'} avatar`}
        className="h-full w-full rounded-full border border-white object-cover shadow-sm dark:border-slate-800"
        onError={() => setFailedUrl(avatarUrl)}
      />
      <PlatformBadge
        platform={platform}
        size="xs"
        className={clsx('absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-slate-900', sizing.overlay)}
      />
    </span>
  )
}

function BrandIcon({ platform, className }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }

  switch (platform) {
    case 'facebook_page':
      return <svg {...common}><path fill="currentColor" d="M13.7 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5H17V3.6c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H7.5V13h2.8v8h3.4Z" /></svg>
    case 'facebook_group':
      return <svg {...common}><circle cx="9" cy="9" r="3" fill="currentColor" /><circle cx="17" cy="10" r="2.4" fill="currentColor" opacity=".8" /><path d="M3.5 19c.3-3.1 2.2-5 5.5-5s5.2 1.9 5.5 5M14 15.1c.7-.6 1.6-.9 2.8-.9 2.3 0 3.7 1.4 3.9 3.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    case 'instagram':
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" /><circle cx="17.7" cy="6.4" r="1.2" fill="currentColor" /></svg>
    case 'tiktok':
      return <svg {...common}><path fill="currentColor" d="M14.1 3h3c.2 1.8 1.2 3.2 3 3.8v3.1a8 8 0 0 1-3-1v6.2a6.1 6.1 0 1 1-5.3-6.1v3.2a3 3 0 1 0 2.3 2.9V3Z" /></svg>
    case 'youtube':
    case 'youtube_shorts':
      return <svg {...common}><path fill="currentColor" d="M21.2 7.1a2.8 2.8 0 0 0-2-2C17.5 4.6 12 4.6 12 4.6s-5.5 0-7.2.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.3 12c0 1.7.1 3.3.5 4.9a2.8 2.8 0 0 0 2 2c1.7.5 7.2.5 7.2.5s5.5 0 7.2-.5a2.8 2.8 0 0 0 2-2c.4-1.6.5-3.2.5-4.9s-.1-3.3-.5-4.9ZM10 15.3V8.7l5.7 3.3-5.7 3.3Z" /></svg>
    case 'twitter':
      return <svg {...common}><path d="M5 4.5 19 19.5M19 4.5 5 19.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" /></svg>
    case 'linkedin_profile':
    case 'linkedin_page':
      return <svg {...common}><rect x="4" y="9" width="3.2" height="10" rx=".5" fill="currentColor" /><circle cx="5.6" cy="5.6" r="1.9" fill="currentColor" /><path fill="currentColor" d="M10 9h3.1v1.4c.9-1.1 2-1.7 3.5-1.7 3 0 4.2 2 4.2 5.2V19h-3.2v-4.6c0-1.7-.3-2.9-2-2.9-1.8 0-2.4 1.3-2.4 3.1V19H10V9Z" /></svg>
    case 'pinterest':
      return <svg {...common}><path fill="currentColor" d="M12 2.8a9.2 9.2 0 0 0-3.3 17.8c-.1-1.5 0-3.2.4-4.6l1.2-5s-.3-.8-.3-2c0-1.9 1.1-3.3 2.4-3.3 1.1 0 1.7.9 1.7 2 0 1.1-.8 2.8-1.1 4.4-.3 1.3.7 2.4 2 2.4 2.4 0 4-3 4-6.5 0-2.7-2.2-4.8-5.3-4.8-3.9 0-6.3 2.9-6.3 6.1 0 1.1.3 2.2.8 2.8.2.2.2.3.1.6l-.3 1.2c-.1.4-.5.5-.8.4-2.1-.9-3-3.2-3-5.8 0-4.3 3.6-9.4 10.8-9.4 5.8 0 9.6 4.2 9.6 8.8 0 6-3.3 10.5-8.2 10.5-1.6 0-3.2-.9-3.7-1.9l-1 4c-.4 1.4-1.1 2.9-1.8 4A9 9 0 0 0 12 21.2 9.2 9.2 0 1 0 12 2.8Z" transform="scale(.82) translate(2.6 2.5)" /></svg>
    case 'reddit':
      return <svg {...common}><path d="M6 11.2c-1.3 0-2.3.8-2.3 1.9 0 .7.4 1.3 1.1 1.6-.1.3-.1.6-.1.9 0 3 3.3 5.4 7.3 5.4s7.3-2.4 7.3-5.4c0-.3 0-.6-.1-.9.7-.3 1.1-.9 1.1-1.6 0-1.1-1-1.9-2.3-1.9-.7 0-1.2.2-1.7.6a9.9 9.9 0 0 0-4.1-1.1l.8-3.6 2.6.6a2 2 0 1 0 .3-1.4l-3.4-.8a.8.8 0 0 0-.9.6l-1 4.6a10 10 0 0 0-3.1 1.1c-.3-.4-.9-.6-1.5-.6Z" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="#FF4500" /><circle cx="15" cy="15" r="1" fill="#FF4500" /><path d="M9 17.6c1.7 1 4.3 1 6 0" stroke="#FF4500" strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'threads':
      return <svg {...common}><path d="M16.8 10.7c-.2-4-2.3-6.3-5.4-6.3-3.5 0-6.1 2.8-6.1 7.5 0 5 2.7 7.8 6.6 7.8 3.6 0 5.8-2 5.8-4.8 0-2.7-2.1-4.2-5-4.2-2.8 0-4.5 1.3-4.5 3.2 0 1.6 1.3 2.7 3.1 2.7 3.2 0 5.4-2.6 5.4-6.3 0-4-2.1-7.1-6-7.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'bluesky':
      return <svg {...common}><path fill="currentColor" d="M12 11.8c-1.1-2.1-4-6-6.8-7.9C2.6 2.1 1.6 2.4 1 2.7c-.8.3-.9 1.5-.9 2.2 0 .7.4 5.6.6 6.4.8 2.7 3.7 3.6 6.4 3.3-3.9.6-7.3 2-2.8 7 5 5.2 6.8-1.1 7.7-4.3 1 3.2 2 9.2 7.7 4.3 4.2-4.3 1.2-6.4-2.7-7 2.6.3 5.5-.6 6.3-3.3.2-.8.6-5.7.6-6.4 0-.7-.1-1.9-.9-2.2-.6-.3-1.6-.6-4.2 1.2-2.8 1.9-5.7 5.8-6.8 7.9Z" /></svg>
    case 'mastodon':
      return <svg {...common}><path fill="currentColor" d="M20.8 8.1c0-4.5-3-5.8-3-5.8C16.3 1.6 13.8 1.3 12 1.3h-.1c-1.8 0-4.3.3-5.8 1C6.1 2.3 3 3.6 3 8.1c0 1 .1 2.2.1 3.5.2 4.4 1.6 8.7 5.8 9.8 1.9.5 3.5.6 4.8.5 2.4-.1 3.7-.8 3.7-.8l-.1-2.1s-1.7.5-3.6.5c-1.9-.1-3.9-.2-4.2-2.6v-.7c1.9.5 3.5.6 4.8.5 4.4-.3 6.1-2.8 6.4-5 .2-1.1.1-2.7.1-3.6Zm-3.2 4.1h-2.7V8c0-.9-.4-1.4-1.2-1.4-.9 0-1.3.6-1.3 1.7v2.3H9.7V8.3c0-1.1-.4-1.7-1.3-1.7-.8 0-1.2.5-1.2 1.4v4.2H4.5V7.9c0-1.9.5-3.4 1.6-4.3 1.1-.9 2.4-1 3.2-.6 1 .4 1.6 1.2 1.9 1.8l.8 1.4.8-1.4c.3-.6.9-1.4 1.9-1.8.8-.4 2.1-.3 3.2.6 1.1.9 1.6 2.4 1.6 4.3v4.3Z" /></svg>
    case 'google_business':
      return <svg {...common}><path d="M4 10h16M5 10l1-5h12l1 5M6 10v9h12v-9M9 19v-5h6v5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M4 10c0 1.4 1 2.5 2.3 2.5S8.7 11.4 8.7 10c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.4 2.5s2.5-1.1 2.5-2.5" stroke="currentColor" strokeWidth="1.5" /></svg>
    case 'telegram':
      return <svg {...common}><path fill="currentColor" d="m21.6 3.4-3.2 16c-.2 1.1-.9 1.4-1.8.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6 13.1l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.2 2.9c.9-.3 1.6.2 1.4.5Z" /></svg>
    case 'discord':
      return <svg {...common}><path fill="currentColor" d="M19.6 5.3A18 18 0 0 0 15 3.9l-.6 1.2a17 17 0 0 0-5 0l-.6-1.2a18 18 0 0 0-4.6 1.4C1.3 9.7.5 14 1 18.2a18.4 18.4 0 0 0 5.6 2.9l1.2-2c-.7-.3-1.3-.6-1.9-.9l.5-.4c3.6 1.7 7.6 1.7 11.2 0l.5.4c-.6.4-1.2.7-1.9.9l1.2 2a18.3 18.3 0 0 0 5.6-2.9c.5-4.9-.7-9.1-3.4-12.9ZM8.2 15.6c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Zm7.4 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2 1 2 2.3-.9 2.3-2 2.3Z" /></svg>
    case 'whatsapp':
      return <svg {...common}><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.5L3 20.6l1.3-4.7A8.5 8.5 0 1 1 20.5 11.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.1 7.5c.3-.5.6-.5.9-.5h.5c.2 0 .4.1.5.5l.8 2c.1.3.1.5-.1.7l-.7.8c-.2.2-.2.4 0 .7.7 1.3 1.7 2.3 3.1 3 .3.2.5.1.7-.1l.9-1c.2-.3.5-.3.8-.2l2 .9c.3.1.5.3.5.6 0 .5-.3 1.6-.8 2-.5.5-1.2.8-2.1.8-1 0-2.4-.4-4.2-1.4-2.1-1.2-3.7-2.9-4.7-4.8-.8-1.5-.8-2.7-.4-3.6l.3-.4Z" fill="currentColor" /></svg>
    case 'snapchat':
      return <svg {...common}><path d="M12 3.1c-2.8 0-4.6 2.2-4.6 5v1.6c-.4.4-1.1.7-1.8.9-.6.2-.7.8-.1 1.1.5.3 1 .4 1.5.5-.3 1.8-1.5 3.1-3.2 3.8-.6.3-.4 1 .2 1.1 1 .2 1.7.6 2.1 1.2.4.7 1.2.5 1.8.4 1.2-.2 2.4 1.2 4.1 1.2s2.9-1.4 4.1-1.2c.6.1 1.4.3 1.8-.4.4-.6 1.1-1 2.1-1.2.6-.1.8-.8.2-1.1-1.7-.7-2.9-2-3.2-3.8.5-.1 1-.2 1.5-.5.6-.3.5-.9-.1-1.1-.7-.2-1.4-.5-1.8-.9V8.1c0-2.8-1.8-5-4.6-5Z" fill="currentColor" /></svg>
    default:
      return <svg {...common}><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>
  }
}

export { PLATFORMS }
