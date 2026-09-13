import { useState } from 'react'
import type { ChatMessage, ConversationSnapshot } from '../../contracts'
import type { StoredTurn } from '../../types'
import { conversationTurns } from '../../domain/language/conversation-view'
import { nativeError, watchConversation } from '../../platform/ipc/workspace'
import { TargetText } from '../../ui/TargetText'

/** Retained wording is inspection history, never another active reply. */
export function EarlierVersions({ turn, snapshot }: {
  turn: StoredTurn; snapshot: ConversationSnapshot
}) {
  const { conversationId, revision, hasOlder } = snapshot
  const before = Math.min(...snapshot.messages.map(message => message.sequence))
  const [pages, setPages] = useState<ChatMessage[]>([])
  const turns = conversationTurns({ ...snapshot, messages: [...pages, ...snapshot.messages].sort((a, b) => a.sequence - b.sequence) })
  const [cursor, setCursor] = useState(before)
  const [more, setMore] = useState(hasOlder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const versions: StoredTurn[] = []
  let id = turn.replacesTurnId
  const seen = new Set<string>()
  while (id) {
    if (seen.has(id)) throw new Error('Revision history contains a cycle.')
    seen.add(id)
    const previous = turns.find(item => item.turnId === id)
    if (!previous) break
    versions.push(previous)
    id = previous.replacesTurnId
  }
  const incomplete = versions.some(previous => previous.user === null)
  async function load() {
    setBusy(true); setError(null)
    try {
      const page = await watchConversation(conversationId, -1, cursor)
      if (page.conversationId !== conversationId || page.revision !== revision) throw new Error('Conversation changed. Reopen earlier versions to review current history.')
      if (!page.messages.length) throw new Error('Earlier version history is unavailable.')
      setPages(previous => [...previous, ...page.messages])
      setCursor(Math.min(...page.messages.map(message => message.sequence)))
      setMore(page.hasOlder)
    } catch (reason) { setError(nativeError(reason)) }
    finally { setBusy(false) }
  }
  return <details className="earlier-versions">
    <summary>Earlier version</summary>
    {versions.map(previous => <div className="turn-stack" key={previous.turnId}>
      {previous.user !== null && <div className="msg me plain" dir="auto"><TargetText text={previous.user} /></div>}
      {previous.assistant && <div className="msg bot" dir="auto"><TargetText text={previous.assistant.reply} /></div>}
    </div>)}
    {(id || incomplete) && (more ? <button type="button" disabled={busy} onClick={() => void load()}>{busy ? 'Loading…' : 'Load earlier versions'}</button> : <p role="alert">Earlier version history is unavailable.</p>)}
    {error && <p role="alert">{error}</p>}
  </details>
}
