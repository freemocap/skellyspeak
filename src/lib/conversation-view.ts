import type { ConversationSnapshot } from '../contracts'
import type { StoredTurn } from '../types'

/** Read-only presentation of durable messages. Empty assistance is absent, never a completed analysis. */
export function conversationTurns(snapshot: ConversationSnapshot): StoredTurn[] {
  const turns: StoredTurn[] = []
  for (const message of snapshot.messages) {
    if (message.role === 'user') {
      turns.push({ id: message.sequence, user: message.text, assistant: null, analysisState: null })
    } else if (message.role === 'assistant') {
      const previous = turns.at(-1)
      const turn = previous && previous.assistant === null ? previous : { id: message.sequence, user: null, assistant: null, analysisState: null }
      turn.assistant = {
        reply: message.text, translation: message.translation,
        tokens: [], user_tokens: [], user_translation: null, mechanics: [],
        scaffolds: { replies: [], frames: [], starters: [], coach_help: null }, errors: [],
      }
      if (turn !== previous) turns.push(turn)
    } else throw new Error('Unexpected conversation message role.')
  }
  return turns
}
