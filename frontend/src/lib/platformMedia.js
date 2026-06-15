/**
 * Client-side mirror of backend PlatformMediaCompatibility for UI hints.
 * The API still filters targets on save — this drives previews and warnings.
 */

export function mediaTypesFromItems(items) {
  if (!items?.length) return []
  return [...new Set(items.map((m) => m.type))]
}

export function unsupportedReason(platformKey, mediaTypes, platforms) {
  const platform = platforms.find((p) => p.key === platformKey)
  const caps = platform?.capabilities ?? []

  if (!mediaTypes.length) {
    return caps.includes('text') ? null : 'Text-only posts not supported'
  }

  const hasVideo = mediaTypes.includes('video')
  const hasImage = mediaTypes.some((t) => t === 'image' || t === 'gif')
  const hasDocument = mediaTypes.includes('document')

  if (hasVideo) {
    return caps.some((c) => c === 'video' || c === 'reels') ? null : 'Video not supported'
  }
  if (hasImage) {
    return caps.some((c) => c === 'image' || c === 'carousel') ? null : 'Images not supported'
  }
  if (hasDocument) {
    return ['telegram', 'discord', 'whatsapp'].includes(platformKey) ? null : 'Files not supported'
  }

  return null
}

export function partitionAccounts(accounts, mediaItems, platforms) {
  const mediaTypes = mediaTypesFromItems(mediaItems)
  const eligible = []
  const skipped = []

  for (const account of accounts) {
    const reason = unsupportedReason(account.platform, mediaTypes, platforms)
    if (reason) skipped.push({ ...account, skipReason: reason })
    else eligible.push(account)
  }

  return { eligible, skipped }
}

export function inferPostType(mediaItems) {
  if (!mediaItems?.length) return 'text'
  if (mediaItems.some((m) => m.type === 'video')) {
    return mediaItems.length > 1 ? 'carousel' : 'video'
  }
  if (mediaItems.length > 1) return 'carousel'
  return 'image'
}

export function platformLimit(platformKey, platforms) {
  return platforms.find((p) => p.key === platformKey)?.limits ?? {}
}

export function acceptsFileType(platformKey, mimeType, platforms) {
  const caps = platforms.find((p) => p.key === platformKey)?.capabilities ?? []
  if (mimeType.startsWith('video/')) return caps.some((c) => c === 'video' || c === 'reels')
  if (mimeType.startsWith('image/')) return caps.some((c) => c === 'image' || c === 'carousel')
  if (mimeType === 'application/pdf') return ['telegram', 'discord', 'whatsapp'].includes(platformKey)
  return false
}

export const ACCEPTED_MIME =
  'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,application/pdf'

export const ACCEPTED_LABEL = 'JPG, PNG, GIF, WebP, MP4, MOV, WebM, PDF · up to 200 MB'
