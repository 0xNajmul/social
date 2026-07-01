import { useEffect, useMemo, useRef, useState } from 'react'

export default function useInfiniteList(items, options = {}) {
  const pageSize = options.pageSize || 50
  const hasExternalMore = Boolean(options.hasExternalMore)
  const externalLoading = Boolean(options.externalLoading)
  const onEndReached = options.onEndReached
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const sentinelRef = useRef(null)
  const itemKey = useMemo(() => (
    (items || []).map((item) => item?.id ?? item?.key ?? item).join('|')
  ), [items])
  const resetKey = options.resetKey ?? itemKey

  useEffect(() => {
    const timer = window.setTimeout(() => setVisibleCount(pageSize), 0)
    return () => window.clearTimeout(timer)
  }, [pageSize, resetKey])

  useEffect(() => {
    const node = sentinelRef.current
    const length = (items || []).length
    const hasLocalMore = visibleCount < length
    if (!node || (!hasLocalMore && !hasExternalMore) || externalLoading) return undefined

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      if (visibleCount < length) {
        setVisibleCount((current) => Math.min(current + pageSize, length))
        return
      }
      onEndReached?.()
    }, { rootMargin: '360px 0px' })

    observer.observe(node)
    return () => observer.disconnect()
  }, [externalLoading, hasExternalMore, items, onEndReached, pageSize, visibleCount])

  return {
    hasMore: visibleCount < (items || []).length || hasExternalMore,
    items: (items || []).slice(0, visibleCount),
    sentinelRef,
    visibleCount,
  }
}
