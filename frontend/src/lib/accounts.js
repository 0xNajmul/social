/** Dedupe YouTube — one connected channel covers both Video and Shorts. */
export function normalizeAccounts(accounts) {
  const youtube = accounts.filter((a) => a.platform === 'youtube' || a.platform === 'youtube_shorts')
  const rest = accounts.filter((a) => a.platform !== 'youtube' && a.platform !== 'youtube_shorts')
  const primary = youtube.find((a) => a.platform === 'youtube') || youtube[0]
  if (primary) {
    return [...rest, { ...primary, platform: 'youtube', platform_label: 'YouTube (Video & Shorts)' }]
  }
  return rest
}

export function connectPlatforms(platforms) {
  return platforms.filter((p) => p.key !== 'youtube_shorts' && p.key !== 'facebook_group')
}
