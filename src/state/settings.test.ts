// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { useSettingsStore } from './settings'
import { reportFault } from '../platform/diagnostics/faults'
import { SHORTCUT_DEFAULTS } from '../domain/input/keyboard'
import type { Settings } from '../types'

const native = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }))
vi.mock('../platform/ipc/tauri', () => ({ getSettings: native.get, saveSettings: native.save, languageFor: () => null }))
vi.mock('../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))

/// The record Rust owns. Only the fields a test reads are meaningful; a write
/// sends the whole thing back, which is what the assertions compare.
const record = (over: Partial<Settings> = {}): Settings => ({
  provider_mode: 'custom', hosted_token: '', hosted_email: '', install_id: '', openrouter_key: '',
  custom_base_url: '', custom_api_key: '', custom_model: '', groq_key: '', openrouter_model: '', observer_model: null,
  target_language: 'es', target_dialect: '', native_language: 'en', microphone_device_id: null,
  auto_speak: false, auto_send: false, always_romanize: false, auto_translate: false,
  text_size: 100, text_spacing: 100, always_pronunciation: false, fast_mode: true,
  reward_sounds: 'follow_tts', master_volume: 1, voice_volume: 1, effects_volume: 1,
  tts_rate: 1, shortcuts: SHORTCUT_DEFAULTS,
  ...over,
})

beforeEach(() => {
  native.get.mockReset()
  native.save.mockReset()
  native.save.mockResolvedValue(undefined)
  vi.mocked(reportFault).mockClear()
})

it('reads the record without counting a read as a change', async () => {
  native.get.mockResolvedValue(record())
  await useSettingsStore.getState().load()
  expect(useSettingsStore.getState().settings?.target_language).toBe('es')
  // The revision means "a write has landed": a read must not look like one, or
  // every mount would clear the shell's "you changed something" effects.
  expect(useSettingsStore.getState().revision).toBe(0)
})

it('counts a read of something another surface wrote as a change', async () => {
  native.get.mockResolvedValue(record())
  await useSettingsStore.getState().refresh()
  expect(useSettingsStore.getState().revision).toBe(1)
})

it('writes a preference against a fresh read and adopts what Rust reports', async () => {
  const current = record()
  const saved = record({ auto_speak: true })
  native.get.mockResolvedValueOnce(current).mockResolvedValue(saved)
  await useSettingsStore.getState().setPreference('auto_speak')
  // The read is the baseline, so a cached copy cannot overwrite another writer.
  expect(native.save).toHaveBeenCalledWith({ ...current, auto_speak: true }, current)
  expect(useSettingsStore.getState().settings).toEqual(saved)
  expect(useSettingsStore.getState().revision).toBe(1)
  expect(useSettingsStore.getState().savingPreference).toBe(false)
})

it('clears the dialect when the target language changes', async () => {
  const current = record({ target_dialect: 'es-419' })
  native.get.mockResolvedValue(current)
  await useSettingsStore.getState().setLanguage('target_language', 'fr')
  expect(native.save).toHaveBeenCalledWith({ ...current, target_language: 'fr', target_dialect: '' }, current)
})

it('keeps the dialect when the native language changes', async () => {
  const current = record({ target_dialect: 'es-419' })
  native.get.mockResolvedValue(current)
  await useSettingsStore.getState().setLanguage('native_language', 'de')
  expect(native.save).toHaveBeenCalledWith({ ...current, native_language: 'de' }, current)
})

it('runs one language write at a time', async () => {
  let release: (value: Settings) => void = () => { throw new Error('No request') }
  native.get.mockImplementationOnce(() => new Promise<Settings>(done => { release = done })).mockResolvedValue(record())
  const first = useSettingsStore.getState().setLanguage('native_language', 'fr')
  expect(useSettingsStore.getState().savingLanguage).toBe(true)
  await useSettingsStore.getState().setLanguage('native_language', 'de')
  expect(native.save).not.toHaveBeenCalled()
  release(record())
  await first
  expect(native.save).toHaveBeenCalledTimes(1)
  expect(useSettingsStore.getState().savingLanguage).toBe(false)
})

it('reports a failed write and leaves the record it had', async () => {
  native.get.mockResolvedValue(record())
  native.save.mockRejectedValue(new Error('locked'))
  await useSettingsStore.getState().setPreference('fast_mode')
  expect(reportFault).toHaveBeenCalledWith('Saving reading preference', expect.any(Error))
  expect(useSettingsStore.getState().revision).toBe(0)
  expect(useSettingsStore.getState().savingPreference).toBe(false)
})

it('writes a text size only when the action changes it', async () => {
  native.get.mockResolvedValue(record({ text_size: 150 }))
  useSettingsStore.getState().changeTextSize('increase')
  await vi.waitFor(() => expect(native.get).toHaveBeenCalled())
  // Already at the limit: there is nothing to write.
  expect(native.save).not.toHaveBeenCalled()
  native.get.mockResolvedValue(record({ text_size: 100 }))
  useSettingsStore.getState().changeTextSize('decrease')
  await vi.waitFor(() => expect(native.save).toHaveBeenCalledTimes(1))
  expect(native.save.mock.calls[0][0].text_size).toBe(95)
})

it('keeps the newest read and UI language when an older read completes last', async () => {
  let finish!: (value: Settings) => void
  native.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(record({ native_language: 'fr', target_language: 'fr' }))
  const old = useSettingsStore.getState().load()
  await useSettingsStore.getState().load()
  finish(record({ native_language: 'es' }))
  await old
  expect(useSettingsStore.getState().settings?.target_language).toBe('fr')
  expect(document.documentElement.lang).toBe('fr')
})

it('a post-save read cannot overwrite a later conversation read', async () => {
  let finish!: (value: Settings) => void
  native.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(record({ target_language: 'fr' }))
  const save = useSettingsStore.getState().save(record(), record())
  await vi.waitFor(() => expect(native.get).toHaveBeenCalledTimes(1))
  await useSettingsStore.getState().load()
  finish(record())
  await save
  expect(useSettingsStore.getState().settings?.target_language).toBe('fr')
  expect(useSettingsStore.getState().revision).toBe(1)
  native.get.mockResolvedValue(record({ target_language: 'fr' }))
  await useSettingsStore.getState().load()
  expect(useSettingsStore.getState().revision).toBe(1)
})

it('a store reset invalidates pending reads', async () => {
  let finish!: (value: Settings) => void
  native.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const old = useSettingsStore.getState().load()
  useSettingsStore.setState(useSettingsStore.getInitialState(), true)
  finish(record())
  await old
  expect(useSettingsStore.getState().settings).toBeNull()
})
