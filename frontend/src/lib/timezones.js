const FALLBACK_TIMEZONES = [
  'UTC',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
]

export function timezones() {
  if (typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return FALLBACK_TIMEZONES
    }
  }

  return FALLBACK_TIMEZONES
}

export function currentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function timezoneLabel(timezone) {
  return `${timezone} (${timezoneOffset(timezone)})`
}

export function timezoneOffset(timezone, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const offset = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT'
    return normalizeOffset(offset)
  } catch {
    return 'UTC+00:00'
  }
}

function normalizeOffset(offset) {
  if (offset === 'GMT' || offset === 'UTC') return 'UTC+00:00'

  const match = offset.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return offset.replace('GMT', 'UTC')

  const [, sign, rawHours, rawMinutes = '00'] = match
  return `UTC${sign}${rawHours.padStart(2, '0')}:${rawMinutes}`
}
