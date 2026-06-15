import { useEffect, useState } from 'react'
import api from '../../lib/api'
import PlatformBadge from '../PlatformBadge'

const privacyLabels = {
  PUBLIC_TO_EVERYONE: 'Public',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
}

export default function TikTokPlatformFields({ account, options, onChange }) {
  const [creatorInfo, setCreatorInfo] = useState(account.creator_info || null)
  const [loading, setLoading] = useState(!account.creator_info)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    api.get(`/social/accounts/${account.id}/creator-info`)
      .then(({ data }) => {
        if (active) setCreatorInfo(data.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load TikTok creator settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [account.id])

  const update = (key, value) => onChange({ ...options, [key]: value })
  const privacyOptions = creatorInfo?.privacy_level_options || []

  return (
    <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/30">
      <div className="mb-3 flex items-center gap-2">
        <PlatformBadge platform="tiktok" size="xs" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">TikTok settings</span>
      </div>

      {loading && <p className="mb-3 text-xs text-slate-500">Loading creator settings...</p>}
      {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Who can watch this video? *</span>
          <select
            value={options.privacy_level || ''}
            onChange={(event) => update('privacy_level', event.target.value)}
            disabled={loading || privacyOptions.length === 0}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Choose privacy</option>
            {privacyOptions.map((privacy) => (
              <option key={privacy} value={privacy}>{privacyLabels[privacy] || privacy}</option>
            ))}
          </select>
        </label>

        <Toggle
          label="Allow comments"
          checked={!options.disable_comment}
          disabled={Boolean(creatorInfo?.comment_disabled)}
          onChange={(checked) => update('disable_comment', !checked)}
        />
        <Toggle
          label="Allow Duet"
          checked={!options.disable_duet}
          disabled={Boolean(creatorInfo?.duet_disabled)}
          onChange={(checked) => update('disable_duet', !checked)}
        />
        <Toggle
          label="Allow Stitch"
          checked={!options.disable_stitch}
          disabled={Boolean(creatorInfo?.stitch_disabled)}
          onChange={(checked) => update('disable_stitch', !checked)}
        />
        <Toggle
          label="AI-generated content"
          checked={Boolean(options.is_aigc)}
          onChange={(checked) => update('is_aigc', checked)}
        />
        <Toggle
          label="Promotes a third-party brand"
          checked={Boolean(options.brand_content_toggle)}
          onChange={(checked) => update('brand_content_toggle', checked)}
        />
        <Toggle
          label="Promotes my own brand"
          checked={Boolean(options.brand_organic_toggle)}
          onChange={(checked) => update('brand_organic_toggle', checked)}
        />
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={Boolean(options.tiktok_consent)}
          onChange={(event) => update('tiktok_consent', event.target.checked)}
        />
        <span>I consent to publishing this video to TikTok and confirm I have the rights to its content and music. *</span>
      </label>

      {creatorInfo?.max_video_post_duration_sec && (
        <p className="mt-2 text-[11px] text-slate-500">
          This account allows videos up to {creatorInfo.max_video_post_duration_sec} seconds.
        </p>
      )}
    </div>
  )
}

function Toggle({ label, checked, disabled = false, onChange }) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}{disabled ? ' (disabled by creator settings)' : ''}</span>
    </label>
  )
}
