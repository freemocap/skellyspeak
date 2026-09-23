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
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const request = useRef(0)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++ } }, [])

  const read = useCallback(async (from: string | null) => {
    if (!itemId) return
    const current = ++request.current
    const item = itemId
    setLoading(true)
    try {
      const page = await drillAttempts(item, from, PAGE)
      if (!mounted.current || current !== request.current) return
      setAttempts(existing => from === null ? page.attempts : [...existing, ...page.attempts])
      setCursor(page.nextCursor)
      setFailure(null)
    } catch (error) {
      if (mounted.current && current === request.current) setFailure(error)
    } finally {
      if (mounted.current && current === request.current) setLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    request.current++
    setAttempts([]); setCursor(null); setFailure(null)
    if (!active || !itemId) return
    void read(null)
    const unsubscribe = onRecordingPublished(owner => {
      if (owner.kind === 'drillItem' && owner.id === itemId) void read(null)
    })
    return () => { unsubscribe() }
  }, [active, itemId, read])

  return {
    attempts,
    loading,
    failure,
    hasMore: cursor !== null,
    loadMore: () => { if (cursor !== null && !loading) void read(cursor) },
    retry: () => void read(null),
  }
}
