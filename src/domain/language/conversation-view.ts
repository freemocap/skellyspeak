import type { ConversationSnapshot } from '../../contracts'
import type { StoredTurn } from '../../types'

/** Read-only presentation of durable messages. Empty assistance is absent, never a completed analysis. */
export function conversationTurns(snapshot: ConversationSnapshot): StoredTurn[] {
  const turns: StoredTurn[] = []
  const byIdentity = new Map<string, StoredTurn>()
  for (const message of snapshot.messages) {
    if (!message.turnId) throw new Error('Conversation message is missing its durable turn identity.')
    if (message.wordGloss && message.wordGloss.sourceMessageId !== message.id) {
      throw new Error('Saved word meanings do not belong to this message.')
    }
    let turn = byIdentity.get(message.turnId)
    if (!turn) {
      turn = { id: message.sequence, turnId: message.turnId, replacesTurnId: message.replacesTurnId, replacedBy: message.replacedBy, user: null, assistant: null, analysisState: null }
      byIdentity.set(message.turnId, turn)
      turns.push(turn)
    }
    if (message.role === 'user') {
      const feedback = message.feedback
      Object.assign(turn, { userGlossOperationId: message.glossOperationId, userSavedGloss: message.wordGloss, userTranslation: message.translation, userGlossError: message.glossError, userGlossState: message.glossState, id: message.sequence, user: message.text, analysisState: feedback ? 'done' : ['ready', 'running', 'waiting_dependencies'].includes(message.feedbackState ?? '') ? 'pending' : null, coachError: message.feedbackError ?? undefined,
        ...(feedback ? { coach: feedback } : {}) })
    } else if (message.role === 'assistant') {
      turn.assistant = {
        messageId: message.id,
        reply: message.text, translation: message.translation, translationState: message.translationState,
        savedGloss: message.wordGloss, glossError: message.glossError, glossState: message.glossState, glossOperationId: message.glossOperationId,
        tokens: [], user_tokens: [], user_translation: null, mechanics: [],
        scaffolds: { replies: message.suggestedReplies ?? [], frames: [], starters: [] },
        suggestionsState: message.suggestionsState ?? null,
        errors: message.suggestionsError ? [message.suggestionsError] : [],
      }
    } else throw new Error('Unexpected conversation message role.')
  }
  return turns
}
