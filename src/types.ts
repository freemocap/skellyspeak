export interface Shortcuts {
  mic: string
  speak: string
  panel: string
  settings: string
}

export interface Settings {
  scope?: { sessionId: string; conversationId: string; settingsRevision: number; learnerRevision: number }
  /// 'hosted' (the project's service, signed in with Google), 'cloud'
  /// (OpenRouter with the user's key) or 'custom' (their own
  /// SkellySpeak server). Mirrors settings.rs PROVIDER_* constants.
  provider_mode: string
  /// Always empty here: the Rust side blanks the session token on its way out
  /// and ignores whatever comes back. Sign in and out through the commands.
  hosted_token: string
  /// Who is signed in, for display. Empty means signed out.
  hosted_email: string
  /// Always empty here too — the anonymous installation id stays in Rust.
  install_id: string
  openrouter_key: string
  custom_base_url: string
  custom_api_key: string
  custom_model: string
  groq_key: string
  openrouter_model: string
  observer_model: string | null
  target_language: string
  target_dialect: string
  native_language: string
  microphone_device_id: string | null
  auto_speak: boolean
  auto_send: boolean
  always_romanize: boolean
  auto_translate: boolean
  text_size: number
  text_spacing: number
  always_pronunciation: boolean
  fast_mode: boolean
  reward_sounds: import('./lib/reward-sounds').RewardSoundMode
  master_volume: number
  voice_volume: number
  effects_volume: number
  tts_engine: string
  tts_voice: string
  tts_rate: number
  shortcuts: Shortcuts
}

/// One row in the chat history sidebar. Mirrors `ChatSummary` in
/// `conversation.rs`.
export interface ChatSummary {
  id: string
  /// Derived from the first thing said. Empty for a chat with no turns yet.
  title: string
  updated_at: number
  turn_count?: number
}

/// A conversation as opened: which one it is, and its turns.
export interface OpenedConversation {
  id: string
  turns: StoredTurn[]
}

export type AnalysisState = 'pending' | 'done' | null

/// The coach's private read on one learner message.
export interface CoachFeedbackBody {
  grammar: number
  remark: string
  used_target: string[]
  used_native: string[]
  corrections: CoachCorrection[]
}

export type CoachFeedback = CoachFeedbackBody & (
  | { conversation: number; comprehensibility?: never }
  | { comprehensibility: number; conversation?: never }
)

export interface PartnerReaction {
  kind: 'confused' | 'understood' | 'curious' | 'surprised' | 'concerned'
  interpretation: string
  explanation: string
}

/// One exchange, as stored. This is the canonical turn shape: the live turn in
/// GuidedPage is this plus `pendingText`, the streaming buffer, which is
/// transient by definition and never written to disk.
export interface StoredTurn {
  id: number
  user: string | null
  assistant: GuidedTurnResult | null
  /// null before analysis starts, 'pending' while it runs, 'done' when it
  /// lands. There is no 'failed': the core always finishes with a result and
  /// reports per-section problems in `assistant.errors`, which the analysis
  /// pane renders.
  analysisState: AnalysisState
  coach?: CoachFeedback
  reaction?: PartnerReaction
  reactionError?: string
  coachError?: string
}

/// Identity and remaining allowance on the hosted service. Mirrors
/// `GET /v1/me` and the `Account` struct in `hosted.rs`.
/// Mirrors `GET /v1/me`. The allowance is money — the service meters what the
/// provider actually charged, because a token's price varies about a
/// hundredfold across models. Tokens and turns are ESTIMATES derived from this
/// account's own usage, for readability, and gate nothing.
export interface HostedAccount {
  email: string
  name: string
  used_usd: number
  limit_usd: number
  remaining_usd: number
  tokens_today: number
  requests_today: number
  estimated_requests_remaining: number
  estimated_tokens_remaining: number
  /// This account has its own daily limit instead of the service default.
  custom_limit: boolean
  resets: string
}

