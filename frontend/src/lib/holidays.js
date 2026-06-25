import Holidays from 'date-holidays'

export const HOLIDAY_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'NP', name: 'Nepal' },
]

export const HOLIDAY_SOURCE_GROUPS = [
  { key: 'workspace_public', label: 'My country public holidays' },
  { key: 'audience_public', label: 'Audience country holidays' },
  { key: 'marketing', label: 'Marketing & ecommerce events' },
  { key: 'custom', label: 'Custom workspace events' },
  { key: 'global', label: 'Global awareness days' },
  { key: 'islamic', label: 'Islamic / Hijri holidays' },
  { key: 'christian', label: 'Christian holidays' },
  { key: 'hindu', label: 'Hindu holidays' },
  { key: 'buddhist', label: 'Buddhist holidays' },
  { key: 'jewish', label: 'Jewish holidays' },
  { key: 'sikh', label: 'Sikh holidays' },
  { key: 'lunar', label: 'Chinese / Lunar holidays' },
]

export const DEFAULT_HOLIDAY_SETTINGS = {
  enabled: true,
  workspaceCountry: 'US',
  audienceCountries: [],
  groups: ['workspace_public', 'audience_public', 'marketing', 'custom'],
  customEvents: [],
}

const HOLIDAY_COUNTRY_NAMES = Object.fromEntries(HOLIDAY_COUNTRIES.map((country) => [country.code, country.name]))

const GLOBAL_AWARENESS_EVENTS = [
  fixedEvent('International Day of Education', 1, 24, 'global'),
  fixedEvent("International Women's Day", 3, 8, 'global'),
  fixedEvent('World Health Day', 4, 7, 'global'),
  fixedEvent('Earth Day', 4, 22, 'global'),
  fixedEvent('World Environment Day', 6, 5, 'global'),
  fixedEvent('World Refugee Day', 6, 20, 'global'),
  fixedEvent('International Day of Yoga', 6, 21, 'global'),
  fixedEvent("World Teachers' Day", 10, 5, 'global'),
  fixedEvent('World Mental Health Day', 10, 10, 'global'),
  fixedEvent('Human Rights Day', 12, 10, 'global'),
]

const MARKETING_EVENTS = [
  fixedEvent('New Year Campaign', 1, 1, 'marketing'),
  fixedEvent("Valentine's Day", 2, 14, 'marketing'),
  nthWeekdayEvent("Mother's Day", 5, 0, 2, 'marketing'),
  nthWeekdayEvent("Father's Day", 6, 0, 3, 'marketing'),
  fixedEvent('Halloween', 10, 31, 'marketing'),
  fixedEvent("Singles' Day", 11, 11, 'marketing'),
  daysAfterNthWeekdayEvent('Black Friday', 11, 4, 4, 1, 'marketing'),
  daysAfterNthWeekdayEvent('Cyber Monday', 11, 4, 4, 4, 'marketing'),
  fixedEvent('Christmas Campaign', 12, 25, 'marketing'),
  fixedEvent('Boxing Day', 12, 26, 'marketing'),
  fixedEvent('Back to School', 8, 15, 'marketing'),
  fixedEvent('Ramadan Campaign', 3, 1, 'marketing', 'Approximate campaign window; adjust by country.'),
  fixedEvent('Eid Campaign', 4, 1, 'marketing', 'Approximate campaign window; adjust by country.'),
  fixedEvent('Diwali Campaign', 10, 20, 'marketing', 'Approximate campaign window; adjust by yearly festival date.'),
  fixedEvent('Lunar New Year Campaign', 1, 25, 'marketing', 'Approximate campaign window; adjust by lunar calendar date.'),
]

const RELIGIOUS_PATTERNS = {
  islamic: /ramadan|eid|adha|fitr|ashura|mawlid|muharram|islamic/i,
  christian: /christmas|easter|good friday|palm sunday|ash wednesday/i,
  hindu: /diwali|holi|navratri|durga|dussehra|janmashtami|deepavali/i,
  buddhist: /vesak|buddha|magha|asalha|makha/i,
  jewish: /rosh hashanah|yom kippur|passover|hanukkah|chanukah/i,
  sikh: /vaisakhi|guru nanak|gurpurab/i,
  lunar: /lunar|chinese new year|lantern|dragon boat|mid-autumn/i,
}

