import type { ConnectionConfig, AccessSettings, RewardSettings } from '../contracts'
import { readWorkspace, selectedConversation, executeAction } from './workspace'
import { SHORTCUT_DEFAULTS } from './keyboard'
import { invoke as nativeInvoke } from './native'
import { validateAudioVolumes } from './audio-settings'
import { logDebug, logError, logInfo, logWarn } from './log'
import type {
  Graph,
  HostedAccount,
  ObserverDocuments,
  Reconciliation,
  Run,
  RunStarted,
  Settings,
} from '../types'

export const isTauri =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const started = performance.now()
  logDebug(`[ipc] ${cmd} →`)
  try {
    const result = await nativeInvoke<T>(cmd, args)
    logDebug(`[ipc] ${cmd} ✓ ${(performance.now() - started).toFixed(0)}ms`)
    return result
  } catch (e) {
    logError(`[ipc] ${cmd} ✗ ${(performance.now() - started).toFixed(0)}ms`)
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
  fontScale: number
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
  const snapshot = await readWorkspace()
  registry = snapshot.languages.map(language => {
    if (language.direction !== 'ltr' && language.direction !== 'rtl') throw new Error('Invalid language direction.')
    return { fontScale: language.fontScale, code: language.id, base: language.id, name: language.name, endonym: language.nativeName,
      direction: language.direction, romanization: language.romanization,
      dialects: language.varieties.map(variety => ({ id: variety.id, label: variety.name })) }
  })
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
  return languages().find(l => l.code === code || l.dialects.some(v => v.id === code)) ?? null
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
export interface ConversationPartner {
  persona: Persona
  introduction: string | null
  origin: 'new_chat' | 'recovered_history'
}

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

/** View settings combine native conversation choices and learner display preferences. */
export async function getSettings(): Promise<Settings> {
  const [snapshot, connection, access, rewards, playbackRate] = await Promise.all([
    readWorkspace(), invoke<ConnectionConfig>('get_connection'), invoke<AccessSettings>('get_access_settings'), invoke<RewardSettings>('get_reward_settings'), invoke<number>('get_playback_rate'),
  ])
  const conversation = selectedConversation(snapshot)
  if (!conversation) throw new Error('No active conversation is available.')
  const preferences = snapshot.learner.preferences
  return {
    scope: { sessionId: snapshot.sessionId, conversationId: conversation.id, settingsRevision: conversation.settingsRevision, learnerRevision: snapshot.learner.revision, rewardRevision: rewards.revision },
    provider_mode: connection.route === 'openrouter' ? 'cloud' : connection.route,
    hosted_token: '', hosted_email: connection.email, install_id: '', openrouter_key: '', groq_key: '', custom_api_key: '',
    custom_base_url: access.custom.baseUrl, custom_model: access.custom.standardModel,
    openrouter_model: connection.standardModel, observer_model: null,
    target_language: conversation.languageId, target_dialect: conversation.settings.varietyId,
    native_language: conversation.settings.explanationLanguage,
    always_romanize: conversation.settings.romanization, always_pronunciation: conversation.settings.pronunciation,
    auto_translate: conversation.settings.translation, text_size: preferences.textSize, text_spacing: preferences.textSpacing,
    // Unsupported controls are disabled. These presentation values confer no runtime capability.
    microphone_device_id: null, auto_speak: conversation.settings.readAloud, auto_send: conversation.settings.autoSend, fast_mode: rewards.fastMode,
    reward_sounds: rewards.rewardSounds as Settings['reward_sounds'], master_volume: rewards.masterVolume, voice_volume: rewards.voiceVolume, effects_volume: rewards.effectsVolume,
    tts_engine: 'cloud', tts_voice: conversation.settings.speechVoice, tts_rate: playbackRate, shortcuts: { ...SHORTCUT_DEFAULTS },
  }
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

export function getDiagnostics(): Promise<[string, number][]> {
  return invoke('get_diagnostics')
}

/// Pop the observability panel into its own OS window. Desktop only —
/// the window is built in Rust, so the webview never needs window-creation
/// permission.
export function openDevWindow(): Promise<void> {
  return invoke('open_ai_window')
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

/// Retained AI runs across application restarts, oldest first.
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

export async function saveSettings(settings: Settings): Promise<void> {
  if (!settings.scope) throw new Error('Reload settings before saving.')
  validateAudioVolumes(settings)
  const snapshot = await readWorkspace()
  const scope = settings.scope
  if (scope.sessionId !== snapshot.sessionId) throw new Error('The application session changed. Reload settings.')
  const conversation = snapshot.conversations.find(c => c.id === scope.conversationId)
  if (!conversation) throw new Error('The settings conversation is unavailable.')
  if (conversation.settingsRevision !== scope.settingsRevision || snapshot.learner.revision !== scope.learnerRevision) throw new Error('Settings changed. Reload before saving.')
  if (settings.openrouter_key || settings.groq_key || settings.custom_api_key || settings.hosted_token) throw new Error('Credentials must use the AI access controls.')
  if (settings.microphone_device_id !== null || settings.tts_engine !== 'cloud' || settings.tts_voice !== 'alloy' || JSON.stringify(settings.shortcuts) !== JSON.stringify(SHORTCUT_DEFAULTS)) throw new Error('This preference is not connected yet.')
  const rewards: RewardSettings = { revision: scope.rewardRevision, fastMode: settings.fast_mode, rewardSounds: settings.reward_sounds, masterVolume: settings.master_volume, voiceVolume: settings.voice_volume, effectsVolume: settings.effects_volume }
  const currentRewards = await invoke<RewardSettings>('get_reward_settings')
  if (JSON.stringify(rewards) !== JSON.stringify(currentRewards)) await invoke('save_reward_settings', { settings: rewards })
  const currentRate = await invoke<number>('get_playback_rate')
  if (settings.tts_rate !== currentRate) await invoke('save_playback_rate', { rate: settings.tts_rate })
  const practice = { ...conversation.settings, explanationLanguage: settings.native_language, varietyId: settings.target_dialect,
    autoSend: settings.auto_send, readAloud: settings.auto_speak, speechVoice: settings.tts_voice,
    translation: settings.auto_translate, pronunciation: settings.always_pronunciation, romanization: settings.always_romanize }
  const preferences = { ...snapshot.learner.preferences, textSize: settings.text_size, textSpacing: settings.text_spacing }
  const practiceChanged = JSON.stringify(practice) !== JSON.stringify(conversation.settings)
  const displayChanged = JSON.stringify(preferences) !== JSON.stringify(snapshot.learner.preferences)
  if (settings.target_language !== conversation.languageId) {
    const selected = selectedConversation(snapshot, settings.target_language)
    await executeAction(snapshot, selected ? { kind: 'openConversation', conversationId: selected.id } : { kind: 'startChat', languageId: settings.target_language })
    const nativeChanged = settings.native_language !== conversation.settings.explanationLanguage
    if (nativeChanged || displayChanged) {
      const fresh = await readWorkspace()
      const owner = selectedConversation(fresh, settings.target_language)
      if (!owner) throw new Error('The selected language conversation is unavailable.')
      if (nativeChanged) await executeAction(fresh, { kind: 'updateSettings', conversationId: owner.id, expectedRevision: owner.settingsRevision, settings: { ...owner.settings, explanationLanguage: settings.native_language } })
      if (displayChanged) await executeAction(fresh, { kind: 'updateLearner', expectedRevision: fresh.learner.revision, name: fresh.learner.name, preferences: { ...fresh.learner.preferences, textSize: settings.text_size, textSpacing: settings.text_spacing } })
    }
    return
  }
  if (practiceChanged) await executeAction(snapshot, { kind: 'updateSettings', conversationId: conversation.id, expectedRevision: scope.settingsRevision, settings: practice })
  if (displayChanged) await executeAction(snapshot, { kind: 'updateLearner', expectedRevision: scope.learnerRevision, name: snapshot.learner.name, preferences })
}

/// Drain faults the Rust core recorded before the webview existed. Called once
/// on mount so a startup failure reaches the screen instead of only a log file.
export function takeStartupFaults(): Promise<string[]> {
  return invoke<string[]>('take_startup_faults')
}

/// Restore every setting to its built-in default and clear both API keys.
/// Returns the fresh settings (secrets masked) as the backend now holds them.
export async function resetSettings(): Promise<Settings> {
  const settings = await invoke<Settings>('reset_settings')
  validateAudioVolumes(settings)
  return settings
}



export function getPlan(): Promise<ObserverDocuments> {
  return invoke('get_plan')
}

export { logDebug, logError, logInfo, logWarn }
