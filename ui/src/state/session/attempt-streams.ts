import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import type { AttemptStreamRead, AttemptStreamUpdate, TurnView } from '../../generated/contracts'
import { isProseReply } from '../../domain/conversation/reply-state'
import { onAttemptStream, readAttemptStreams } from '../../platform/ipc/attempt-streams'
import { reportFault } from '../../platform/diagnostics/faults'

/// Streamed text of running attempts, reconciled from native events and reads.
///
/// Rules (plan D.5): a higher workspace generation is adopted and clears the
/// store; a lower one is dropped. Within a generation, only a strictly higher
/// sequence replaces an entry, and every native change raises the sequence, so
/// a terminal change is never lost to an equal number.
interface AttemptStreams {
  generation: number | null
  entries: Record<string, AttemptStreamUpdate>
  /// Returns true when a newer generation was adopted, so the caller re-reads.
  apply: (update: AttemptStreamUpdate) => boolean
  adoptRead: (read: AttemptStreamRead) => void
  evict: (attemptId: string) => void
  reset: () => void
}

export const useAttemptStreams = create<AttemptStreams>((set, get) => ({
  generation: null,
  entries: {},
  apply: update => {
    const { generation, entries } = get()
    if (generation !== null && update.generation < generation) return false
    if (generation === null || update.generation > generation) {
      set({ generation: update.generation, entries: { [update.attemptId]: update } })
      return generation !== null
    }
    const current = entries[update.attemptId]
    if (current && current.seq >= update.seq) return false
    set({ entries: { ...entries, [update.attemptId]: update } })
    return false
  },
  adoptRead: read => {
    const { generation, entries } = get()
    if (generation !== null && read.generation < generation) return
    const base = generation === read.generation ? { ...entries } : {}
    for (const entry of read.entries) {
      const current = base[entry.attemptId]
      if (!current || current.seq < entry.seq) base[entry.attemptId] = entry
    }
    set({ generation: read.generation, entries: base })
  },
  evict: attemptId => {
    const { entries } = get()
    if (!(attemptId in entries)) return
    const next = { ...entries }
    delete next[attemptId]
    set({ entries: next })
  },
  reset: () => set({ generation: null, entries: {} }),
}))

/// Subscribe first, then read, so nothing between the two is missed. A newer
/// generation seen on an event triggers a fresh read.
export function useAttemptStreamSync(conversationId: string | null) {
  useEffect(() => {
    if (!conversationId) return
    let disposed = false
    let stop: (() => void) | null = null
    const read = () => readAttemptStreams(conversationId)
      .then(result => { if (!disposed) useAttemptStreams.getState().adoptRead(result) })
      .catch(error => reportFault('Reading conversation stream', error))
    onAttemptStream(update => {
      if (disposed || update.conversationId !== conversationId) return
      if (useAttemptStreams.getState().apply(update)) void read()
    }).then(unlisten => {
      if (disposed) { unlisten(); return }
      stop = unlisten
      void read()
    }).catch(error => reportFault('Subscribing to conversation stream', error))
    return () => { disposed = true; stop?.() }
  }, [conversationId])
}

/// The streamed text of a turn's prose reply, while the snapshot has not yet
/// taken over. Cancellation can arrive before the retention commit, so an
/// ended state alone is insufficient: saved text must cover the live copy.
export function useReplyStream(turn: TurnView | undefined): AttemptStreamUpdate | null {
  const operation = turn?.operations.find(item => isProseReply(item.kind))
  const attempt = operation ? turn?.attempts.filter(item => item.operationId === operation.id).at(-1) : undefined
  const entry = useAttemptStream(attempt?.id)
  const handedOver = Boolean(entry && attempt && attempt.state !== 'running'
    && (attempt.state === 'succeeded' || !entry.text || attempt.unpublishedText?.startsWith(entry.text)))
  useEffect(() => {
    if (handedOver && attempt) useAttemptStreams.getState().evict(attempt.id)
  }, [handedOver, attempt])
  return handedOver ? null : entry
}

/// The live text of any attempt, for the AI View inspector.
export function useAttemptStream(attemptId: string | null | undefined): AttemptStreamUpdate | null {
  const current = useAttemptStreams(state => attemptId ? state.entries[attemptId] ?? null : null)
  const generation = useAttemptStreams(state => state.generation)
  // Chat and inspector can receive their terminal snapshots at different times.
  // Another reader's eviction cannot revoke text this mounted reader still
  // needs. Keep only its last observed attempt, never across a workspace reset.
  const previous = useRef<AttemptStreamUpdate | null>(null)
  const cached = previous.current?.attemptId === attemptId && previous.current?.generation === generation ? previous.current : null
  const entry = cached && (!current || cached.seq > current.seq) ? cached : current
  useEffect(() => { previous.current = entry }, [entry])
  return entry
}
