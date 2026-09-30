import type { AttemptView, TurnView } from '../../generated/contracts'
import { messageKey } from '../localization/messages'
import { latestAttempt, operationPhase } from '../conversation/activity-summary'
import { isProseReply } from '../conversation/reply-state'

/// One step in three wordings, longest first: at most three words, then two,
/// then one. The composer shows the longest that fits beside the AI pill.
export type StatusWords = readonly [string, string, string]

/// Steps the recorded operations do not name: the recording, the send, the
/// queue, a prose reply's request and its token stream, and the connection.
/// Every wording names the machinery at work, so the line teaches how a turn
/// is made to anyone who glances at it.
export const STEP_WORDS = {
  transcribe: [messageKey('Transcribing recorded audio…'), messageKey('Transcribing audio…'), messageKey('Transcribing…')],
  schedule: [messageKey('Scheduling reply turn…'), messageKey('Scheduling turn…'), messageKey('Scheduling…')],
  dispatch: [messageKey('Awaiting request dispatch…'), messageKey('Awaiting dispatch…'), messageKey('Queued…')],
  replyRequest: [messageKey('Generating partner reply…'), messageKey('Generating reply…'), messageKey('Generating…')],
  replyStream: [messageKey('Streaming reply tokens…'), messageKey('Receiving reply…'), messageKey('Streaming…')],
  coachRequest: [messageKey('Generating coach reply…'), messageKey('Generating reply…'), messageKey('Generating…')],
  coachStream: [messageKey('Streaming coach tokens…'), messageKey('Receiving reply…'), messageKey('Streaming…')],
  check: [messageKey('Checking AI connection…'), messageKey('Checking connection…'), messageKey('Checking…')],
  offline: [messageKey('AI not connected'), messageKey('Not connected'), messageKey('Disconnected')],
  // A card's reference audio comes from native's speech cache or a new
  // synthesis; the reading result does not say which, so it is only fetched.
  cardAudio: [messageKey('Fetching card audio…'), messageKey('Fetching audio…'), messageKey('Fetching…')],
} as const satisfies Record<string, StatusWords>

const CONTEXT: StatusWords = [messageKey('Validating conversation context…'), messageKey('Validating context…'), messageKey('Validating…')]
const SPEECH: StatusWords = [messageKey('Synthesizing partner voice…'), messageKey('Synthesizing voice…'), messageKey('Synthesizing…')]

/// Recorded operations by scheduler kind, worded from what each one does
/// (native/src/diagnostics/ai_graphs.rs describes them). A kind missing here
/// is shown by its own name, as the AI panel shows it.
export const OPERATION_WORDS: Readonly<Record<string, StatusWords>> = {
  persona_context: CONTEXT,
  coach_context: CONTEXT,
  coach_feedback: [messageKey('Coach correcting message…'), messageKey('Finding corrections…'), messageKey('Correcting…')],
  coach_retry_check: [messageKey('Checking your revision…'), messageKey('Checking revision…'), messageKey('Rechecking…')],
  conversation_feedback: [messageKey('Scoring your message…'), messageKey('Scoring message…'), messageKey('Scoring…')],
  coach_reaction: [messageKey('Rating partner understanding…'), messageKey('Rating understanding…'), messageKey('Rating…')],
  skill_assessment: [messageKey('Detecting skill evidence…'), messageKey('Detecting skills…'), messageKey('Detecting…')],
  skill_attribution: [messageKey('Locating skill evidence…'), messageKey('Locating evidence…'), messageKey('Locating…')],
  reply_assistance: [messageKey('Drafting reply suggestions…'), messageKey('Drafting suggestions…'), messageKey('Drafting…')],
  reply_explanations: [messageKey('Explaining reply grammar…'), messageKey('Explaining grammar…'), messageKey('Explaining…')],
  reply_brief: [messageKey('Writing message brief…'), messageKey('Writing brief…'), messageKey('Briefing…')],
  persona_word_gloss: [messageKey('Glossing reply words…'), messageKey('Glossing words…'), messageKey('Glossing…')],
  user_word_gloss: [messageKey('Glossing your words…'), messageKey('Glossing words…'), messageKey('Glossing…')],
  reply_translation: [messageKey('Translating partner reply…'), messageKey('Translating reply…'), messageKey('Translating…')],
  user_translation: [messageKey('Translating your message…'), messageKey('Translating message…'), messageKey('Translating…')],
  persona_speech: SPEECH,
  coach_suggestions: [messageKey('Drafting coach suggestions…'), messageKey('Drafting suggestions…'), messageKey('Drafting…')],
}

