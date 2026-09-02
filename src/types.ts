export interface Shortcuts {
  mic: string
  speak: string
  panel: string
  settings: string
}

export interface Settings {
  openrouter_key: string
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
  tts_engine: string
  tts_voice: string
  shortcuts: Shortcuts
}

export interface GuidedToken {
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
  replies: string[]
  frames: string[]
  starters: string[]
}

export interface GuidedTurnResult {
  reply: string
  translation: string | null
  tokens: GuidedToken[]
  user_tokens: GuidedToken[]
  user_translation: string | null
  mechanics: Mechanic[]
  scaffolds: Scaffolds
  errors: string[]
}

export interface StoryToken {
  text: string
  gloss: string | null
}

export interface StoryParagraph {
  tokens: StoryToken[]
}

export interface Story {
  title: string
  paragraphs: StoryParagraph[]
}

export interface CoachCorrection {
  said: string
  corrected: string
  explanation: string
  kind: string
}

export interface CoachFeedback {
  remark: string
  used_target: string[]
  used_native: string[]
  corrections: CoachCorrection[]
  comprehensibility: number
  grammar: number
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
  | { type: 'analysis_done'; turn: GuidedTurnResult }
  | { type: 'analysis_failed'; error: string }
  | { type: 'plan_updated'; plan: TeachingPlan; profile: Profile }

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
  sessions: number
}

export interface ObserverDocuments {
  plan: TeachingPlan
  profile: Profile
}

export type AnalysisState = 'pending' | 'done' | 'failed'

export type Level = 'beginner' | 'intermediate' | 'advanced'


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

export interface Attempt {
  index: number
  kind: AttemptKind
  duration_ms: number
  /** The provider's or parser's own message, verbatim. */
  error: string | null
  usage: Usage | null
}

export interface Run {
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
  id: number
  turn_id: number | null
  operation: string
  actor: Actor
  label: string
  model: string
  started_at_ms: number
}
