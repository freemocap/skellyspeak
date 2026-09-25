import { useCallback, useEffect, useRef, useState } from 'react'
import { drillAttempts } from '../../platform/ipc/drill'
import { onRecordingPublished } from '../../platform/audio/recording-events'
import type { DrillAttemptView } from '../../generated/contracts'

const PAGE = 20

/** One phrase's attempt history, a page at a time.
 *
 * Native owns the order and the cursor. A newly published attempt re-reads the
 * first page rather than being spliced in here, so the list is always what
 * native says it is. Late pages for a phrase the learner has left are dropped. */
export function useDrillAttempts(itemId: string | null, active: boolean) {
  const [attempts, setAttempts] = useState<DrillAttemptView[]>([])
  const [loadedItem, setLoadedItem] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const request = useRef(0)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++ } }, [])

  const read = useCallback(async (from: string | null) => {
    if (!active || !itemId) return
    const current = ++request.current
    const item = itemId
    setLoading(true)
    try {
      const page = await drillAttempts(item, from, PAGE)
      if (!mounted.current || current !== request.current) return
      setLoadedItem(item)
      setAttempts(existing => from === null ? page.attempts : [...existing, ...page.attempts])
      setCursor(page.nextCursor)
      setFailure(null)
    } catch (error) {
      if (mounted.current && current === request.current) { setLoadedItem(item); setFailure(error) }
    } finally {
      if (mounted.current && current === request.current) setLoading(false)
    }
  }, [active, itemId])

  useEffect(() => {
    request.current++
    setAttempts([]); setCursor(null); setFailure(null)
    if (!active || !itemId) return
    void read(null)
    const unsubscribe = onRecordingPublished(owner => {
      if (owner.kind === 'drillItem' && owner.id === itemId) void read(null)
    })
    return () => { request.current++; unsubscribe() }
  }, [active, itemId, read])

  // Effects clear history after render; never expose another phrase's takes
  // to consumers during that intervening render.
  const currentItem = active && loadedItem === itemId
  return {
    attempts: currentItem ? attempts : [],
    loading: active && itemId !== null && (!currentItem || loading),
    failure: currentItem ? failure : null,
    hasMore: currentItem && cursor !== null,
    loadMore: () => { if (currentItem && cursor !== null && !loading) void read(cursor) },
    retry: () => void read(null),
  }
}