export function normalizeHolidaySettings(value = {}) {
  const workspaceCountry = validCountry(value.workspaceCountry || value.country) || DEFAULT_HOLIDAY_SETTINGS.workspaceCountry
  const audienceCountries = uniqueCountries(value.audienceCountries || []).filter((code) => code !== workspaceCountry)
  const validGroups = new Set(HOLIDAY_SOURCE_GROUPS.map((group) => group.key))
  const groups = Array.isArray(value.groups)
    ? value.groups.filter((group) => validGroups.has(group))
    : Array.isArray(value.types)
      ? migrateLegacyTypes(value.types)
      : DEFAULT_HOLIDAY_SETTINGS.groups

  return {
    enabled: value.enabled ?? DEFAULT_HOLIDAY_SETTINGS.enabled,
    workspaceCountry,
    audienceCountries,
    groups: groups.length ? groups : DEFAULT_HOLIDAY_SETTINGS.groups,
    customEvents: Array.isArray(value.customEvents) ? value.customEvents : [],
  }
}

export function getHolidayItems({ settings, start, end }) {
  const normalized = normalizeHolidaySettings(settings)
  if (!normalized.enabled || !start || !end) return []

  const countries = new Set()
  if (normalized.groups.includes('workspace_public')) countries.add(normalized.workspaceCountry)
  if (normalized.groups.includes('audience_public')) normalized.audienceCountries.forEach((country) => countries.add(country))

  const publicItems = [...countries].flatMap((country) => countryPublicHolidayItems(country, start, end))
  const extraItems = normalized.groups.flatMap((group) => {
    if (group === 'global') return fixedItems(GLOBAL_AWARENESS_EVENTS, start, end)
    if (group === 'marketing') return fixedItems(MARKETING_EVENTS, start, end)
    if (group === 'custom') return customItems(normalized.customEvents, start, end)
    if (RELIGIOUS_PATTERNS[group]) return religiousHolidayItems(group, normalized, start, end)
    return []
  })

  return dedupeHolidayItems([...publicItems, ...extraItems]).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
}

function religiousHolidayItems(group, settings, start, end) {
  const countries = new Set([settings.workspaceCountry, ...(settings.audienceCountries || [])])
  const pattern = RELIGIOUS_PATTERNS[group]
  const notes = group === 'islamic' ? 'Date may vary by country/moon sighting.' : null

  return [...countries].flatMap((country) => {
    const hd = new Holidays(country)
    return yearsInRange(start, end)
      .flatMap((year) => hd.getHolidays(year))
      .filter((holiday) => pattern.test(holiday.name || ''))
      .map((holiday) => ({
        ...holiday,
        dateObject: new Date(holiday.start || holiday.date),
      }))
      .filter((holiday) => {
        const time = holiday.dateObject.getTime()
        return time >= startOfDay(start).getTime() && time <= endOfDay(end).getTime()
      })
      .map((holiday) => makeHolidayItem({
        title: holiday.name,
        date: holiday.dateObject,
        group,
        label: `${holidayGroupLabel(group)} · ${HOLIDAY_COUNTRY_NAMES[country] || country}`,
        country,
        notes,
        source: 'date-holidays',
      }))
  })
}

function countryPublicHolidayItems(country, start, end) {
  const startTime = startOfDay(start).getTime()
  const endTime = endOfDay(end).getTime()
  const hd = new Holidays(country)

  return yearsInRange(start, end)
    .flatMap((year) => hd.getHolidays(year))
    .filter((holiday) => ['public', 'bank', 'school'].includes(holiday.type))
    .map((holiday) => ({
      ...holiday,
      dateObject: new Date(holiday.start || holiday.date),
    }))
    .filter((holiday) => {
      const time = holiday.dateObject.getTime()
      return time >= startTime && time <= endTime
    })
    .map((holiday) => makeHolidayItem({
      title: holiday.name,
      date: holiday.dateObject,
      group: 'public',
      label: `${HOLIDAY_COUNTRY_NAMES[country] || country} public holiday`,
      country,
      source: 'date-holidays',
    }))
}