export interface GuidedToken {
  pronunciation: string | null
  text: string
  gloss: string | null
  pos: string | null
  notable: boolean
  romanization: string | null
}

export interface Mechanic {
  title: string
  cefr: string | null
  body: string
  example: string | null
  contrast: string | null
}

export interface Scaffolds {
  coach_help: CoachHelp | null
  replies: string[]
  frames: string[]
  starters: string[]
}

export interface AssistedPhrase {
  text: string
  translation: string
  romanization: string | null
  pronunciation: string
}

export interface CoachHelp {
  explanation: string
  partner: AssistedPhrase
  replies: AssistedPhrase[]
}

export interface GuidedTurnResult {
  translationState?: string | null
  messageId?: string
  savedGloss?: import('./contracts').WordGlossView | null
  glossError?: string | null
  glossState?: string | null
  glossOperationId?: string | null
  reply: string
  translation: string | null
  tokens: GuidedToken[]
  user_tokens: GuidedToken[]
  user_translation: string | null
  mechanics: Mechanic[]
  scaffolds: Scaffolds
  errors: string[]
}

export interface CoachCorrection {
  said: string
  corrected: string
  explanation: string
  kind: string
}



export type CoachEvent =
  | { type: 'coach_done'; feedback: CoachFeedback }
  | { type: 'coach_failed'; error: string }

export type GuidedEvent =
  | { type: 'reply_delta'; text: string }
  | { type: 'reply_done'; reply: string }
  | {
      type: 'analysis_section'
      tokens?: GuidedToken[]
      translation?: string
      user_tokens?: GuidedToken[]
      user_translation?: string
      mechanics?: Mechanic[]
      scaffolds?: Scaffolds
    }
  | CoachEvent
  | { type: 'reaction_done'; reaction: PartnerReaction }
  | { type: 'reaction_failed'; error: string }
  | { type: 'analysis_done'; turn: GuidedTurnResult }
  | { type: 'plan_updated'; plan: TeachingPlan; profile: Profile }
  // Background work started by this turn failed. Goes straight to the fault bar.
  | { type: 'fault'; context: string; message: string }

export interface RecurringError {
  error: string
  correction: string
  seen_count: number
}

export interface TaughtMechanic {
  mechanic: string
  last_seen_turn: number
}

export interface TeachingPlan {
  session_focus: string[]
  recurring_errors: RecurringError[]
  vocab_recycle: string[]
  avoid: string[]
  learner_interests: string[]
  energy_read: string
  correction_budget: number
  taught_ledger: TaughtMechanic[]
}

export interface Profile {
  about: string
  level_notes: string
  strengths: string[]
  weaknesses: string[]
  interests: string[]
  long_term_errors: RecurringError[]
}

export interface ObserverDocuments {
  plan: TeachingPlan
  profile: Profile
}

export interface LessonChoices {
  goal: string
  preferences: string[]
  correction_budget: number | null
}

export interface LessonChange {
  revision: number
  at_ms: number
  source: string
  reason: string
  before: LessonChoices
  after: LessonChoices
}

export interface LessonState {
  revision: number
  choices: LessonChoices
  changes: LessonChange[]
}

export interface CoachMessage {
  role: string
  content: string
  proposal: LessonChoices | null
  lesson_revision: number | null
}


export type Level = 'beginner' | 'intermediate' | 'advanced' | 'fluent'


// ─── Observability: one Run per agent execution ──────────────────────────
// Mirrors src-tauri/src/trace.rs. See skellyspeak-docs/docs/observability.md.

/// Who a unit of work belongs to. Mirrors ontology.rs::Actor.
/// Only two agents exist — `chat` and `coach`. Everything else is the Runner.
export type Actor =
  | { type: 'agent'; id: 'chat' | 'coach' }
  | { type: 'runner' }

