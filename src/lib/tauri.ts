import { logDebug, logError, logInfo, logWarn } from './log'
import type {
  Graph,
  HostedAccount,
  ObserverDocuments,
  Reconciliation,
  Run,
  RunStarted,
  ChatSummary,
  OpenedConversation,
  Settings,
  StoredTurn,
} from '../types'

export const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

function summarize(args?: Record<string, unknown>): string {
  if (!args) return '{}'
  try {
    const json = JSON.stringify(args, (_k, v) =>
      typeof v === 'string' && v.length > 120 ? `${v.slice(0, 120)}…(${v.length}ch)` : v
    )
    return json.length > 400 ? `${json.slice(0, 400)}…` : json
  } catch {
    return '<unserializable>'
  }
}

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  const started = performance.now()
  logDebug(`[ipc] ${cmd} →`, summarize(args))
  try {
    const result = await invoke<T>(cmd, args)
    logDebug(`[ipc] ${cmd} ✓ ${(performance.now() - started).toFixed(0)}ms`)
    return result
  } catch (e) {
    logError(`[ipc] ${cmd} ✗ ${(performance.now() - started).toFixed(0)}ms:`, e)
    throw e
  }
}

/// The language registry lives in Rust (`languages.rs`) and is fetched once
/// at startup. There is no copy of it here: one table, one definition.
export interface DialectInfo {
  id: string
  label: string
}

export interface LanguageInfo {
  code: string
  base: string
  name: string
  endonym: string
  direction: 'ltr' | 'rtl'
  romanization: string | null
  dialects: DialectInfo[]
}

let registry: LanguageInfo[] | null = null

/// Load the registry before the first render. Fails loudly — the UI cannot
/// render a language picker it does not have.
export async function loadLanguages(): Promise<void> {
  registry = await invoke<LanguageInfo[]>('get_languages')
  logInfo(`[lang] registry loaded: ${registry.map((l) => l.code).join(', ')}`)
}

/// The registry. Throws if called before `loadLanguages()` has resolved.
export function languages(): LanguageInfo[] {
  if (registry === null) {
    throw new Error('language registry not loaded - loadLanguages() must run before render')
  }
  return registry
}

/// The registry entry for a target-language code, or null if unknown.
export function languageFor(code: string): LanguageInfo | null {
  const base = code.split('-')[0]
  return languages().find((l) => l.code === code || l.base === base) ?? null
}

/// One character, as the core defines it.
export interface Persona {
  id: string
  label: string
  /// The description that goes into the reply prompt, verbatim.
  sketch: string
  /// Ships with the app: readable in the editor, but never editable or
  /// deletable, so there is always a working set to get back to.
  builtin: boolean
}

/// The list plus anything that went wrong reading it. Faults travel with the
/// data rather than being logged: a personas file that could not be read shows
/// up to the learner as "my characters are gone", and they are owed the reason.
export interface PersonaList {
  personas: Persona[]
  faults: string[]
}

/// The characters the learner can be paired with. Asked for rather than
/// hardcoded: the personas live in Rust because the prompt is built from them,
/// and a copy here would drift the first time one is added.
export function listPersonas(): Promise<PersonaList> {
  return invoke<PersonaList>('list_personas')
}

/// Create (`id: ''`) or update one of the learner's own characters. Refuses to
/// touch a built-in.
export function savePersona(id: string, label: string, sketch: string): Promise<Persona> {
  return invoke<Persona>('save_persona', { id, label, sketch })
}

export function deletePersona(id: string): Promise<void> {
  return invoke<void>('delete_persona', { id })
}

export function getSettings(): Promise<Settings> {
  return invoke<Settings>('get_settings')
}

export interface KeyStatus {
  valid: boolean
  detail: string
}

export function validateKey(
  provider: 'openrouter' | 'groq',
  key: string
): Promise<KeyStatus> {
  return invoke('validate_key', { provider, key })
}

/// Sign in to the hosted service. Opens the system browser and resolves once
/// the redirect comes back — which can take as long as the user takes.
export function hostedSignIn(): Promise<HostedAccount> {
  return invoke<HostedAccount>('hosted_sign_in')
}

/// Identity and remaining allowance for the stored session.
export function hostedAccount(): Promise<HostedAccount> {
  return invoke<HostedAccount>('hosted_account')
}

export function hostedSignOut(): Promise<void> {
  return invoke('hosted_sign_out')
}

/// Every chat for this pairing, most recently used first.
export function listConversations(target: string, native: string): Promise<ChatSummary[]> {
  return invoke<ChatSummary[]>('list_conversations', { target, native })
}