function fixedItems(events, start, end) {
  const startTime = startOfDay(start).getTime()
  const endTime = endOfDay(end).getTime()
  return yearsInRange(start, end)
    .flatMap((year) => events.map((event) => ({ event, date: event.date(year) })))
    .filter(({ date }) => date.getTime() >= startTime && date.getTime() <= endTime)
    .map(({ event, date }) => makeHolidayItem({
      title: event.name,
      date,
      group: event.group,
      label: holidayGroupLabel(event.group),
      notes: event.notes,
      source: event.group === 'global' ? 'UN observances' : 'curated calendar',
    }))
}

function customItems(events, start, end) {
  const startTime = startOfDay(start).getTime()
  const endTime = endOfDay(end).getTime()
  return events
    .map((event) => ({ ...event, dateObject: new Date(event.date) }))
    .filter((event) => event.name && !Number.isNaN(event.dateObject.getTime()))
    .filter((event) => event.dateObject.getTime() >= startTime && event.dateObject.getTime() <= endTime)
    .map((event) => makeHolidayItem({
      title: event.name,
      date: event.dateObject,
      group: 'custom',
      label: 'Custom workspace event',
      notes: event.notes,
      source: 'workspace',
    }))
}

function makeHolidayItem({ title, date, group, label, country = null, notes = null, source }) {
  const iso = date.toISOString()
  return {
    uid: `holiday-${group}-${country || 'global'}-${iso.slice(0, 10)}-${title}`,
    kind: 'holiday',
    title,
    content: [label, notes].filter(Boolean).join(' · '),
    status: group,
    status_label: label,
    scheduled_at: iso,
    created_at: iso,
    updated_at: iso,
    country,
    type: group,
    source,
    notes,
    variants: [],
    media: [],
  }
}

function fixedEvent(name, month, day, group, notes = null) {
  return { name, group, notes, date: (year) => new Date(year, month - 1, day, 9, 0, 0) }
}

function nthWeekdayEvent(name, month, weekday, nth, group, notes = null) {
  return {
    name,
    group,
    notes,
    date: (year) => {
      const first = new Date(year, month - 1, 1, 9, 0, 0)
      const offset = (weekday - first.getDay() + 7) % 7
      return new Date(year, month - 1, 1 + offset + (nth - 1) * 7, 9, 0, 0)
    },
  }
}

function daysAfterNthWeekdayEvent(name, month, weekday, nth, daysAfter, group, notes = null) {
  return {
    name,
    group,
    notes,
    date: (year) => {
      const anchor = nthWeekdayEvent(name, month, weekday, nth, group, notes).date(year)
      anchor.setDate(anchor.getDate() + daysAfter)
      return anchor
    },
  }
}

function holidayGroupLabel(group) {
  return HOLIDAY_SOURCE_GROUPS.find((item) => item.key === group)?.label || group.replace(/_/g, ' ')
}

function migrateLegacyTypes(types = []) {
  const next = []
  if (types.includes('public')) next.push('workspace_public')
  if (types.includes('observance')) next.push('global')
  return next.length ? next : DEFAULT_HOLIDAY_SETTINGS.groups
}

function validCountry(code) {
  return HOLIDAY_COUNTRIES.some((country) => country.code === code) ? code : null
}

function uniqueCountries(countries) {
  const seen = new Set()
  return (countries || []).filter((code) => {
    const valid = validCountry(code)
    if (!valid || seen.has(valid)) return false
    seen.add(valid)
    return true
  })
}

function dedupeHolidayItems(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = `${item.title}-${item.scheduled_at.slice(0, 10)}-${item.type}-${item.country || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function yearsInRange(start, end) {
  const years = []
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) years.push(year)
  return years
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}
