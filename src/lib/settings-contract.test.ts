// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessSettings, Command, ConnectionConfig, Snapshot } from '../contracts'
import type { Settings } from '../types'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => backend)
vi.mock('./log', () => ({ logDebug: vi.fn(), logDiagnostic: vi.fn(), logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }))
import { getSettings, saveSettings } from './tauri'
import { validateAudioVolumes } from './audio-settings'

function directory(): Snapshot {
  return {
    sessionId: 'session', revision: 20,
    learner: { id: 'learner', name: 'Learner', revision: 9, preferences: { explanationLanguage: 'en', textSize: 125, textSpacing: 3, highContrast: true, onboarding: 'completed' } },
    partners: [], relationships: [], languages: [], languageProfiles: [],
    conversations: ['a', 'b'].map((id, index) => ({
      id, relationshipId: 'relationship', languageId: index ? 'fr' : 'es', title: id,
      archived: false, revision: 5, settingsRevision: index + 6, lastUsed: 10 - index, createdAt: '2026-09-10',
      settings: { difficulty: 'advanced', explanationLanguage: 'en', varietyId: index ? 'fr-FR' : 'es-MX', composingHelp: 'generous', coachProactivity: 'occasional', translation: true, pronunciation: false, romanization: true, autoSend: true, readAloud: true, speechVoice: 'alloy' },
    })),
  }
}
let workspace: Snapshot
let connection: ConnectionConfig
let access: AccessSettings
function commands(): Command[] {
  return backend.invoke.mock.calls.filter(([name]) => name === 'execute_command').map(([, args]) => args.command as Command)
}
beforeEach(() => {
  backend.invoke.mockReset()
  workspace = directory()
  connection = { route: 'openrouter', revision: 4, signedIn: true, ownKeyConfigured: true, email: 'person@example.invalid', configured: true, standardModel: 'configured-model', fastModel: 'fast-model', paused: false }
  access = { revision: 4, groqKeyConfigured: true, customKeyConfigured: true, custom: { baseUrl: 'https://example.invalid/v1', standardModel: 'custom-model', fastModel: 'custom-fast-model', bearerAuth: true, transcriptionModel: null } }
  backend.invoke.mockImplementation(async (name: string, args?: { command: Command }) => {
    if (name === 'get_snapshot') return workspace
    if (name === 'get_connection') return connection
    if (name === 'get_access_settings') return access
    if (name === 'execute_command') return { actionId: args!.command.actionId, entityId: 'updated', revision: 21 }
    throw new Error(`Unexpected native command: ${name}`)
  })
})

describe('native settings projection', () => {
  it.each([['openrouter', 'cloud'], ['hosted', 'hosted'], ['custom', 'custom']] as const)('maps %s from three read-only snapshots with no credentials', async (route, projected) => {
    connection.route = route
    const settings = await getSettings()
    expect(backend.invoke.mock.calls.map(([name]) => name).sort()).toEqual(['get_access_settings', 'get_connection', 'get_snapshot'])
    expect(settings).toMatchObject({
      scope: { sessionId: 'session', conversationId: 'a', settingsRevision: 6, learnerRevision: 9 },
      provider_mode: projected, hosted_email: 'person@example.invalid', openrouter_model: 'configured-model',
      custom_base_url: 'https://example.invalid/v1', custom_model: 'custom-model',
      target_language: 'es', target_dialect: 'es-MX', native_language: 'en',
      auto_translate: true, always_pronunciation: false, always_romanize: true, text_size: 125, text_spacing: 3,
    })
    for (const field of ['hosted_token', 'install_id', 'openrouter_key', 'groq_key', 'custom_api_key'] as const) expect(settings[field]).toBe('')
    expect(commands()).toEqual([])
  })

  it('skips archived conversations and fails when none remain', async () => {
    workspace.conversations[0].archived = true
    expect((await getSettings()).scope?.conversationId).toBe('b')
    workspace.conversations[1].archived = true
    await expect(getSettings()).rejects.toThrow('No active conversation')
    expect(commands()).toEqual([])
  })

  it.each(['get_snapshot', 'get_connection', 'get_access_settings'])('propagates %s failure without returning invented settings', async command => {
    const normal = backend.invoke.getMockImplementation()!
    backend.invoke.mockImplementation((name, args) => name === command ? Promise.reject(new Error('Native read failed')) : normal(name, args))
    await expect(getSettings()).rejects.toThrow('Native read failed')
    expect(commands()).toEqual([])
  })
})

