import type { ConversationSnapshot } from '../contracts'
import type { StoredTurn } from '../types'

/** Read-only presentation of durable messages. Empty assistance is absent, never a completed analysis. */
export function conversationTurns(snapshot: ConversationSnapshot): StoredTurn[] {
  const turns: StoredTurn[] = []
  for (const message of snapshot.messages) {
    if (message.wordGloss && message.wordGloss.sourceMessageId !== message.id) {
      throw new Error('Saved word meanings do not belong to this message.')
    }
    if (message.role === 'user') {
      const feedback = message.feedback
      turns.push({ userGlossOperationId: message.glossOperationId, userSavedGloss: message.wordGloss, userTranslation: message.translation, userGlossError: message.glossError, userGlossState: message.glossState, id: message.sequence, user: message.text, assistant: null, analysisState: feedback ? 'done' : ['ready', 'running', 'waiting_dependencies'].includes(message.feedbackState ?? '') ? 'pending' : null, coachError: message.feedbackError ?? undefined,
        ...(feedback ? { coach: {
          grammar: feedback.correctness, conversation: feedback.understandability, remark: feedback.explanation,
          used_target: [], used_native: [], corrections: feedback.correction ? [{ said: message.text, kind: 'correction', corrected: feedback.correction, explanation: feedback.explanation }] : [],
        } } : {}) })
    } else if (message.role === 'assistant') {
      const previous = turns.at(-1)
      const turn = previous && previous.assistant === null ? previous : { id: message.sequence, user: null, assistant: null, analysisState: null }
      turn.assistant = {
        messageId: message.id,
        reply: message.text, translation: message.translation, translationState: message.translationState,
        savedGloss: message.wordGloss, glossError: message.glossError, glossState: message.glossState, glossOperationId: message.glossOperationId,
        tokens: [], user_tokens: [], user_translation: null, mechanics: [],
        scaffolds: { replies: message.suggestedReplies ?? [], frames: [], starters: [], coach_help: null }, errors: [],
      }
      if (turn !== previous) turns.push(turn)
    } else throw new Error('Unexpected conversation message role.')
  }
  return turns
}
