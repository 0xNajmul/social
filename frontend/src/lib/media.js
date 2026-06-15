/**
 * Normalize media URLs for the SPA. Uploaded files are served at /storage/...
 * which the Vite dev proxy forwards to Laravel.
 */
export function mediaUrl(url) {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:')) return url

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url)
      if (parsed.pathname.startsWith('/storage/')) {
        return parsed.pathname
      }
    }
  } catch {
    // ignore
  }

  if (url.startsWith('/storage/')) return url

  return url
}
