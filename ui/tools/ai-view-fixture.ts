/** A conversation mid-turn for AI View previews: operations shaped like a real
 * snapshot of turn_plan.rs PLAN, advanced by a tick, and the answers native
 * code gives the view about it. No native or AI calls. */
import type { TurnView } from '../src/generated/contracts'

const PLAN: [string, string[], string][] = [
  ['persona_context', [], 'local'], ['persona_reply', ['persona_context'], 'standard'], ['skill_assessment', ['persona_context'], 'fast'],
  ['coach_retry_check', ['persona_context'], 'standard'], ['user_word_gloss', ['persona_context'], 'standard'], ['user_translation', ['persona_context'], 'standard'],
  ['persona_word_gloss', ['persona_reply'], 'standard'], ['persona_speech', ['persona_reply'], 'speech'], ['reply_translation', ['persona_reply'], 'standard'],
  ['reply_explanations', ['persona_reply'], 'standard'], ['reply_assistance', ['persona_reply'], 'standard'], ['conversation_feedback', ['persona_reply'], 'standard'],
]
const TIMING: Record<string, [number, number]> = { persona_context: [0, 1], persona_reply: [1, 10], skill_assessment: [1, 5], coach_retry_check: [1, 3], user_word_gloss: [2, 6], user_translation: [2, 5], persona_word_gloss: [10, 14], persona_speech: [10, 16], reply_translation: [10, 13], reply_explanations: [10, 15], reply_assistance: [11, 14], conversation_feedback: [11, 16] }
export const REPLY = '¡Qué bien! Entonces fuiste al mercado el sábado. ¿Qué compraste allí? Me encantan los mercados de fruta por la mañana.'
export const origin = Date.parse('2026-09-18T10:00:00.000Z')

export function snapshotAt(tick: number, id: string): TurnView {
  const at = (ticks: number) => new Date(origin + ticks * 450).toISOString()
  const operations = PLAN.map(([kind, dependencies, role]) => {
    const [start, end] = TIMING[kind]
    const state = tick < start ? (dependencies.length ? 'waiting_dependencies' : 'ready') : tick < end ? 'running' : 'succeeded'
    return { sourceMessageId: null, id: `${id}-${kind}`, kind, contractVersion: 1, dependencies: dependencies.map(dep => `${id}-${dep}`), role, state: kind === 'skill_assessment' && tick >= 1 && tick < 3 ? 'held' : state }
  })
  const attempts = PLAN.filter(([kind]) => tick >= TIMING[kind][0]).map(([kind]) => ({
    id: `${id}-${kind}-attempt`, operationId: `${id}-${kind}`, state: tick < TIMING[kind][1] ? 'running' : 'succeeded',
    requestedModel: 'google/gemini-2.5-flash', actualModel: tick < TIMING[kind][1] ? null : 'google/gemini-2.5-flash', providerId: null,
    startedAt: at(TIMING[kind][0]), finishedAt: tick < TIMING[kind][1] ? null : at(TIMING[kind][1]), inputTokens: 1200, outputTokens: 90, error: null, unpublishedText: null,
  }))
  return { replacesTurnId: null, replacedBy: null, route: 'hosted', id, state: tick < 10 ? 'pending' : tick < 16 ? 'assisting' : 'succeeded', paused: false, hold: null, operations, attempts }
}

/// The fixture's turn with its attempt times moved to the present, so running
/// work shows live durations rather than time since the fixture's date.
export function presentTurn(tick: number, id: string): TurnView {
  const turn = snapshotAt(tick, id)
  const shift = Date.now() - (origin + tick * 450)
  const moved = (time: string | null) => time && new Date(Date.parse(time) + shift).toISOString()
  return { ...turn, attempts: turn.attempts.map(attempt => ({ ...attempt, startedAt: moved(attempt.startedAt)!, finishedAt: moved(attempt.finishedAt) })) }
}

/// Native answers to the AI View's reads of conversation `c`, holding `turns`;
/// undefined for any command the view does not send.
export function aiViewCommand(command: string, args: unknown, turns: TurnView[]): unknown {
  const request = args as { afterRevision?: number } | undefined
  switch (command) {
    case 'watch_conversation': return (request?.afterRevision ?? -1) < 1
      ? { conversationId: 'c', revision: 1, transcriptionAttempts: [], turns }
      : new Promise(() => {})
    case 'list_turn_history': return { turns: [], hasOlder: false }
    case 'get_attempt_detail': return { requestMessages: [{ role: 'system', content: 'Reply as the partner, in Spanish.' }, { role: 'user', content: 'Fui al mercado el sábado.' }], responseText: REPLY, previewText: null }
    case 'get_ai_view_selection': return null
    case 'set_ai_view_selection': return null
    case 'read_attempt_streams': return { generation: 1, entries: [] }
    case 'ai_window_state': return { supported: false, open: false }
    case 'get_persona_generation_activity': return { revision: 0, attempts: [], usage: { attempts: 0, inputTokens: 0, outputTokens: 0, unknownUsage: 0 } }
    default: return undefined
  }
}

/// The conversation the AI View follows, for a preview's workspace snapshot.
export const AI_VIEW_CONVERSATION = { id: 'c', archived: false, languageId: 'spanish', lastUsed: 1 }