/// The chat currently open for this pairing, starting one if there is none.
///
/// The pairing is named explicitly rather than inferred from settings: the
/// webview knows which conversation the turns on screen belong to, and saying
/// so is what stops a language switch racing an in-flight save and filing one
/// conversation under another's name. Saves name the chat id for the same
/// reason.
export function loadConversation(
  target: string,
  native: string
): Promise<OpenedConversation> {
  return invoke<OpenedConversation>('load_conversation', { target, native })
}

/// Switch to another chat. Its coach thread comes with it.
export function openConversation(
  target: string,
  native: string,
  id: string
): Promise<OpenedConversation> {
  return invoke<OpenedConversation>('open_conversation', { target, native, id })
}

export function saveConversation(
  target: string,
  native: string,
  id: string,
  turns: StoredTurn[],
  title: string
): Promise<void> {
  return invoke('save_conversation', { target, native, id, turns, title })
}

/// Start a fresh chat and make it the open one. What the tutor has learned
/// about the learner is deliberately kept — it lives above the chats.
export function newConversation(target: string, native: string): Promise<string> {
  return invoke<string>('new_conversation', { target, native })
}

/// Take a chat out of the list. Its turns stay on disk, marked with the time
/// they were removed.
export function deleteConversation(
  target: string,
  native: string,
  id: string
): Promise<void> {
  return invoke('delete_conversation', { target, native, id })
}

export function getDiagnostics(): Promise<[string, number][]> {
  return invoke('get_diagnostics')
}

/// Pop the observability panel into its own OS window. Desktop only —
/// the window is built in Rust, so the webview never needs window-creation
/// permission.
export function openDevWindow(): Promise<void> {
  return invoke('open_dev_window')
}

/// The execution graph as Rust declares it. The UI renders this and only
/// this — a hand-drawn diagram would drift from the code within a week.
export function getGraph(): Promise<Graph[]> {
  return invoke('get_graph')
}

/// The declared graph diffed against what actually ran.
export function getReconciliation(): Promise<Reconciliation> {
  return invoke('get_reconciliation')
}

/// Every AI run still in memory, oldest first.
export function getRuns(): Promise<Run[]> {
  return invoke('get_runs')
}

export function clearRuns(): Promise<void> {
  return invoke('clear_runs')
}

/// Operation starts. Subscribe alongside `subscribeRuns` to know what is
/// working *now* rather than what has already finished.
export async function subscribeRunStarts(
  onStart: (run: RunStarted) => void
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<RunStarted>('trace:run_started', (e) => onStart(e.payload))
}

/// An operation stopped at the pipeline gate, waiting to be let through.
export interface HeldOperation {
  id: number
  operation: string
  turn_id: number | null
}

/// Whether the agent pipeline is paused, and what is queued behind it.
export interface GateStatus {
  paused: boolean
  /// Operations still allowed through while paused — spent by stepping.
  budget: number
  waiting: HeldOperation[]
}

/// Pause the pipeline. This holds REAL work: the next operation stops before
/// its model call, so the conversation genuinely stops advancing.
export function gatePause(): Promise<GateStatus> {
  return invoke('gate_pause')
}

export function gateResume(): Promise<GateStatus> {
  return invoke('gate_resume')
}

/// Let `count` operations through, then stop again.
export function gateStep(count = 1): Promise<GateStatus> {
  return invoke('gate_step', { count })
}

export function gateStatus(): Promise<GateStatus> {
  return invoke('gate_status')
}

/// Live gate state. Fires when it is paused, resumed, stepped, and whenever an
/// operation arrives at or leaves the queue.
export async function subscribeGate(
  onChange: (status: GateStatus) => void
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<GateStatus>('trace:gate', (e) => onChange(e.payload))
}

/// The trace bus. Every agent execution lands here the moment it finishes,
/// from ANY command — not just guided_turn, which is the only one with a
/// per-turn channel. Returns an unsubscribe function.
export async function subscribeRuns(
  onRun: (run: Run) => void
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<Run>('trace:run', (event) => onRun(event.payload))
}

export function saveSettings(settings: Settings): Promise<void> {
  return invoke('save_settings', { settings })
}

/// Drain faults the Rust core recorded before the webview existed. Called once
/// on mount so a startup failure reaches the screen instead of only a log file.
export function takeStartupFaults(): Promise<string[]> {
  return invoke<string[]>('take_startup_faults')
}

/// Restore every setting to its built-in default and clear both API keys.
/// Returns the fresh settings (secrets masked) as the backend now holds them.
export function resetSettings(): Promise<Settings> {
  return invoke<Settings>('reset_settings')
}



export function getPlan(): Promise<ObserverDocuments> {
  return invoke('get_plan')
}

export { logDebug, logError, logInfo, logWarn }
