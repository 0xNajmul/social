export function isTikTokAccount(account) {
  return account?.platform === 'tiktok'
}

export function defaultTikTokOptions() {
  return {
    privacy_level: '',
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
    brand_content_toggle: false,
    brand_organic_toggle: false,
    is_aigc: false,
    tiktok_consent: false,
  }
}
