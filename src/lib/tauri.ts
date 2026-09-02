import { logDebug, logError, logInfo, logWarn } from './log'
import type {
  Graph,
  Level,
  ObserverDocuments,
  Reconciliation,
  Run,
  RunStarted,
  Settings,
  Story,
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
/// at startup. There is no copy of it here — a second table is exactly how
/// the dialect lists drifted apart before.
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

export function generateStory(level: Level): Promise<Story> {
  return invoke('generate_story', { level })
}

export function transcribeAudio(
  audioBase64: string,
  prompt?: string
): Promise<string> {
  return invoke('transcribe_audio', { audioBase64, prompt: prompt ?? null })
}

export function getPlan(): Promise<ObserverDocuments> {
  return invoke('get_plan')
}

export { logDebug, logError, logInfo, logWarn }
