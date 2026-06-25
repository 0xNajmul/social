import { useEffect, useMemo, useRef, useState } from 'react'

export default function useInfiniteList(items, options = {}) {
  const pageSize = options.pageSize || 50
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const sentinelRef = useRef(null)
  const itemKey = useMemo(() => (
    (items || []).map((item) => item?.id ?? item?.key ?? item).join('|')
  ), [items])

  useEffect(() => {
    const timer = window.setTimeout(() => setVisibleCount(pageSize), 0)
    return () => window.clearTimeout(timer)
  }, [itemKey, pageSize])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || visibleCount >= (items || []).length) return undefined

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setVisibleCount((current) => Math.min(current + pageSize, (items || []).length))
    }, { rootMargin: '360px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [items, pageSize, visibleCount])

  return {
    hasMore: visibleCount < (items || []).length,
    items: (items || []).slice(0, visibleCount),
    sentinelRef,
    visibleCount,
  }
}
