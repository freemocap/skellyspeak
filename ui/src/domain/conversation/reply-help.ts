import type { ChatMessage, ReplyHelpKind, TurnView } from '../../generated/contracts'

export interface HelpLane {
  state: string | null
  revision?: string
  error?: string | null
  details?: unknown
}
export interface ReplyHelpView {
  brief: ChatMessage['replyBrief']
  assistance: ChatMessage['replyAssistance']
  grammar: ChatMessage['replyExplanations']
  scope: ChatMessage['readingScope']
  lanes: Record<ReplyHelpKind, HelpLane>
}

/** Results and lifecycle have separate authority: an empty result is still success. */
export function replyHelp(message: ChatMessage, turn?: TurnView): ReplyHelpView {
  function lane(kind: ReplyHelpKind, state: string | null | undefined, error: string | null | undefined, present: boolean): HelpLane {
    const operation = turn?.operations.find(item => item.replyHelpKind === kind)
    const attempt = turn?.attempts.filter(item => item.operationId === operation?.id).at(-1)
    const status = turn?.replacedBy || ['cancelled', 'invalidated'].includes(turn?.state ?? '') ? 'invalidated'
      : operation?.state ?? state ?? null
    return { state: status, revision: `${operation?.state}:${attempt?.id}:${attempt?.state}`, error: status === 'succeeded' && !present ? 'Saved reply help is missing its result.' : error,
      details: { operation, attempt, hold: turn?.hold } }
  }
  return {
    brief: message.replyBrief, assistance: message.replyAssistance, grammar: message.replyExplanations, scope: message.readingScope,
    lanes: {
      brief: lane('brief', message.briefState, message.briefError, message.replyBrief != null),
      replies: lane('replies', message.suggestionsState, message.suggestionsError, message.replyAssistance != null),
      grammar: lane('grammar', message.explanationsState, message.explanationsError, message.replyExplanations != null),
    },
  }
}
