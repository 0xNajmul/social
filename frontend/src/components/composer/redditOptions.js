export function isRedditAccount(account) {
  return account?.platform === 'reddit'
}

export function defaultRedditOptions(account) {
  return {
    subreddit: account?.reddit_default_subreddit || account?.reddit_communities?.[0]?.name || '',
    reddit_title: '',
    reddit_post_type: 'self',
    reddit_url: '',
    sendreplies: true,
    nsfw: false,
    spoiler: false,
    resubmit: true,
  }
}