describe('scoped native settings writes', () => {
  it('projects voice defaults and saves explicit opt-out on the captured conversation', async () => {
    const settings = await getSettings()
    expect(settings).toMatchObject({ auto_send: true, auto_speak: true, tts_engine: 'cloud', tts_voice: 'alloy' })
    await saveSettings({ ...settings, auto_send: false, auto_speak: false })
    expect(commands()).toHaveLength(1)
    expect(commands()[0].action).toMatchObject({ kind: 'updateSettings', conversationId: 'a', settings: { autoSend: false, readAloud: false, speechVoice: 'alloy' } })
  })

  it('sends only updateSettings to the originally captured conversation after recency changes', async () => {
    const settings = await getSettings()
    workspace.conversations[1].lastUsed = 100
    await saveSettings({ ...settings, auto_translate: false })
    expect(commands()).toEqual([{ sessionId: 'session', actionId: expect.any(String), action: {
      kind: 'updateSettings', conversationId: 'a', expectedRevision: 6,
      settings: { ...workspace.conversations[0].settings, translation: false },
    } }])
  })

  it('sends only updateLearner for display edits and preserves unrelated native preferences', async () => {
    const settings = await getSettings()
    await saveSettings({ ...settings, text_size: 150, text_spacing: 4 })
    expect(commands()).toHaveLength(1)
    expect(commands()[0].action).toEqual({ kind: 'updateLearner', expectedRevision: 9, name: 'Learner', preferences: { ...workspace.learner.preferences, textSize: 150, textSpacing: 4 } })
  })

  it('makes no write when projected values are unchanged', async () => {
    const settings = await getSettings()
    await saveSettings(settings)
    expect(commands()).toEqual([])
  })

  it('rejects combined practice/display edits before either command is written', async () => {
    const settings = await getSettings()
    await expect(saveSettings({ ...settings, auto_translate: false, text_size: 140 })).rejects.toThrow('separately')
    expect(commands()).toEqual([])
  })

  it('opens the existing target language without rewriting the old conversation', async () => {
    const settings = await getSettings()
    await saveSettings({ ...settings, target_language: 'fr' })
    expect(commands().map(c => c.action)).toEqual([{ kind: 'openConversation', conversationId: 'b' }])
  })

  it.each(['session', 'practice', 'learner'] as const)('rejects stale %s scope with zero command submissions', async changed => {
    const settings = await getSettings()
    if (changed === 'session') workspace.sessionId = 'replacement-session'
    if (changed === 'practice') workspace.conversations[0].settingsRevision++
    if (changed === 'learner') workspace.learner.revision++
    await expect(saveSettings({ ...settings, auto_translate: false })).rejects.toThrow(/changed/i)
    expect(commands()).toEqual([])
  })

  it('rejects a deleted captured conversation with zero writes', async () => {
    const settings = await getSettings()
    workspace.conversations = workspace.conversations.filter(c => c.id !== 'a')
    await expect(saveSettings({ ...settings, auto_translate: false })).rejects.toThrow('unavailable')
    expect(commands()).toEqual([])
  })

  it.each(['hosted_token', 'openrouter_key', 'groq_key', 'custom_api_key'] as const)('rejects %s on the preference save path', async field => {
    const settings = await getSettings()
    await expect(saveSettings({ ...settings, [field]: 'synthetic-secret-sentinel', auto_translate: false })).rejects.toThrow('Credentials must use')
    expect(commands()).toEqual([])
    expect(JSON.stringify(backend.invoke.mock.calls)).not.toContain('synthetic-secret-sentinel')
  })

  it('propagates a native revision conflict without retry or a second command', async () => {
    const settings = await getSettings()
    const normal = backend.invoke.getMockImplementation()!
    backend.invoke.mockImplementation((name, args) => name === 'execute_command' ? Promise.reject({ code: 'conflict', message: 'Revision changed' }) : normal(name, args))
    await expect(saveSettings({ ...settings, auto_translate: false })).rejects.toEqual({ code: 'conflict', message: 'Revision changed' })
    expect(commands()).toHaveLength(1)
    expect(commands()[0].action.kind).toBe('updateSettings')
  })
})

describe('independent audio validation', () => {
  it('accepts zero and independent valid channel volumes', () => {
    expect(() => validateAudioVolumes({ master_volume: 0, voice_volume: 45, effects_volume: 90 })).not.toThrow()
    expect(backend.invoke).not.toHaveBeenCalled()
  })

  it.each([undefined, null, NaN, -1, 101, 25.5])('rejects invalid volume %s before saving to native storage', async volume => {
    const settings = await getSettings()
    backend.invoke.mockClear()
    // Keep valid scope: failure must come from audio validation, not a missing scope.
    await expect(saveSettings({ ...settings, master_volume: volume } as Settings)).rejects.toThrow(/master_volume/)
    expect(backend.invoke).not.toHaveBeenCalled()
  })
})
