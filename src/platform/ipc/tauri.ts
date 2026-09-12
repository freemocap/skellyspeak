import type { ConnectionConfig, AccessSettings, RewardSettings } from '../../contracts'
import { readWorkspace, selectedConversation, executeAction } from './workspace'
import { SHORTCUT_DEFAULTS } from '../../domain/input/keyboard'
import { invoke as nativeInvoke } from './native'
import { validateAudioVolumes } from '../../domain/audio/audio-settings'
import { logDebug, logError, logInfo, logWarn } from '../diagnostics/log'
import type { Settings } from '../../types'

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
    tts_rate: playbackRate, shortcuts: { ...SHORTCUT_DEFAULTS },
  }
}

/// The execution graph as Rust declares it. The UI renders this and only
/// this — a hand-drawn diagram would drift from the code within a week.
let settingsWrites: Promise<void> = Promise.resolve()

/** Serialize preference edits; refresh native revisions and apply only the user's delta. */
export function saveSettings(settings: Settings, baseline?: Settings): Promise<void> {
  const save = async () => {
    if (!baseline) return writeSettings(settings)
    for (let attempt = 0; attempt < 3; attempt++) {
      const fresh = await getSettings()
      if (fresh.scope?.sessionId !== baseline.scope?.sessionId || fresh.scope?.conversationId !== baseline.scope?.conversationId) {
        throw new Error('This conversation is no longer selected. Open its settings to edit it.')
      }
      const merged = { ...fresh }
      for (const key of Object.keys(settings) as (keyof Settings)[]) {
        if (key !== 'scope' && JSON.stringify(settings[key]) !== JSON.stringify(baseline[key])) Object.assign(merged, { [key]: settings[key] })
      }
      try { await writeSettings(merged); return }
      catch (error) {
        const conflict = (error as { code?: string })?.code === 'conflict' || (error instanceof Error && error.message === 'Settings changed. Reload before saving.')
        if (!conflict) throw error
        if (attempt === 2) throw new Error('Settings could not be saved because another change is still in progress. Please try again.')
      }
    }
  }
  const result = settingsWrites.then(save, save)
  // The queue tail swallows rejections so one failed save does not poison every
  // later one. This is sequencing only: `result` still carries the rejection to
  // the caller, which is what reports it.
  settingsWrites = result.catch(() => {})
  return result
}

async function writeSettings(settings: Settings): Promise<void> {
  if (!settings.scope) throw new Error('Reload settings before saving.')
  validateAudioVolumes(settings)
  const snapshot = await readWorkspace()
  const scope = settings.scope
  if (scope.sessionId !== snapshot.sessionId) throw new Error('The application session changed. Reload settings.')
  const conversation = snapshot.conversations.find(c => c.id === scope.conversationId)
  if (!conversation) throw new Error('The settings conversation is unavailable.')
  if (conversation.settingsRevision !== scope.settingsRevision) throw new Error('Settings changed. Reload before saving.')
  if (settings.openrouter_key || settings.groq_key || settings.custom_api_key || settings.hosted_token) throw new Error('Credentials must use the AI access controls.')
  if (settings.microphone_device_id !== null || JSON.stringify(settings.shortcuts) !== JSON.stringify(SHORTCUT_DEFAULTS)) throw new Error('This preference is not connected yet.')
  const rewards: RewardSettings = { revision: scope.rewardRevision, fastMode: settings.fast_mode, rewardSounds: settings.reward_sounds, masterVolume: settings.master_volume, voiceVolume: settings.voice_volume, effectsVolume: settings.effects_volume }
  const currentRewards = await invoke<RewardSettings>('get_reward_settings')
  if (JSON.stringify(rewards) !== JSON.stringify(currentRewards)) await invoke('save_reward_settings', { settings: rewards })
  const currentRate = await invoke<number>('get_playback_rate')
  if (settings.tts_rate !== currentRate) await invoke('save_playback_rate', { rate: settings.tts_rate })
  const practice = { ...conversation.settings, explanationLanguage: settings.native_language, varietyId: settings.target_dialect,
    autoSend: settings.auto_send, readAloud: settings.auto_speak, speechVoice: conversation.settings.speechVoice,
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
  if (displayChanged) await executeAction(snapshot, { kind: 'updateLearner', expectedRevision: snapshot.learner.revision, name: snapshot.learner.name, preferences })
}



export { logDebug, logError, logInfo, logWarn }
