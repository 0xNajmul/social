import { useEffect, useState } from 'react'
import api from '../lib/api'

const CACHE_KEY = 'postflow_public_pagination_settings'

export default function usePageSize(key, fallback = 30) {
  const [pageSize, setPageSize] = useState(() => {
    const cached = readCachedSettings()
    return sanitizePageSize(cached?.[key], fallback)
  })

  useEffect(() => {
    let active = true
    api.get('/public/settings')
      .then(({ data }) => {
        const settings = data.data?.pagination || {}
        localStorage.setItem(CACHE_KEY, JSON.stringify(settings))
        if (active) setPageSize(sanitizePageSize(settings[key], fallback))
      })
      .catch(() => {
        if (active) setPageSize((current) => current || fallback)
      })

    return () => { active = false }
  }, [fallback, key])

  return pageSize
}

function readCachedSettings() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function sanitizePageSize(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.max(5, Math.min(Math.round(number), 100))
}
