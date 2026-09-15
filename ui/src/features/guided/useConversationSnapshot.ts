import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConversationSnapshot } from '../../generated/contracts'
import { nativeError, watchConversation } from '../../platform/ipc/workspace'

/** Merge bounded pages by durable identity; newer page data wins independently of arrival order. */
export function mergeConversationPages(pages: ConversationSnapshot[]): ConversationSnapshot {
  if (!pages.length) throw new Error('No conversation page was returned.')
  const latest = pages.reduce((a, b) => b.revision > a.revision ? b : a)
  const messages = new Map<string, ConversationSnapshot['messages'][number]>()
  const turns = new Map<string, ConversationSnapshot['turns'][number]>()
  for (const page of [...pages].sort((a, b) => a.revision - b.revision)) {
    if (page.conversationId !== latest.conversationId || page.sessionId !== latest.sessionId) throw new Error('Conversation snapshot scope mismatch.')
    for (const message of page.messages) messages.set(message.id, message)
    for (const turn of page.turns) turns.set(turn.id, turn)
  }
  const ordered = [...messages.values()].sort((a, b) => a.sequence - b.sequence)
  // The first page owns the live turn order, including coach turns without chat messages.
  const ids = [...new Set(pages.flatMap(page => page.turns.map(turn => turn.id)))]
  const oldest = pages.reduce((a, b) => (b.messages[0]?.sequence ?? Infinity) < (a.messages[0]?.sequence ?? Infinity) ? b : a)
  return { ...latest, messages: ordered, turns: ids.map(id => turns.get(id)!), hasOlder: oldest.hasOlder }
}

type Observation = { active: boolean; chatId: string; snapshot: ConversationSnapshot | null; floor: number | null; loading: boolean }

/** Read-only observation with explicit reconnection. Reconnecting never admits AI work. */
export function useConversationSnapshot(chatId: string | null) {
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [olderError, setOlderError] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const observation = useRef<Observation | null>(null)
  useEffect(() => {
    const previous = observation.current
    const sameScope = previous?.chatId === chatId
    const current: Observation | null = chatId ? { active: true, chatId, snapshot: sameScope ? previous.snapshot : null, floor: sameScope ? previous.floor : null, loading: false } : null
    observation.current = current
    setSnapshot(current?.snapshot ?? null); setReadError(null); setOlderError(null); setLoadingOlder(false)
    if (!current) return
    void (async () => {
      let revision = -1
      while (current.active) {
        const next = await watchConversation(current.chatId, revision)
        if (!current.active) return
        if (next.conversationId !== current.chatId) throw new Error('Conversation snapshot scope mismatch.')
        if (next.revision !== revision) {
          const pages = [next]
          let page = next
          // Reload the explicitly revealed range, one bounded native page at a time.
          // This also updates old revisions and bridges a moving live-tail boundary.
          while (current.active && current.floor !== null && page.hasOlder && page.messages[0]?.sequence > current.floor) {
            const before = page.messages[0].sequence
            page = await watchConversation(current.chatId, -1, before)
            if (!current.active) return
            if (!page.messages.length || page.messages[0].sequence >= before) throw new Error('Older conversation page did not advance.')
            pages.push(page)
          }
          if (!current.active) return
          const merged = mergeConversationPages(pages)
          current.snapshot = merged; setSnapshot(merged)
        }
        revision = next.revision
      }
    })().catch(error => { if (current.active) setReadError(nativeError(error)) })
    return () => { current.active = false }
  }, [chatId, retryVersion])

  const loadOlder = useCallback(async () => {
    const current = observation.current
    const source = current?.snapshot
    if (!current?.active || current.loading || !source?.hasOlder || !source.messages.length) return
    const before = source.messages[0].sequence
    // Keep this visible tail while its older-page read is in flight. Otherwise a
    // jump of more than one live page could create an unobserved middle gap.
    current.floor ??= before
    current.loading = true; setLoadingOlder(true); setOlderError(null)
    try {
      const page = await watchConversation(current.chatId, -1, before)
      if (!current.active) return
      if (!page.messages.length || page.messages[0].sequence >= before) throw new Error('Older conversation page did not advance.')
      const merged = mergeConversationPages([current.snapshot ?? source, source, page])
      current.floor = merged.messages[0].sequence
      current.snapshot = merged; setSnapshot(merged)
    } catch (error) { if (current.active) setOlderError(nativeError(error)) }
    finally { if (current.active) { current.loading = false; setLoadingOlder(false) } }
  }, [])
  const retryRead = useCallback(() => setRetryVersion(value => value + 1), [])
  return { snapshot: snapshot?.conversationId === chatId ? snapshot : null, readError, retryRead, olderError, loadingOlder, loadOlder }
}
