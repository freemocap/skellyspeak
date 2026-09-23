import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acceptDrillItems, conversationDrillCandidates, discardDrillPreview, previewDrillItems,
} from '../../platform/ipc/drill-generation'
import { reportFault } from '../../platform/diagnostics/faults'
import type {
  DrillCandidate, DrillGenerationInput, DrillGenerationPreview, ReadingScope,
} from '../../generated/contracts'

/** One candidate and the request that owns it: acceptance is always by native
 * id against the request that produced it, never by text. */
export interface OfferedCandidate { requestId: string; candidate: DrillCandidate }

const CONVERSATION_PAGE = 20

/** The lifetime of one offer of phrases, from either source.
 *
 * Generation is one explicit paid request; regenerating is another explicit one.
 * Conversation extraction pages through source spans with no provider call at
 * all. Both end at the same native acceptance, so selection is shared. */
export function useDrillPreview(scope: ReadingScope | null, onAdded: () => Promise<void>) {
  const [pages, setPages] = useState<DrillGenerationPreview[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [failure, setFailure] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++ } }, [])
  useEffect(() => () => { request.current?.abort(); request.current = null }, [])

  const clear = useCallback(() => {
    generation.current++
    request.current?.abort(); request.current = null
    setPages([]); setCursor(null); setAdded([]); setFailure(null); setRunning(false)
  }, [])

  /// One explicit request. A late answer for a superseded request is dropped
  /// rather than replacing whatever is on screen now.
  const generate = useCallback(async (input: DrillGenerationInput) => {
    generation.current++
    const current = generation.current
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPages([]); setCursor(null); setAdded([]); setFailure(null); setRunning(true)
    try {
      const preview = await previewDrillItems(input, controller.signal)
      if (!mounted.current || current !== generation.current) return
      setPages([preview])
    } catch (error) {
      if (mounted.current && current === generation.current
        && !(error instanceof DOMException && error.name === 'AbortError')) setFailure(error)
    } finally {
      if (mounted.current && current === generation.current) { setRunning(false); request.current = null }
    }
  }, [])

  const cancel = useCallback(() => { request.current?.abort(); request.current = null; setRunning(false) }, [])

  /// Extraction, not generation: no provider call, and the text is taken as it
  /// stands. An empty page can still carry a continuation.
  const loadConversation = useCallback(async (from: string | null) => {
    if (!scope) return
    if (from === null) generation.current++
    const current = generation.current
    setFailure(null); setRunning(true)
    if (from === null) { setPages([]); setCursor(null); setAdded([]) }
    try {
      const page = await conversationDrillCandidates({ scope, cursor: from, limit: CONVERSATION_PAGE })
      if (!mounted.current || current !== generation.current) return
      setPages(existing => from === null ? [page.preview] : [...existing, page.preview])
      setCursor(page.nextCursor)
    } catch (error) {
      if (mounted.current && current === generation.current) setFailure(error)
    } finally {
      if (mounted.current && current === generation.current) setRunning(false)
    }
  }, [scope])

  /// Adopt native candidates by id, grouped by the request that owns each one.
  /// Repeating this returns the same items rather than generating again.
  const accept = useCallback(async (chosen: OfferedCandidate[]) => {
    if (!chosen.length) return
    setAdding(true); setFailure(null)
    try {
      const byRequest = new Map<string, string[]>()
      for (const { requestId, candidate } of chosen) {
        byRequest.set(requestId, [...(byRequest.get(requestId) ?? []), candidate.candidateId])
      }
      for (const [requestId, ids] of byRequest) await acceptDrillItems(requestId, ids)
      if (mounted.current) setAdded(existing => [...existing, ...chosen.map(entry => entry.candidate.candidateId)])
      await onAdded()
    } catch (error) {
      if (mounted.current) setFailure(error)
    } finally { if (mounted.current) setAdding(false) }
  }, [onAdded])

  /// Give back what was not adopted. Accepted provenance is native's and stays.
  const discard = useCallback(() => {
    for (const page of pages) void discardDrillPreview(page.requestId).catch(error => reportFault('Discarding a drill preview', error))
    clear()
  }, [pages, clear])

  const offered: OfferedCandidate[] = pages.flatMap(page =>
    page.candidates.map(candidate => ({ requestId: page.requestId, candidate })))

  return {
    offered,
    requested: pages[0]?.requested ?? null,
    shortfall: pages[0]?.shortfall ?? null,
    hasMore: cursor !== null,
    loadMore: () => { if (cursor !== null && !running) void loadConversation(cursor) },
    asked: pages.length > 0,
    running, adding, added, failure,
    generate, cancel, loadConversation, accept, discard, clear,
  }
}
