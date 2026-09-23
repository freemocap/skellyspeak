import { useEffect, useState } from 'react'
import { startDrillSession, endDrillSession, enterDrillVisit, leaveDrillVisit } from '../../platform/ipc/drill'
import { reportFault } from '../../platform/diagnostics/faults'

let transitions = Promise.resolve()

/** Serialize transitions, including cleanup: a late entry can never replace a
 * newer visit, and an unmounted page still closes the session it opened. */
export function useDrillVisit(active: boolean, language: string | null, itemId: string | null) {
  const [session, setSession] = useState<{ id: string; language: string } | null>(null)
  const [visit, setVisit] = useState<{ id: string; item: string; session: string } | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [retry, setRetry] = useState(0)
  const enqueue = (work: () => Promise<void>) => {
    transitions = transitions.then(work).catch(error => reportFault('Drill session', error))
  }
  useEffect(() => {
    let current = true
    let id: string | null = null
    setSession(null); setFailure(null)
    if (active && language) enqueue(async () => {
      if (!current) return
      try {
        id = await startDrillSession(language)
        if (current) setSession({ id, language })
      } catch (error) { if (current) setFailure(error); throw error }
    })
    return () => {
      current = false
      enqueue(async () => { if (id) await endDrillSession(id) })
    }
  }, [active, language, retry])

  const sessionId = active && session?.language === language ? session.id : null
  useEffect(() => {
    let current = true
    let id: string | null = null
    setVisit(null)
    if (sessionId && itemId) enqueue(async () => {
      if (!current) return
      try {
        id = await enterDrillVisit(sessionId, itemId)
        if (current) setVisit({ id, item: itemId, session: sessionId })
      } catch (error) { if (current) setFailure(error); throw error }
    })
    return () => {
      current = false
      enqueue(async () => { if (id) await leaveDrillVisit(id) })
    }
  }, [sessionId, itemId])
  return {
    sessionId,
    visitId: visit && visit.item === itemId && visit.session === sessionId ? visit.id : null,
    failure,
    retry: () => setRetry(value => value + 1),
  }
}