export type AttemptKind =
  | 'ok'
  | 'rate_limited'
  | 'unparseable'
  | 'invalid'
  | 'failed'

export type RunOutcome = 'ok' | 'retried_then_ok' | 'failed'

export interface Usage {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  cost: number | null
}

export interface RequestContext {
  chat_id: string; message_id: number | null; replaces_message_id: number | null; trigger: string
  target: string; native: string; dialect: string; provider_mode: string; difficulty: 'zero' | 'beginner' | 'intermediate' | 'advanced' | 'fluent'
  inferred_level_notes: string; topic: string | null; lesson_revision: number; partner: unknown; history_messages: number; history_available: number
}
export interface PromptBlock { id: string; source: string; content: string }
export interface RecordedRequest {
  messages: { role: string; content: string; truncated: boolean }[]
  parameters: Record<string, unknown>; route: string; blocks: PromptBlock[]; truncated: boolean
}
export interface LengthCheck { status: string; sentences: number; words: number | null; violations: string[]; method: string }
export interface Attempt {
  request: RecordedRequest | null
  response: string | null
  response_truncated: boolean
  index: number
  kind: AttemptKind
  duration_ms: number
  /** The provider's or parser's own message, verbatim. */
  error: string | null
  usage: Usage | null
}

export interface Run {
  session_id: string
  app_version: string
  context: RequestContext | null
  length_checks: LengthCheck[]
  application_status: string
  id: number
  /** Groups every run fired by one conversational turn. */
  turn_id: number | null
  /// Which ontology Operation ran.
  operation: string
  actor: Actor
  label: string
  model: string
  temperature: number | null
  reasoning: boolean
  max_tokens: number | null
  streamed: boolean
  schema: string | null
  started_at_ms: number
  first_token_ms: number | null
  duration_ms: number
  usage: Usage | null
  attempts: Attempt[]
  outcome: RunOutcome
  error: string | null
  /** The messages actually sent, as `role: content` blocks. The *content*
   *  of the node — payload only, never headers. */
  prompt: string | null
  /** The model's raw response, before parsing. */
  output: string | null
}

// ─── The declared graph (src-tauri/src/graph.rs) ─────────────────────────
// The frontend draws ONLY what get_graph returns. No second copy.

export type NodeKind = 'input' | 'agent_step' | 'tool' | 'faculty' | 'barrier'

export type EdgeKind =
  | 'sequential'
  | 'fan_out'
  /** Node → your screen, the instant it finishes. Nothing waits for siblings. */
  | 'hydrate'
  /** Reconciliation only — never a gate. */
  | 'fan_in'
  | 'conditional'
  | 'background'

export interface GraphNode {
  id: string
  label: string
  kind: NodeKind
  operation: string | null
  purpose: string
  x: number
  y: number
}

export interface GraphEdge {
  from: string
  to: string
  kind: EdgeKind
  condition: string | null
}

export interface Graph {
  id: string
  label: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  shared_state: string[]
}

// ─── Reconciliation: the graph's own fidelity (src-tauri/src/trace.rs) ───
// The observability layer reporting on itself. A declaration that cannot
// tell you when it is wrong is a claim, not an observation.

export interface EdgeVerdict {
  from: string
  to: string
  verdict: 'observed' | 'contradicted' | 'unobserved'
  detail: string | null
}

export interface Reconciliation {
  turns_observed: number
  /** Ran, but no node declares it — the map is missing something. */
  undeclared_operations: string[]
  /** Declared but never seen to run this session. Unproven, not wrong. */
  unobserved_operations: string[]
  edges: EdgeVerdict[]
  consistent: boolean
}

/** Announced when an operation begins — see trace.rs. A completed `Run`
 *  arrives far too late to show that something is working right now. */
export interface RunStarted {
  context: RequestContext | null
  id: number
  turn_id: number | null
  operation: string
  actor: Actor
  label: string
  model: string
  started_at_ms: number
}
