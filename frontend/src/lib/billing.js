export const LIMIT_LABELS = {
  workspaces: 'Workspaces',
  team_members: 'Team members',
  social_accounts: 'Social accounts',
  scheduled_posts: 'Scheduled posts',
  monthly_posts: 'Monthly posts',
  automations: 'Automations',
  ai_credits: 'AI credits',
  storage_mb: 'Storage',
}

export function formatLimit(key, value) {
  if (value === -1 || value === null || value === undefined) return 'Unlimited'
  if (key === 'storage_mb') return `${value} MB`
  return value
}
