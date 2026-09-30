import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConversationSnapshot } from '../../../generated/contracts'
import { nativeError, watchConversation } from '../../../platform/ipc/workspace'
import { useAiBusyStore } from '../../../state/session/ai-busy'

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

type Observation = {
  active: boolean; stopped: boolean; chatId: string; snapshot: ConversationSnapshot | null
  floor: number | null; loading: boolean; refreshing: boolean; refresh: ConversationSnapshot | null
  messageRevisions: Map<string, number>; turnRevisions: Map<string, number>; suffixRevisions: Map<string, number>
}

/** A merged snapshot's revision describes its newest metadata, not every cached
 * record. Keep per-record revisions so a delayed history read can update older
 * records without undoing a newer reply, translation or replacement marker. */
function observePage(current: Observation, page: ConversationSnapshot, replace = false): ConversationSnapshot {
  const source = current.snapshot
  if (page.conversationId !== current.chatId || (source && page.sessionId !== source.sessionId)) throw new Error('Conversation snapshot scope mismatch.')
  if (replace) { current.messageRevisions.clear(); current.turnRevisions.clear(); current.suffixRevisions.clear() }
  const merge = <T,>(previous: T[], incoming: T[], revisions: Map<string, number>, key: (value: T) => string): T[] => {
    const values = new Map(previous.map(value => [key(value), value]))
    for (const value of incoming) {
      const id = key(value)
      if (page.revision < (revisions.get(id) ?? -1)) continue
      values.set(id, value); revisions.set(id, page.revision)
    }
    return [...values.values()]
  }
  const messages = merge(replace ? [] : source?.messages ?? [], page.messages, current.messageRevisions, value => value.id).sort((a, b) => a.sequence - b.sequence)
  const turns = merge(replace ? [] : source?.turns ?? [], page.turns, current.turnRevisions, value => value.id)
  const revisionSuffixCounts = merge(replace ? [] : source?.revisionSuffixCounts ?? [], page.revisionSuffixCounts, current.suffixRevisions, value => value.turnId)
  const newest = !source || page.revision >= source.revision
  const order = [...new Set((newest ? [page.turns, turns] : [turns, page.turns]).flat().map(turn => turn.id))]
  const byId = new Map(turns.map(turn => [turn.id, turn]))
  const extendsHistory = !source?.messages.length || (page.messages[0]?.sequence ?? Infinity) <= source.messages[0].sequence
  return { ...(newest || replace ? page : source!), messages, turns: order.map(id => byId.get(id)!), revisionSuffixCounts,
    hasOlder: replace || extendsHistory ? page.hasOlder : source!.hasOlder }
}

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
    const current: Observation | null = chatId ? { active: true, stopped: false, chatId, snapshot: sameScope ? previous.snapshot : null, floor: sameScope ? previous.floor : null, loading: false,
      refreshing: false, refresh: null, messageRevisions: sameScope ? previous.messageRevisions : new Map(), turnRevisions: sameScope ? previous.turnRevisions : new Map(), suffixRevisions: sameScope ? previous.suffixRevisions : new Map() } : null
    observation.current = current
    setSnapshot(current?.snapshot ?? null); setReadError(null); setOlderError(null); setLoadingOlder(false)
    if (!current) return
    const fail = (error: unknown) => {
      if (!current.active || current.stopped) return
      current.stopped = true; setReadError(nativeError(error))
    }
    const publish = (page: ConversationSnapshot, replace = false) => {
      const merged = observePage(current, page, replace)
      if (current.floor !== null && merged.messages.length) current.floor = Math.min(current.floor, merged.messages[0].sequence)
      current.snapshot = merged; setSnapshot(merged)
    }
    // One history walk at a time, with newer refresh requests coalesced. A slow
    // history page must not block the live watcher or a second arriving reply.
    const refreshHistory = (next: ConversationSnapshot) => {
      current.refresh = next
      if (current.refreshing) return
      current.refreshing = true
      void (async () => {
        while (current.active && !current.stopped && current.refresh) {
          let page = current.refresh
          current.refresh = null
          while (current.active && !current.stopped && current.floor !== null && page.hasOlder && page.messages[0]?.sequence > current.floor) {
            const before = page.messages[0].sequence
            page = await watchConversation(current.chatId, -1, before)
            if (!current.active || current.stopped) return
            if (!page.messages.length || page.messages[0].sequence >= before) throw new Error('Older conversation page did not advance.')
            publish(page)
          }
        }
      })().catch(fail).finally(() => {
        current.refreshing = false
        if (current.active && !current.stopped && current.refresh) refreshHistory(current.refresh)
      })
    }
    void (async () => {
      let revision = -1
      while (current.active && !current.stopped) {
        const next = await watchConversation(current.chatId, revision)
        if (!current.active || current.stopped) return
        if (next.conversationId !== current.chatId) throw new Error('Conversation snapshot scope mismatch.')
        if (next.revision !== revision) {
          publish(next, current.floor === null)
          if (current.floor !== null) refreshHistory(next)
        }
        revision = next.revision
      }
    })().catch(fail)
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
      const merged = observePage(current, page)
      current.floor = merged.messages[0].sequence
      current.snapshot = merged; setSnapshot(merged)
    } catch (error) { if (current.active) setOlderError(nativeError(error)) }
    finally { if (current.active) { current.loading = false; setLoadingOlder(false) } }
  }, [])
  const retryRead = useCallback(() => setRetryVersion(value => value + 1), [])
  const visible = snapshot?.conversationId === chatId ? snapshot : null
  const busy = visible?.turns.some(turn => turn.operations.some(operation => operation.state === 'running')) ?? false
  useEffect(() => { useAiBusyStore.getState().setBusy(busy) }, [busy])
  useEffect(() => () => useAiBusyStore.getState().setBusy(false), [])
  return { snapshot: visible, readError, retryRead, olderError, loadingOlder, loadOlder }
}
