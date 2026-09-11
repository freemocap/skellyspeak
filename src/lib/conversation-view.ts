import type { ConversationSnapshot } from '../contracts'
import type { StoredTurn } from '../types'

/** Read-only presentation of durable messages. Empty assistance is absent, never a completed analysis. */
export function conversationTurns(snapshot: ConversationSnapshot): StoredTurn[] {
  const turns: StoredTurn[] = []
  for (const message of snapshot.messages) {
    if (message.role === 'user') {
      turns.push({ id: message.sequence, user: message.text, assistant: null, analysisState: null })
    } else if (message.role === 'assistant') {
      if (message.wordGloss && message.wordGloss.sourceMessageId !== message.id) {
        throw new Error('Saved word meanings do not belong to this message.')
      }
      const previous = turns.at(-1)
      const turn = previous && previous.assistant === null ? previous : { id: message.sequence, user: null, assistant: null, analysisState: null }
      turn.assistant = {
        messageId: message.id,
        reply: message.text, translation: message.translation, translationState: message.translationState,
        savedGloss: message.wordGloss, glossError: message.glossError, glossState: message.glossState, glossOperationId: message.glossOperationId,
        tokens: [], user_tokens: [], user_translation: null, mechanics: [],
        scaffolds: { replies: [], frames: [], starters: [], coach_help: null }, errors: [],
      }
      if (turn !== previous) turns.push(turn)
    } else throw new Error('Unexpected conversation message role.')
  }
  return turns
}