/// What one recording surface is doing. Chat supplies its turns; Practice has
/// none and reports its attempts' transcription and its cards' audio.
export interface AiStatusInput {
  /// Recorded audio is with the speech service.
  transcribing: boolean
  /// A send is with native storage, before its turn is recorded.
  scheduling: boolean
  /// The conversation's recorded turns, newest first.
  turns: readonly Pick<TurnView, 'id' | 'operations' | 'attempts'>[]
  /// Attempts whose streamed text has begun to arrive.
  streaming: ReadonlySet<string>
  /// Speech audio requested for playback, until it plays: a partner message's
  /// voice being synthesized, or a practice card's audio being fetched.
  audio: 'partner' | 'card' | null
  connection: 'connected' | 'checking' | 'disconnected'
  /// The configured audio models, named beside the steps they run.
  models: { transcription: string | null; speech: string | null }
}

export interface AiStatusLine {
  /// A new id is a new line in the stream; the same id keeps its place.
  id: string
  tone: 'work' | 'check' | 'offline'
  /// Steps the learner started are announced; background work is only shown.
  announce: boolean
  /// Catalog wordings, longest first; null names the operation by its kind.
  words: StatusWords | null
  /// Scheduler kinds and requested models behind the line.
  kinds: string[]
  models: string[]
}

function line(id: string, words: StatusWords | null, details: Partial<AiStatusLine> = {}): AiStatusLine {
  return { id, tone: 'work', announce: false, words, kinds: [], models: [], ...details }
}

function started(attempt: AttemptView | null): number {
  const time = attempt ? Date.parse(attempt.startedAt) : Number.NaN
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
}

/// The newest turn's running work: its prose reply while that runs, otherwise
/// the operation that started most recently, so the line follows the graph.
function runningWork(turns: AiStatusInput['turns'], streaming: ReadonlySet<string>): AiStatusLine | null {
  for (const turn of turns) {
    const running = turn.operations
      .map((operation, index) => ({ operation, index, attempt: latestAttempt(turn, operation.id) }))
      .filter(item => operationPhase(item.operation.state) === 'running')
    if (!running.length) continue
    const reply = running.find(item => isProseReply(item.operation.kind))
    const { operation, attempt } = reply ?? running.sort((a, b) => started(b.attempt) - started(a.attempt) || b.index - a.index)[0]
    const details = { kinds: [operation.kind], models: attempt ? [attempt.actualModel ?? attempt.requestedModel] : [] }
    if (!reply) return line(`run:${operation.kind}`, OPERATION_WORDS[operation.kind] ?? null, details)
    const streamed = attempt !== null && streaming.has(attempt.id)
    const coach = operation.kind === 'coach_reply'
    const words = streamed ? (coach ? STEP_WORDS.coachStream : STEP_WORDS.replyStream) : (coach ? STEP_WORDS.coachRequest : STEP_WORDS.replyRequest)
    return line(`${streamed ? 'stream' : 'request'}:${operation.kind}`, words, { ...details, announce: !streamed })
  }
  return null
}

/// What the AI is doing now, as one line, and whether any of it is AI work.
/// Learner steps lead, then recorded operations, then queued work and replayed
/// speech; the connection speaks only when nothing else does. Held and failed
/// operations are not work: the latest turn's activity line reports them.
export function aiStatus(input: AiStatusInput): { busy: boolean; line: AiStatusLine | null } {
  const running = runningWork(input.turns, input.streaming)
  const queued = !running && input.turns.some(turn => turn.operations.some(operation => operation.state === 'ready'))
  const busy = input.transcribing || input.scheduling || input.audio !== null || running !== null || queued
  const model = (name: string | null) => name ? [name] : []
  if (input.transcribing) return { busy, line: line('transcribe', STEP_WORDS.transcribe,
    { announce: true, kinds: ['speech_transcription'], models: model(input.models.transcription) }) }
  if (input.scheduling) return { busy, line: line('schedule', STEP_WORDS.schedule, { announce: true }) }
  if (running) return { busy, line: running }
  if (queued) return { busy, line: line('dispatch', STEP_WORDS.dispatch) }
  if (input.audio === 'partner') return { busy, line: line('synthesize', SPEECH, { kinds: ['persona_speech'], models: model(input.models.speech) }) }
  if (input.audio === 'card') return { busy, line: line('card-audio', STEP_WORDS.cardAudio, { models: model(input.models.speech) }) }
  if (input.connection === 'checking') return { busy, line: line('check', STEP_WORDS.check, { tone: 'check' }) }
  if (input.connection === 'disconnected') return { busy, line: line('offline', STEP_WORDS.offline, { tone: 'offline' }) }
  return { busy, line: null }
}
