// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { DrillPage } from './DrillPage'
import { useAiTrayStore } from '../../state/navigation/ai-tray'
import { ReadingLookupContext } from '../../components/reading/ReadingContext'
import type { DrillAttemptView, DrillItemView, ListeningStatus, TranscriptionInspectionResult } from '../../generated/contracts'

/** Opens every message's ⋯ menu, where Words, Analysis and Pronunciation live. */
const openMenus = () => screen.queryAllByRole('button', { name: 'More actions' }).forEach(button => { if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button) })


const invoke = vi.hoisted(() => vi.fn())
const speak = vi.hoisted(() => vi.fn())
const play = vi.hoisted(() => vi.fn())
const updateSettings = vi.hoisted(() => vi.fn())
const microphones = vi.hoisted(() => vi.fn().mockResolvedValue({ source: 'native', devices: [] }))
vi.mock('../../platform/audio/microphones', () => ({ listMicrophones: microphones }))
const setPreference = vi.hoisted(() => vi.fn())
const script = vi.hoisted(() => ({ direction: 'ltr' as 'ltr' | 'rtl' }))
vi.mock('../../platform/audio/scrub-player', () => ({ createScrubPlayer: () => ({ start: vi.fn(), move: vi.fn(), end: vi.fn(), dispose: vi.fn(), setVolume: vi.fn() }) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('../../platform/audio/reading-speech', async () => ({ ...await vi.importActual('../../platform/audio/reading-speech'), speakSelection: speak }))
vi.mock('../../platform/audio/speech-player', () => ({ playSpeechAudio: play }))
vi.mock('../../platform/audio/speech', async () => {
  const actual = await vi.importActual<typeof import('../../platform/audio/speech')>('../../platform/audio/speech')
  return actual
})
vi.mock('../../platform/ipc/tauri', async () => ({
  languageFor: () => ({ code: 'spanish', languageTag: 'es', direction: script.direction, romanization: null, greeting: { text: '¡Hola!', romanized: null } }),
  languages: () => [],
  isTauri: true,
}))
vi.mock('../../state/settings/settings', () => ({
  useSettingsStore: Object.assign((select: (state: unknown) => unknown) => select({
    setPreference, savingPreference: false,
    settings: { target_language: 'spanish', target_variety: 'spanish-spain', native_language: 'english', native_variety: 'english-us', tts_rate: 0.85, master_volume: 30, voice_volume: 50 },
  }), { getState: () => ({ update: updateSettings }) }),
}))

const inspection = {
  recordingId: 'recording-1', owner: { kind: 'drillItem', id: 'item-1' }, duration: 1, sampleRate: 16000,
  waveform: { binSeconds: 0.5, min: [-0.2], max: [0.2] },
  spectrogram: {
    frameSeconds: 0.5, frameStartSeconds: [0], windowSeconds: 0.5, fftSize: 512,
    bands: [{ lowHz: 50, centerHz: 100, highHz: 200 }], minFrequencyHz: 50, maxFrequencyHz: 8000,
    measuredMaxFrequencyHz: 8000, melScale: 'htk', normalization: 'unit-peak triangular filters',
    dbReference: '0 dB = full-scale power (1.0)', dbMin: -100, dbMax: 0, bins: [[-40]],
  },
  activity: { algorithm: 'fixture', noiseFloorDbfs: -60, thresholdDbfs: -40, regions: [], pauses: [], limitations: [] },
  wordTiming: { status: 'unavailable', reason: null, words: [], unsupported: [] },
}
const attempt = (overrides: Partial<DrillAttemptView> = {}): DrillAttemptView => ({
  id: 'attempt-1', sequence: 1n, transcript: 'quisiera un cafe', audioBytes: 12n, audioPrunedAt: null,
  transcriptionAttemptId: 'recording-1', countedAsPractice: false, createdAt: '2026-09-22T12:00:00.000Z',
  comparison: {
    policy: 'drill-comparison-v1', target: 'Quisiera un café.', transcript: 'quisiera un cafe',
    normalizations: ['lowercase', 'strip_punctuation'], normalizedTarget: 'quisiera un café',
    normalizedTranscript: 'quisiera un cafe', edits: 1n, referenceGraphemes: 16n,
    characterErrorRate: 0.0625, matchRatio: 0.9375, scriptNote: 'matches',
    words: [
      { kind: 'same', target: 'quisiera', transcript: 'quisiera', similarity: null },
      { kind: 'same', target: 'un', transcript: 'un', similarity: null },
      { kind: 'substituted', target: 'café', transcript: 'cafe', similarity: 0.75 },
    ],
  },
  ...overrides,
} as DrillAttemptView)
const item = (overrides: Partial<DrillItemView> = {}): DrillItemView => {
  // Native counts these across all history; the fixture derives them the same way.
  const attempts = overrides.attempts ?? []
  const ratios = attempts.map(entry => entry.comparison.matchRatio).filter(ratio => ratio !== null)
  return {
    id: 'item-1', source: { kind: 'own' }, text: 'Quisiera un café.', language: 'spanish', variety: 'spanish-spain',
    explanation: 'english', explanationVariety: 'english-us', createdAt: '2026-09-22T11:00:00.000Z',
    attemptCount: attempts.length, bestMatchRatio: ratios.length ? Math.max(...ratios) : null,
    lastAttemptAt: attempts[0]?.createdAt ?? null, attempts: [], ...overrides,
  } as DrillItemView
}
const second = () => item({ id: 'item-2', text: 'Hasta luego.', attempts: [] })

let items: DrillItemView[] = []
let transcription: TranscriptionInspectionResult
let runStatus: ListeningStatus
let manualActive = false
beforeEach(() => {
  microphones.mockResolvedValue({ source: 'native', devices: [] })
  localStorage.clear()
  invoke.mockReset(); speak.mockReset(); play.mockReset()
  items = []
  manualActive = false
  runStatus = { recordingId: 'recording-1', listening: true, speaking: false, queued: 0, processing: false, completed: 0, failure: null, takes: [],
    settings: { pauseMs: 1000, thresholdDb: -45, minTakeMs: 300, silenceTimeoutMs: 10000 }, levelDb: -35, noiseFloorDb: -55, thresholdDb: -45, ignoredTakes: 0 }
  script.direction = 'ltr'
  transcription = { text: 'quisiera un cafe', audioBase64: 'YXVkaW8=', diagnostics: null, inspection } as unknown as TranscriptionInspectionResult
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    switch (command) {
      case 'get_drill_items': return items
      case 'get_last_drill_item': return null
      case 'get_practice_sets': return [
        { set: 'absolute_zero', count: 8, sample: 'Sí.' },
        { set: 'beginner', count: 8, sample: 'Ana es médica.' },
        { set: 'intermediate', count: 8, sample: 'Ayer fui al mercado.' },
        { set: 'advanced', count: 8, sample: 'Aunque parece fácil, hay que pensarlo bien.' },
        { set: 'social', count: 15, sample: '¡Hola!' },
        { set: 'idiomatic', count: 8, sample: 'No tires la toalla.' },
      ]
      case 'get_cached_reading_audio': return null
      case 'create_drill_item': {
        const created = item({ id: 'item-1', text: (args.input as { text: string }).text.trim() })
        items = [created, ...items]
        return created
      }
      case 'delete_drill_item': items = items.filter(entry => entry.id !== args.itemId); return
      case 'start_drill_session': return 'session-1'
      case 'enter_drill_visit': return `visit-${args.itemId}`
      case 'leave_drill_visit': return
      case 'end_drill_session': return
      case 'mic_listen_start': manualActive = args.captureMode === 'manual'; runStatus.listening = true; return { recordingId: 'recording-1', samplesPerSecond: 689 }
      case 'mic_wave': return []
      case 'mic_listen_status': return { ...runStatus, takes: [...runStatus.takes] }
      case 'mic_listen_spectrogram': return { data: inspection.spectrogram, endSeconds: 1 }
      case 'mic_listen_discard': manualActive = false; return
      case 'mic_listen_tune': {
        if (args.captureMode === 'manual') manualActive = true
        else if (args.captureMode === 'monitor' && manualActive) {
          manualActive = false
          runStatus.takes.push({ recordingId: 'recording-1', number: 1, startSeconds: 0, endSeconds: 1, cutSeconds: 1, state: 'completed', failure: null })
          items = items.map(entry => entry.id === transcription.inspection.owner.id ? { ...entry, attempts: [attempt()] } : entry)
          runStatus.completed++
        }
        return
      }
      case 'mic_listen_stop':
        runStatus.listening = false
        if (manualActive && !runStatus.processing) {
          manualActive = false
          items = items.map(entry => entry.id === transcription.inspection.owner.id ? { ...entry, attempts: [attempt()] } : entry)
          runStatus.completed++
        }
        return
      case 'mic_cancel': manualActive = false; runStatus.listening = false; return
      case 'drill_attempts': {
        const held = items.find(entry => entry.id === args.itemId)?.attempts ?? []
        // One page per ten, so paging itself is exercised by the fixtures.
        const from = args.cursor === null ? 0 : Number(args.cursor)
        const page = held.slice(from, from + 10)
        return { attempts: page, nextCursor: from + 10 < held.length ? String(from + 10) : null }
      }
      case 'get_drill_attempt_audio': return 'YXVkaW8='
      case 'inspect_drill_audio': return inspection
      case 'delete_drill_attempt':
        items = items.map(entry => ({ ...entry, attempts: entry.attempts.filter(take => take.id !== args.attemptId) }))
        return
      case 'clear_drill_attempts':
        items = items.map(entry => entry.id === args.itemId ? { ...entry, attempts: [] } : entry)
        return 0
      case 'record_frontend_diagnostic': return
      default: throw new Error(`Unexpected native command: ${command}`)
    }
  })
  speak.mockImplementation(async (...args) => { const result = { audioBase64: 'cmVmZXJlbmNl', audioAlignment: null, receipt: null }; await args[5]?.onAudio?.(result); return result })
  play.mockReturnValue({ play: () => Promise.resolve(), stop: vi.fn() })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

type Lookup = NonNullable<React.ContextType<typeof ReadingLookupContext>>
const app = (lookup?: Lookup) => render(
  <I18nProvider locale="english">
    <ReadingLookupContext value={lookup ?? vi.fn().mockResolvedValue({ explanations: { cards: [] } })}>
      <DrillPage active />
    </ReadingLookupContext>
  </I18nProvider>)

/** The attempt list of the card on screen. The list is on the page before any
 * card is, empty, and is replaced when a card arrives, so wait for the card. */
/// A take's own status line. The AI pill reports the same step in its own
/// words, and can hold it a moment after the work ends, so it does not count.
const takeStatus = (text: string) => screen.queryAllByRole('status').find(element => element.textContent === text) ?? null

async function attemptLog() {
  await screen.findByText(/^Card \d+ of \d+$/)
  return within(screen.getByRole('complementary', { name: 'Attempts' }))
}

async function openPhrases() {
  // At full width the cards panel starts folded to its edge tab beside the stage.
  if (!screen.queryByRole('complementary', { name: 'Your practice cards' })) fireEvent.click(await screen.findByRole('button', { name: 'Practice cards' }))
  await screen.findByRole('complementary', { name: 'Your practice cards' })
}

it('lets every stacked pane be dragged: reference, attempt, attempt list and recording panel', async () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  items = [item({ attempts: [attempt({ id: 'attempt-3', sequence: 3n }), attempt({ id: 'attempt-2', sequence: 2n }), attempt()] })]
  const view = app()
  const reference = await screen.findByRole('separator', { name: 'Resize the reference' })
  const take = screen.getByRole('separator', { name: 'Resize the attempt' })
  const dock = screen.getByRole('separator', { name: 'Resize the recording panel' })
  const panel = reference.closest<HTMLElement>('.drill-comparison-panel')!
  fireEvent.keyDown(reference, { key: 'ArrowDown' })
  expect(panel.style.getPropertyValue('--drill-reference-row')).toBe('96px')
  fireEvent.keyDown(take, { key: 'End' })
  expect(panel.style.getPropertyValue('--drill-attempt-row')).toBe('800px')
  fireEvent.keyDown(dock, { key: 'Home' })
  expect(dock.closest<HTMLElement>('.drill-page')!.style.getPropertyValue('--drill-dock-height')).toBe('150px')
  expect(localStorage.getItem('skellyspeak_pane_drill-reference')).toBe('96')
  // The attempt list fills the space between the plots and the recording panel,
  // so it holds every take and scrolls rather than stopping at two.
  const history = document.querySelector<HTMLElement>('.drill-history-preview')!
  for (const name of ['Attempt 1', 'Attempt 2', 'Attempt 3']) expect(await within(history).findByRole('button', { name })).toBeInTheDocument()
  view.unmount()
  media.mockRestore()
})

it('gives the AI tray its place above the recording panel, right above the AI pill and clear of its grip', async () => {
  items = [item()]
  const view = app()
  await screen.findByRole('separator', { name: 'Resize the recording panel' })
  const slot = useAiTrayStore.getState().slot!
  expect(slot).not.toBeNull()
  expect(slot.nextElementSibling).toHaveClass('drill-ai-status')
  // The recording panel's grip stays on the panel itself, below the pill, as in Chat,
  // so an open tray never sits between the grip and what it resizes.
  const grip = screen.getByRole('separator', { name: 'Resize the recording panel' })
  expect(grip.previousElementSibling).toHaveClass('drill-ai-status')
  expect(grip.nextElementSibling).toHaveClass('drill-dock-pane')
  view.unmount()
  expect(useAiTrayStore.getState().slot).toBeNull()
})

it('draws a cached reference on entry without playback or generation', async () => {
  items = [item()]
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation((command, args) => command === 'get_cached_reading_audio'
    ? Promise.resolve({ audioBase64: 'cmVmZXJlbmNl', alignment: null }) : native(command, args))
  app()
  await waitFor(() => expect(screen.getByRole('slider', { name: 'Seek reference audio' })).toBeEnabled())
  expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl', speechAlignment: null })
  expect(speak).not.toHaveBeenCalled()
  expect(play).not.toHaveBeenCalled()
  expect(invoke.mock.calls.some(([command]) => command === 'begin_reading')).toBe(false)
})

it('ignores a late cached reference after selecting another phrase', async () => {
  items = [item(), second()]
  const native = invoke.getMockImplementation()!
  let release!: (audio: { audioBase64: string; alignment: null }) => void
  invoke.mockImplementation((command, args) => command === 'get_cached_reading_audio'
    ? (args.input.referenceItem === 'item-1' ? new Promise(resolve => { release = resolve }) : Promise.resolve(null))
    : native(command, args))
  app()
  await screen.findByRole('button', { name: 'Play' })
  await openPhrases()
  fireEvent.click(screen.getAllByRole('button').find(node => node.textContent?.startsWith('Hasta luego.'))!)
  await act(async () => release({ audioBase64: 'cmVmZXJlbmNl', alignment: null }))
  expect(invoke.mock.calls.some(([command]) => command === 'inspect_drill_audio')).toBe(false)
  expect(screen.getByRole('slider', { name: 'Seek reference audio' })).toBeDisabled()
  expect(speak).not.toHaveBeenCalled()
})

it('records an attempt against an existing phrase and scores what was said', async () => {
  items = [item()]
  app()
  await screen.findByRole('button', { name: 'Play' })
  await openPhrases()
  // The phrase is listed, and shown through the shared target card.
  await screen.findByRole('button', { name: 'Delete “Quisiera un café.” and its attempts' })
  expect(screen.getByRole('button', { name: 'Play' })).toBeVisible()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_start', expect.objectContaining({ owner: { kind: 'drillItem', id: 'item-1' }, captureMode: 'manual' })))
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
  // Native completion publishes the attempt; the UI only reloads it.
  expect(invoke.mock.calls.some(([command]) => command === 'save_drill_attempt')).toBe(false)
  // The newest attempt takes the report in full rather than a line in the log.
  const report = await within(await screen.findByRole('complementary', { name: 'Attempts' }, { timeout: 5000 }))
    .findByRole('region', { name: 'Attempt 1' }, { timeout: 5000 })
  expect(within(report).getAllByText('94%').length).toBeGreaterThan(0)
})

it('shows the measured comparison, the words that differed, and replays the attempt', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  // The newest attempt fills the panel without being asked for.
  await screen.findByRole('button', { name: 'Play yours' })
  // The measurement itself, and how it normalized, stay available under the summary.
  fireEvent.click(await screen.findByText('Comparison details'))
  expect(screen.getByText('Characters matching the card, after lowercase, strip_punctuation')).toBeVisible()
  expect(screen.getByText('0.06')).toBeVisible()
  expect(screen.getByText('1 of 16 characters')).toBeVisible()
  expect(screen.getByText('lowercase, strip_punctuation')).toBeVisible()
  const words = within(screen.getByRole('group', { name: 'Words' }))
  // The target and what was heard sit together, with the outcome named in words.
  expect(words.getByText('cafe')).toBeVisible()
  expect(words.getByText('café')).toBeVisible()
  expect(words.getByText('Uncertain')).toBeVisible()
  expect(words.getAllByText('Matched')).toHaveLength(2)

  await waitFor(() => expect(invoke).toHaveBeenCalledWith('get_drill_attempt_audio', { attemptId: 'attempt-1' }), { timeout: 5000 })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled(), { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  expect(play).toHaveBeenCalledOnce()
  expect(play).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.any(Function), 0.85, 0.15, expect.objectContaining({ onTime: expect.any(Function) }))
  act(() => play.mock.calls[0][5].onTime(0.4, 1))
  expect(document.querySelector('.drill-comparison-panel .drill-track .audio-spectrum-cursor')).toHaveStyle({ left: '40%' })
  // With no reference played yet, the panel says so instead of comparing one.
  expect(screen.getByText('Play the reference to compare it with this attempt.')).toBeVisible()
})

it('pairs the reference with the attempt once the reference has been heard', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  await screen.findByRole('button', { name: 'Play yours' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play' })) })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl', speechAlignment: null }), { timeout: 5000 })
  expect(speak).toHaveBeenCalledWith(
    expect.objectContaining({ text: 'Quisiera un café.', aid: 'speech', language: 'spanish', referenceItem: 'item-1' }),
    expect.any(AbortSignal), expect.any(Function), expect.any(Number), expect.any(Number), expect.objectContaining({ onAudio: expect.any(Function), onTime: expect.any(Function) }))
  // Both recordings are captioned with their own measured length.
  expect(await screen.findByRole('slider', { name: 'Seek reference audio' })).toBeEnabled()
  expect(screen.getByRole('slider', { name: 'Seek attempt audio' })).toBeEnabled()
  // Every replay asks native to validate/cache the source, even when the
  // inspection is already visible. Native cache hits do not call the provider.
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play' })) })
  expect(speak).toHaveBeenCalledTimes(2)
})

it('says when an attempt has no audio left to replay', async () => {
  items = [item({ attempts: [attempt({ audioBytes: 40n, audioPrunedAt: '2026-09-22T13:00:00.000Z' })] })]
  app()
  expect(await screen.findByText('Removed')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Play yours' })).toBeDisabled()
  expect(screen.getByText('Freed by the storage limit. The transcript and comparison remain.')).toBeVisible()
  expect(invoke).not.toHaveBeenCalledWith('get_drill_attempt_audio', expect.anything())
})

it('keeps attempts across a visit and removes everything with the phrase', async () => {
  items = [item({ attempts: [attempt()] })]
  const view = app()
  // Leaving and coming back re-reads the stored items.
  await openPhrases()
  expect(await screen.findByText('1 attempts · best 94%')).toBeVisible()
  view.rerender(<I18nProvider locale="english"><DrillPage active={false} /></I18nProvider>)
  view.rerender(<I18nProvider locale="english"><DrillPage active /></I18nProvider>)
  expect(await (await attemptLog()).findByRole('region', { name: 'Attempt 1' })).toBeVisible()
  expect(invoke.mock.calls.filter(([command]) => command === 'get_drill_items').length).toBeGreaterThan(1)
  await openPhrases()

  fireEvent.click(screen.getByRole('button', { name: 'Delete “Quisiera un café.” and its attempts' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('delete_drill_item', { itemId: 'item-1' }))
  expect(await screen.findByText('No practice cards yet')).toBeVisible()
  // The starter is offered on entering with no cards, not when the last one is deleted.
  expect(screen.queryByRole('dialog', { name: 'Add practice cards to get started' })).toBeNull()
})

it('refuses playback while the microphone is recording, and lets it go again after', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  await screen.findByRole('button', { name: 'Start recording' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stop recording' })).toBeVisible())
  // The speakers would be recorded: neither the reference nor a replay runs.
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  const { interruptSpeech, microphoneHeld } = await import('../../platform/audio/speech')
  expect(microphoneHeld()).toBe(true)
  expect(interruptSpeech()).toBeNull()
  await openPhrases()
  // Switching phrase or deleting one is refused mid-recording too.
  expect(screen.getByRole('button', { name: 'Delete “Quisiera un café.” and its attempts' })).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
  await waitFor(() => expect(microphoneHeld()).toBe(false))
  expect(interruptSpeech()).not.toBeNull()
})

it('retries retained audio after a storage failure without creating another attempt', async () => {
  items = [item({ attempts: [attempt()] })]
  const original = invoke.getMockImplementation()!
  let reads = 0
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    if (command === 'get_drill_attempt_audio' && ++reads === 1) throw new Error('Disk is full')
    return original(command, args)
  })
  app()
  expect(await screen.findByRole('alert')).toHaveTextContent('Disk is full')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled())
  expect(reads).toBe(2)
  expect(items[0].attempts).toHaveLength(1)
})

it('never attaches one phrase’s reference to another', async () => {
  items = [item(), second()]
  let release!: (value: unknown) => void
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation((command, args) => command === 'inspect_drill_audio'
    ? new Promise(resolve => { release = resolve }) : native(command, args))
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl', speechAlignment: null }))
  // The learner moves on while the reference inspection is still being prepared.
  await openPhrases()
  fireEvent.click(screen.getAllByRole('button').find(node => node.textContent?.startsWith('Hasta luego.'))!)
  expect((speak.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
  await act(async () => { release(inspection) })
  expect(invoke).not.toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-2', audioBase64: 'cmVmZXJlbmNl' })
  // The seek control keeps its place but has nothing to seek: no reference is drawn.
  expect(screen.getByRole('slider', { name: 'Seek reference audio' })).toBeDisabled()
  expect(screen.getByText('Play the reference once to draw it here.')).toBeVisible()
})

it('asks about the phrase in its own stored language, and only once', async () => {
  // The item was written in Spanish; today's settings say Spanish too, but the
  // aid must use what the item stored, not what the settings happen to read.
  items = [item({ variety: 'spanish-mexico', explanationVariety: 'english-gb' })]
  const lookup = vi.fn(async () => ({ explanations: { cards: [] } }) as never) as unknown as Lookup & ReturnType<typeof vi.fn>
  app(lookup)
  await screen.findByRole('button', { name: 'Analysis' })
  openMenus()
  fireEvent.click(await screen.findByRole('button', { name: 'Analysis' }))
  await waitFor(() => expect(lookup).toHaveBeenCalledWith(
    expect.objectContaining({ text: 'Quisiera un café.', aid: 'explanations', variety: 'spanish-mexico', explanationVariety: 'english-gb' }),
    expect.any(AbortSignal)))
  expect(await screen.findByText('Nothing to flag in this reply.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close Message analysis' }))
  openMenus()
  fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
  expect(lookup).toHaveBeenCalledOnce()
})


it('cancels pending reference speech on leaving, and never inspects its late result', async () => {
  items = [item()]
  let finish!: (value: { audioBase64: string }) => void
  speak.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = app()
  fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
  const signal = speak.mock.calls[0][1] as AbortSignal
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish({ audioBase64: 'late' }) })
  expect(invoke.mock.calls.some(([command]) => command === 'inspect_drill_audio')).toBe(false)
})

it('stops retained attempt playback when another attempt takes the panel', async () => {
  const older = attempt({ id: 'attempt-0', sequence: 1n })
  items = [item({ attempts: [attempt({ id: 'attempt-2', sequence: 2n }), older] })]
  const stop = vi.fn()
  play.mockReturnValue({ play: () => Promise.resolve(), stop })
  app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  fireEvent.click(screen.getByRole('button', { name: 'Attempt 1' }))
  expect(stop).toHaveBeenCalledOnce()
})

it('names what the microphone is doing, and offers Discard only while recording', async () => {
  items = [item()]
  // The visit has to open before the microphone can belong to this phrase, so
  // hold it open and check that recording is refused until it does.
  let openVisit = (_id: string) => {}
  const visit = new Promise<string>(resolve => { openVisit = resolve })
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) =>
    command === 'enter_drill_visit' ? visit : native(command, args))
  app()
  expect(await screen.findByText('Preparing the session')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Start recording' })).toBeDisabled()
  await act(async () => { openVisit('visit-item-1') })
  expect(await screen.findByText('Ready to record')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Discard current take' })).toBeNull()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  expect(await screen.findByText('Recording an attempt')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Discard current take' })).toBeNull()
})

it('shows how many attempts a phrase has and the best measured match', async () => {
  items = [item({ attempts: [attempt()] }), second()]
  app()
  await openPhrases()
  expect(await screen.findByText('1 attempts · best 94%')).toBeVisible()
  expect(screen.getByText('No attempts yet')).toBeVisible()
})

it('counts attempts without a measurable match instead of inventing a score', async () => {
  const unmeasured = attempt({ comparison: { ...attempt().comparison, matchRatio: null, characterErrorRate: null } })
  items = [item({ attempts: [unmeasured] })]
  app()
  await openPhrases()
  expect(await screen.findByText('1 attempts')).toBeVisible()
})

it('keeps speech-region counts without obstructing words with segment badges', async () => {
  items = [item({ attempts: [attempt()] })]
  const native = invoke.getMockImplementation()!
  const split = { ...inspection, duration: 1, activity: { ...inspection.activity, regions: [{ start: 0, end: 0.4 }, { start: 0.6, end: 1 }] } }
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) =>
    command === 'inspect_drill_audio' ? split : native(command, args))
  app()
  expect(await screen.findByText(/2 speech segments/)).toBeInTheDocument()
  expect(screen.queryByText('segment 2')).toBeNull()
})

it('disables word alignment without a timing error when timestamps are absent', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled())
  expect(screen.getByRole('radio', { name: 'Align words' })).toBeDisabled()
  expect(screen.queryByText('Word timings unavailable.')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Timed words')).not.toBeInTheDocument()
  expect(screen.queryByText('segment 2')).not.toBeInTheDocument()
})

it('calls an attempt exact only when the comparison needed no edits', async () => {
  const perfect = attempt({ id: 'attempt-2', sequence: 2n, transcript: 'Quisiera un café.',
    comparison: { ...attempt().comparison, edits: 0, characterErrorRate: 0, matchRatio: 1 } })
  items = [item({ attempts: [perfect, attempt()] })]
  app()
  const log = await attemptLog()
  // The newest, exact attempt is the full report; the older one is a line in the log.
  expect(within(await log.findByRole('region', { name: 'Attempt 2' })).getByText('Exact')).toBeVisible()
  const older = await log.findByRole('button', { name: 'Attempt 1' })
  expect(within(older).queryByText('Exact')).not.toBeInTheDocument()
})

it('reads attempt history a page at a time and never the embedded array', async () => {
  const many = Array.from({ length: 15 }, (_, index) =>
    attempt({ id: `attempt-${index}`, sequence: BigInt(15 - index) }))
  // The embedded array is deliberately empty: the log must use the paged command.
  items = [item({ attempts: many, attemptCount: 15, bestMatchRatio: 0.9375 })]
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    if (command === 'get_drill_items') return items.map(entry => ({ ...entry, attempts: [] }))
    return native(command, args)
  })
  app()
  const log = await attemptLog()
  await waitFor(() => expect(log.getAllByRole('button').length).toBeGreaterThan(1))
  // Ten per page, less the newest, which is reported in full above the log.
  expect(log.getAllByRole('button', { name: /^Attempt \d+$/ })).toHaveLength(9)
  expect(invoke).toHaveBeenCalledWith('drill_attempts', { itemId: 'item-1', cursor: null, limit: 20 })
  fireEvent.click(log.getByRole('button', { name: 'Show older attempts' }))
  await waitFor(() => expect(log.getAllByRole('button', { name: /^Attempt \d+$/ })).toHaveLength(14))
  expect(log.queryByRole('button', { name: 'Show older attempts' })).not.toBeInTheDocument()
})

it('keeps a pruned recording distinct from one that was never kept', async () => {
  const pruned = attempt({ id: 'attempt-pruned', sequence: 2n, audioBytes: 40n, audioPrunedAt: '2026-09-22T13:00:00.000Z' })
  const never = attempt({ id: 'attempt-never', sequence: 1n, audioBytes: null, audioPrunedAt: null })
  items = [item({ attempts: [pruned, never] })]
  app()
  // Applying a zero limit to an existing recording removes it…
  expect(await screen.findByText('Removed', {}, { timeout: 5000 })).toBeVisible()
  const log = within(screen.getByRole('complementary', { name: 'Attempts' }))
  fireEvent.click(log.getByRole('button', { name: 'Attempt 1' }))
  // …while a recording made under that limit was never written at all.
  expect(await screen.findByText('Not kept')).toBeVisible()
  expect(screen.getByText('Storage is set to keep no recordings.')).toBeVisible()
})

it('says when the phrase list could not be read, and reads it again on request', async () => {
  const native = invoke.getMockImplementation()!
  let fail = true
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    if (command === 'get_drill_items' && fail) throw new Error('The workspace is locked.')
    return native(command, args)
  })
  app()
  // An empty page would otherwise read as "you have no phrases".
  expect(await screen.findByRole('alert')).toHaveTextContent('The workspace is locked.')
  expect(screen.queryByText('Nothing to practise yet')).not.toBeInTheDocument()
  fail = false
  items = [item()]
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findAllByText('Quisiera un café.')).not.toHaveLength(0)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('announces what the microphone is doing without the learner looking', async () => {
  items = [item()]
  app()
  const dock = await screen.findByRole('region', { name: 'Record an attempt' })
  const live = within(dock).getByRole('status')
  expect(live).toHaveAttribute('aria-live', 'polite')
  await waitFor(() => expect(live).toHaveTextContent('Ready to record'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(live).toHaveTextContent('Recording an attempt'))
})

it('wires repeated takes, native cuts and live spectra into the real Drill page', async () => {
  items = [item()]
  const native = invoke.getMockImplementation()!
  const take = { recordingId: 'take-1', number: 1, startSeconds: 0, endSeconds: 1, cutSeconds: 1.6, state: 'processing', failure: null }
  const status = { recordingId: 'listening-1', listening: true, speaking: false, queued: 0, processing: true, completed: 0, failure: null, takes: [take],
    settings: { pauseMs: 600, thresholdDb: -45, minTakeMs: 300, silenceTimeoutMs: 10000 }, levelDb: -35, noiseFloorDb: -55 as number | null, thresholdDb: -45, ignoredTakes: 2 }
  invoke.mockImplementation(async (command, args) => {
    if (command === 'mic_listen_start') return { recordingId: 'listening-1', samplesPerSecond: 689, browserCapture: false }
    if (command === 'mic_listen_status') return { ...status }
    if (command === 'mic_listen_spectrogram') return args.afterSeconds === null ? { data: inspection.spectrogram, endSeconds: 2 } : null
    if (command === 'mic_listen_discard') return
    if (command === 'mic_listen_tune') return
    if (command === 'mic_listen_stop') { status.listening = false; return }
    return native(command, args)
  })
  app()
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Auto' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
  await screen.findByRole('checkbox', { name: 'Detect attempts' })
  fireEvent.click(screen.getByLabelText('Recording settings'))
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'End an attempt after silence of' })).getByRole('radio', { name: '0.6 s' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_start', {
    captureMode: 'auto', owner: { kind: 'drillItem', id: 'item-1' }, settings: { pauseMs: 600, thresholdDb: -45, minTakeMs: 300, silenceTimeoutMs: 10000 },
  }))
  expect(await screen.findByText('Attempt 1 clipped →')).toBeVisible()
  await waitFor(() => expect(takeStatus('Transcribing…')).toBeVisible())
  const attemptPlot = () => document.querySelector('.drill-comparison-panel > .drill-timelines .inspection-spectrogram')
  await waitFor(() => expect(attemptPlot()).not.toBeNull())
  const pendingCanvas = attemptPlot()
  expect(screen.getByRole('button', { name: 'Play yours' })).toBeDisabled()
  expect(document.querySelector('.live-take-region')).not.toBeNull()
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_spectrogram', { recordingId: 'listening-1', afterSeconds: null }))
  expect(screen.getByRole('checkbox', { name: 'Detect attempts' })).toBeEnabled()
  // The meter reads native's measurement, and the threshold moves without restarting.
  expect(screen.getByRole('meter', { name: 'Microphone level' })).toHaveAttribute('aria-valuenow', '-35')
  expect(screen.getByText('Attempt 1 · 1 queued · 2 ignored')).toBeVisible()
  // Tuning is tucked into a panel so the dock stays one row.
  fireEvent.click(screen.getByLabelText('Recording settings'))
  expect(screen.getByRole('dialog', { name: 'Recording settings' })).toBeVisible()
  expect(invoke).not.toHaveBeenCalledWith('mic_listen_stop', expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  // The threshold marker on the meter is itself the control.
  const marker = screen.getByRole('slider', { name: 'Activity threshold' })
  expect(marker).toHaveAttribute('aria-valuenow', '-45')
  // The threshold is an absolute level: room noise moving under it while
  // listening does not move the marker.
  const placed = marker.style.insetInlineStart
  status.noiseFloorDb = -40
  await waitFor(() => expect(document.querySelector('.drill-meter-noise')).toHaveStyle({ width: '50%' }))
  expect(marker).toHaveAttribute('aria-valuenow', '-45')
  expect(marker.style.insetInlineStart).toBe(placed)
  fireEvent.keyDown(marker, { key: 'ArrowRight' })
  expect(invoke).toHaveBeenCalledWith('mic_listen_tune', { recordingId: 'listening-1', settings: { pauseMs: 600, thresholdDb: -44, minTakeMs: 300, silenceTimeoutMs: 10000 } })
  fireEvent.keyDown(marker, { key: 'End' })
  expect(invoke).toHaveBeenCalledWith('mic_listen_tune', { recordingId: 'listening-1', settings: { pauseMs: 600, thresholdDb: -10, minTakeMs: 300, silenceTimeoutMs: 10000 } })
  // The whole meter is reachable, including below the measured room noise.
  fireEvent.keyDown(marker, { key: 'Home' })
  expect(invoke).toHaveBeenCalledWith('mic_listen_tune', { recordingId: 'listening-1', settings: { pauseMs: 600, thresholdDb: -80, minTakeMs: 300, silenceTimeoutMs: 10000 } })
  const tunes = invoke.mock.calls.filter(([command]) => command === 'mic_listen_tune').length
  fireEvent.keyDown(marker, { key: 'ArrowLeft' })
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_listen_tune')).toHaveLength(tunes)
  expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_stop', { recordingId: 'listening-1' }))
  items = [item({ attempts: [attempt({ transcriptionAttemptId: 'take-1' })] })]
  status.processing = false; status.completed = 1; take.state = 'completed'
  expect(await within(screen.getByRole('complementary', { name: 'Attempts' })).findByRole('region', { name: 'Attempt 1' }, { timeout: 3000 })).toBeVisible()
  expect(takeStatus('Transcribing…')).toBeNull()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled())
  expect(attemptPlot()).toBe(pendingCanvas)
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_listen_start')).toHaveLength(1)
  expect(invoke.mock.calls.some(([command]) => command === 'mic_start')).toBe(false)
})

it('shows reference audio before an attempt and seeks the actual player clock', async () => {
  items = [item()]
  const seek = vi.fn()
  speak.mockImplementation(async (...args) => {
    await args[5].onAudio({ audioBase64: 'cmVmZXJlbmNl', receipt: null })
    args[5].onReady({ seek, setRate: vi.fn() })
    args[5].onTime(0.25, 1)
    await new Promise<void>(resolve => args[1].addEventListener('abort', () => resolve(), { once: true }))
  })
  const view = app()
  fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
  const slider = await screen.findByRole('slider', { name: 'Seek reference audio' })
  await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "0.25"))
  fireEvent.keyDown(slider, { key: 'End' })
  expect(seek).toHaveBeenCalledWith(1)
  expect(speak).toHaveBeenCalledOnce()
  view.unmount()
})

it('records while held, and throws away a press shorter than the shortest take', async () => {
  items = [item()]
  let now = 1_000
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Recording settings' }))
  const holdMode = await screen.findByRole('radio', { name: 'Hold to talk' })
  await waitFor(() => expect(holdMode).toBeEnabled())
  fireEvent.click(holdMode)
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  const hold = screen.getByRole('button', { name: 'Hold to record' })
  await waitFor(() => expect(hold).toBeEnabled())

  fireEvent.pointerDown(hold, { pointerId: 1 })
  await waitFor(() => expect(hold).toHaveAttribute('aria-pressed', 'true'))
  now += 100
  fireEvent.pointerUp(hold, { pointerId: 1 })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_cancel', { recordingId: 'recording-1' }))
  expect(invoke.mock.calls.some(([command]) => command === 'mic_transcribe')).toBe(false)

  await waitFor(() => expect(hold).toHaveAttribute('aria-pressed', 'false'))
  fireEvent.keyDown(hold, { key: ' ' })
  await waitFor(() => expect(hold).toHaveAttribute('aria-pressed', 'true'))
  now += 1_500
  fireEvent.keyUp(hold, { key: ' ' })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_stop', { recordingId: 'recording-1' }))
  clock.mockRestore()
})

it('defaults the comparison and the recorder to the script direction, and sets the recorder on its own', async () => {
  script.direction = 'rtl'
  items = [item({ attempts: [attempt()] })]
  app()
  const toLeft = await screen.findByRole('radio', { name: '← Time' })
  expect(toLeft).toHaveAttribute('aria-checked', 'true')
  expect(document.querySelector('.drill-timelines')).toHaveAttribute('data-time', 'rtl')
  // Until chosen, the recorder follows the script: its button sits where time arrives.
  const recorder = document.querySelector<HTMLElement>('.drill-voice')!
  expect(recorder).toHaveAttribute('data-pad-side', 'left')
  // The comparison's direction does not move the recorder.
  fireEvent.click(screen.getByRole('radio', { name: 'Time →' }))
  expect(document.querySelector('.drill-timelines')).toHaveAttribute('data-time', 'ltr')
  expect(recorder).toHaveAttribute('data-pad-side', 'left')
  // Recording settings set the button's side and the stream's time direction independently.
  fireEvent.click(within(recorder).getByRole('button', { name: 'Recording settings' }))
  const settings = await screen.findByRole('dialog', { name: 'Recording settings' })
  fireEvent.click(within(within(settings).getByRole('radiogroup', { name: 'Microphone button' })).getByRole('radio', { name: 'Right' }))
  expect(recorder).toHaveAttribute('data-pad-side', 'right')
  const time = within(within(settings).getByRole('radiogroup', { name: 'Time direction' }))
  expect(time.getByRole('radio', { name: '← Time' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(time.getByRole('radio', { name: 'Time →' }))
  expect(time.getByRole('radio', { name: 'Time →' })).toHaveAttribute('aria-checked', 'true')
  expect(recorder).toHaveAttribute('data-pad-side', 'right')
  expect(localStorage.getItem('skellyspeak_recorder_practice_pad')).toBe('right')
  expect(localStorage.getItem('skellyspeak_recorder_practice_time')).toBe('ltr')
})

it('expands the selected take within its history row without reordering the list', async () => {
  const changed = (id: string, sequence: bigint) => attempt({ id, sequence })
  const exact = attempt({ id: 'attempt-3', sequence: 3n, comparison: { ...attempt().comparison, edits: 0, matchRatio: 1,
    words: attempt().comparison.words.map(word => ({ ...word, kind: 'same' as const, transcript: word.target })) } })
  items = [item({ attempts: [exact, changed('attempt-2', 2n), changed('attempt-1', 1n)] })]
  app()
  await screen.findByRole('region', { name: 'Attempt 3' })
  expect(screen.queryByRole('region', { name: 'This card' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Earlier takes' })).toBeNull()
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.drill-attempts-pane .drill-word-row'))
  expect(rows.map(row => row.getAttribute('aria-label'))).toEqual(['Attempt 3', 'Attempt 2', 'Attempt 1'])
  expect(rows[0]).toHaveAttribute('aria-pressed', 'true')
  expect(rows[0]).not.toBeVisible()
  expect(rows[0].querySelector('.drill-word-row-cells')).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' })
  fireEvent.click(rows[1])
  expect(rows[1]).toHaveAttribute('aria-pressed', 'true')
  expect(within(rows[1].parentElement!).getByRole('region', { name: 'Attempt 2' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Attempt 3' })).toBeNull()
  expect(rows[1]).toHaveAttribute('aria-expanded', 'true')
  expect(Array.from(document.querySelectorAll('.drill-word-row'))).toEqual(rows)
})

it('deletes one take, or clears the recent past, and reads the history again', async () => {
  items = [item({ attempts: [attempt({ id: 'attempt-2', sequence: 2n }), attempt()] })]
  const now = Date.parse('2026-09-23T15:00:00.000Z')
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
  app()
  const log = await attemptLog()
  fireEvent.click(await log.findByRole('button', { name: 'Attempt 1' }))
  fireEvent.click(await log.findByRole('button', { name: 'Delete attempt 1' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('delete_drill_attempt', { attemptId: 'attempt-1' }))
  await waitFor(() => expect(log.queryByRole('button', { name: 'Attempt 1' })).toBeNull())

  fireEvent.click(log.getByText('Clear attempts…'))
  fireEvent.click(log.getByRole('button', { name: 'Last 5 minutes' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('clear_drill_attempts', { itemId: 'item-1', since: '2026-09-23T14:55:00.000Z' }))
  await waitFor(() => expect(log.queryByRole('region', { name: 'Attempt 2' })).toBeNull())
  clock.mockRestore()
})

it('stacks mobile practice and history with secondary controls in settings', async () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  items = [item({ attempts: [attempt({ id: 'attempt-2', sequence: 2n }), attempt()] }), second()]
  const view = app()
  fireEvent.click(await screen.findByRole('button', { name: 'Attempt 1' }))
  const scoreDialog = await screen.findByRole('dialog', { name: 'Attempts' })
  expect(within(scoreDialog).getByRole('region', { name: 'Attempt 1' })).toBeVisible()
  expect(within(scoreDialog).queryByRole('button', { name: 'Attempt 2' })).toBeNull()
  fireEvent.click(scoreDialog, { clientX: -1, clientY: -1 })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('button', { name: 'Start recording' })).toBeVisible()
  fireEvent.click(await screen.findByRole('button', { name: 'Attempts' }))
  const historyDialog = await screen.findByRole('dialog', { name: 'Attempts' })
  const report = within(historyDialog).getByRole('complementary', { name: 'Attempts' })
  expect(screen.queryByRole('complementary', { name: 'Your practice cards' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Full report/ })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
  // Auto's own controls stay in the recorder's row on phones too.
  expect(screen.getByRole('checkbox', { name: 'Detect attempts' })).toBeInTheDocument()
  const firstTake = await within(report).findByRole('button', { name: 'Attempt 1' })
  expect(within(report).queryByRole('region', { name: 'Attempt 2' })).toBeNull()
  fireEvent.click(firstTake)
  expect(within(report).getByRole('region', { name: 'Attempt 1' })).toBeVisible()
  fireEvent.click(within(report).getByRole('button', { name: 'Close' }))
  expect(within(report).queryByRole('region', { name: 'Attempt 1' })).toBeNull()
  expect(within(report).getByRole('button', { name: 'Attempt 1' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close Attempts' }))
  fireEvent.click(screen.getByRole('button', { name: /^Practice cards/ }))
  const picker = await screen.findByRole('dialog', { name: 'Practice cards' })
  fireEvent.click(within(picker).getByRole('button', { name: /^Hasta luego/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await screen.findByRole('button', { name: 'Stop recording' })
  expect(screen.getByRole('button', { name: 'Previous card' })).toBeDisabled()
  view.unmount()
  media.mockRestore()
})

it('opens the cards from an edge tab on the stage in the compact layout', async () => {
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query === '(max-width: 860px)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
  items = [item(), second()]
  const view = app()
  // Compact's one way to the cards is the tab on the start of the stage; the toolbar keeps moving through them.
  const navigation = within(await screen.findByRole('navigation', { name: 'Practice cards' }))
  expect(navigation.queryByRole('button', { name: 'Practice cards' })).toBeNull()
  const edge = screen.getByRole('button', { name: 'Practice cards' })
  expect(edge).toHaveClass('drill-cards-edge')
  expect(edge.closest('.drill-mobile-body')).not.toBeNull()
  fireEvent.click(edge)
  const drawer = await screen.findByRole('dialog', { name: 'Practice cards' })
  expect(drawer).toHaveClass('dialog-drawer')
  expect(edge).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(within(drawer).getByRole('button', { name: /^Hasta luego/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()
  view.unmount()
  media.mockRestore()
})

it('dismisses a microphone error and its expanded diagnostics without hiding the recorder', async () => {
  items = [item()]
  const implementation = invoke.getMockImplementation()!
  invoke.mockImplementation(async (command, args) => {
    if (command === 'mic_listen_start') throw new Error('Microphone test failure')
    return implementation(command, args)
  })
  app()
  const start = await screen.findByRole('button', { name: 'Start recording' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(start)
  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText('Microphone test failure')).toBeVisible()
  fireEvent.click(within(alert).getByText('Response details'))
  fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss error' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Response details')).toBeNull()
  expect(start).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(start)
  expect(await screen.findByRole('alert')).toHaveTextContent('Microphone test failure')
})

it('defaults to Tap like conversation and exposes the shared voice speed preference without opening settings', async () => {
  items = [item()]
  app()
  expect(await screen.findByRole('radio', { name: 'Tap to record' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.queryByRole('checkbox', { name: 'Detect attempts' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Voice speed' }), { target: { value: '0.65' } })
  expect(setPreference).toHaveBeenLastCalledWith('tts_rate', 0.65)
})

it('dismisses recording settings on the backdrop but keeps inside clicks open', async () => {
  items = [item()]
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Recording settings' }))
  const dialog = screen.getByRole('dialog', { name: 'Recording settings' })
  fireEvent.click(within(dialog).getByRole('heading', { name: 'Recording settings' }))
  expect(dialog).toBeInTheDocument()
  fireEvent.click(dialog, { clientX: -1, clientY: -1 })
  expect(screen.queryByRole('dialog', { name: 'Recording settings' })).toBeNull()
})

it.each([false, true])('shows a stopped clip before transcription resolves and hydrates its row (mobile=%s)', async mobile => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  items = [item()]
  runStatus.processing = true
  runStatus.takes = [{ recordingId: 'recording-1', number: 1, startSeconds: 0, endSeconds: 1, cutSeconds: 1, state: 'processing', failure: null }]
  const finish = () => {
    items = [item({ attempts: [attempt()] })]
    runStatus.processing = false; runStatus.completed = 1; runStatus.takes[0].state = 'completed'
  }
  const view = app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Recording settings' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
  await waitFor(() => expect(takeStatus('Transcribing…')).toBeVisible())
  const receipt = document.querySelector('[data-recording-id="recording-1"]')
  expect(receipt).not.toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(finish).toBeDefined())
  await act(async () => { finish() })
  await waitFor(() => expect(document.querySelector('[data-recording-id="recording-1"]')).toBeNull())
  await waitFor(() => expect(screen.getAllByText('94%').length).toBeGreaterThan(0), { timeout: 3000 })
  expect(takeStatus('Transcribing…')).toBeNull()
  view.unmount(); media.mockRestore()
})

it('lets the learner stop reference and recorded playback', async () => {
  items = [item({ attempts: [attempt()] })]
  let referenceSignal!: AbortSignal
  speak.mockImplementation((_input, signal) => {
    referenceSignal = signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError'))))
  })
  const stop = vi.fn()
  play.mockReturnValue({ play: () => new Promise(() => {}), stop })
  app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  const referenceStop = await screen.findByRole('button', { name: 'Stop playback' })
  expect(referenceStop).toBeEnabled()
  fireEvent.click(referenceStop)
  expect(referenceSignal.aborted).toBe(true)
  await screen.findByRole('button', { name: 'Play' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop' }))
  expect(stop).toHaveBeenCalledOnce()
  expect(await screen.findByRole('button', { name: 'Play yours' })).toBeEnabled()
})

it('offers the shared ten-second Auto silence timeout and applies changes to capture', async () => {
  items = [item()]
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation((command, args) => command === 'mic_listen_start'
    ? Promise.resolve({ recordingId: 'listening', samplesPerSecond: 689, browserCapture: false }) : native(command, args))
  const view = app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
  fireEvent.click(screen.getByLabelText('Recording settings'))
  const timeout = screen.getByRole('radiogroup', { name: 'Stop listening after silence of' })
  expect(within(timeout).getByRole('radio', { name: '10 s' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(within(timeout).getByRole('radio', { name: '15 s' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_start', expect.objectContaining({ settings: expect.objectContaining({ silenceTimeoutMs: 15000 }) })))
  view.unmount()
})

it('starts with the cards folded and names the shown card between Previous and Next', async () => {
  items = [item(), second()]
  app()
  await screen.findByRole('button', { name: 'Play' })
  const navigation = within(await screen.findByRole('navigation', { name: 'Practice cards' }))
  // At full width the side panel is the only way to the cards; the toolbar moves through them.
  expect(navigation.queryByRole('button', { name: /^Practice cards/ })).toBeNull()
  expect(screen.queryByRole('complementary', { name: 'Your practice cards' })).toBeNull()
  expect(navigation.getByText('Card 1 of 2')).toBeInTheDocument()
  fireEvent.click(navigation.getByRole('button', { name: 'Next card' }))
  await waitFor(() => expect(navigation.getByText('Card 2 of 2')).toBeInTheDocument())
  fireEvent.click(navigation.getByRole('button', { name: 'Random card' }))
  await waitFor(() => expect(navigation.getByText('Card 1 of 2')).toBeInTheDocument())
  // Folded, the edge tab names the cards without a count, opens them, and the panel remembers it.
  const edge = screen.getByRole('button', { name: 'Practice cards' })
  expect(edge).toHaveTextContent(/^Practice cards$/)
  fireEvent.click(edge)
  expect(screen.getByRole('complementary', { name: 'Your practice cards' })).toBeVisible()
  expect(localStorage.getItem('skellyspeak_cards_panel')).toBe('open')
  fireEvent.click(screen.getByRole('button', { name: 'Close Practice cards' }))
  expect(screen.queryByRole('complementary', { name: 'Your practice cards' })).toBeNull()
})

it('hides unscored takes by default and retains an explicit way to inspect them', async () => {
  const unscored = attempt({ id: 'unscored', sequence: 2n, comparison: { ...attempt().comparison, matchRatio: null } })
  items = [item({ attempts: [unscored, attempt()] })]
  app()
  await screen.findByRole('region', { name: 'Attempt 1' })
  expect(screen.queryByRole('button', { name: 'Attempt 2' })).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Show unscored' }).closest('.drill-history-footer')).not.toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show unscored' }))
  expect(screen.queryByRole('button', { name: 'Attempt 2' })).toBeNull()
  expect(screen.getByRole('region', { name: 'Attempt 2' })).toBeVisible()
  expect(screen.getByRole('checkbox', { name: 'Show unscored' }).closest('.drill-history-footer')).not.toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show unscored' }))
  expect(screen.getByRole('region', { name: 'Attempt 1' })).toBeVisible()
})

it('presents microphone errors over the workspace without inserting content in the dock', async () => {
  items = [item()]
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation((command, args) => command === 'mic_listen_start'
    ? Promise.reject(new Error('Microphone test failure')) : native(command, args))
  app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  const dock = document.querySelector('.drill-dock-pane')
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await screen.findByText('Microphone test failure')
  expect(document.querySelector('.drill-dock-pane')).toBe(dock)
  expect(dock?.querySelector('[role="alert"]')).toBeNull()
  expect(document.querySelector('.drill-error-overlay [role="alert"]')).not.toBeNull()
})


it('toggles auto detection in Live without stopping the microphone or changing mode', async () => {
  items = [item()]
  app()
  const start = await screen.findByRole('button', { name: 'Start recording' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
  fireEvent.click(start)
  await screen.findByRole('button', { name: 'Stop recording' })
  await waitFor(() => expect(document.querySelector('.live-recording .inspection-spectrogram')).not.toBeNull())
  const plot = document.querySelector('.live-recording .inspection-spectrogram')
  const toggle = screen.getByRole('checkbox', { name: 'Detect attempts' })
  fireEvent.click(toggle)
  expect(toggle).not.toBeChecked()
  expect(invoke).toHaveBeenCalledWith('mic_listen_tune', expect.objectContaining({ captureMode: 'monitor' }))
  fireEvent.click(toggle)
  expect(toggle).toBeChecked()
  expect(invoke).toHaveBeenCalledWith('mic_listen_tune', expect.objectContaining({ captureMode: 'auto' }))
  expect(document.querySelector('.live-recording .inspection-spectrogram')).toBe(plot)
  expect(document.querySelector('.drill-voice')).toHaveAttribute('data-mode', 'auto')
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_listen_start')).toHaveLength(1)
  expect(invoke.mock.calls.some(([command]) => command === 'mic_listen_stop')).toBe(false)
})

it('restores the selected phrase after remount and replaces a deleted selection', async () => {
  items = [item(), second()]
  const firstView = app()
  const next = await screen.findByRole('button', { name: 'Next card' })
  await waitFor(() => expect(next).toBeEnabled())
  fireEvent.click(next)
  await waitFor(() => expect(localStorage.getItem('skellyspeak_drill_phrase_spanish')).toBe('item-2'))
  firstView.unmount()
  const refreshed = app()
  await waitFor(() => expect(screen.getByText('Card 2 of 2')).toBeInTheDocument())
  expect(invoke).toHaveBeenCalledWith('get_cached_reading_audio', expect.objectContaining({ input: expect.objectContaining({ referenceItem: 'item-2' }) }))
  refreshed.unmount()
  items = [item()]
  app()
  await waitFor(() => expect(localStorage.getItem('skellyspeak_drill_phrase_spanish')).toBe('item-1'))
  expect(screen.getByText('Card 1 of 1')).toBeInTheDocument()
})

it('automatically expands a newly published take after selecting an older card', async () => {
  items = [item({ attempts: [attempt({ id: 'attempt-2', sequence: 2n }), attempt()] })]
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Attempt 1' }))
  expect(screen.getByRole('region', { name: 'Attempt 1' })).toBeVisible()
  items = [item({ attempts: [attempt({ id: 'attempt-3', sequence: 3n }), ...items[0].attempts] })]
  const { recordingPublished } = await import('../../platform/audio/recording-events')
  act(() => recordingPublished({ kind: 'drillItem', id: 'item-1' }))
  expect(await screen.findByRole('region', { name: 'Attempt 3' })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Attempt 1' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Attempt 3' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Attempt 1' })).toBeVisible()
})

it('releasing Hold before microphone startup finishes discards the pending capture', async () => {
  items = [item()]
  const native = invoke.getMockImplementation()!
  let finishStart!: () => void
  const pending = new Promise<void>(resolve => { finishStart = resolve })
  invoke.mockImplementation(async (command, args) => {
    if (command === 'mic_listen_start') await pending
    return native(command, args)
  })
  let now = 1000
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
  try {
    app()
    fireEvent.click(await screen.findByRole('button', { name: 'Recording settings' }))
    const mode = await screen.findByRole('radio', { name: 'Hold to talk' })
    await waitFor(() => expect(mode).toBeEnabled())
    fireEvent.click(mode)
    fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
    const hold = screen.getByRole('button', { name: 'Hold to record' })
    fireEvent.pointerDown(hold, { pointerId: 1 })
    now += 500
    fireEvent.pointerUp(hold, { pointerId: 1 })
    expect(invoke.mock.calls.some(([command]) => command === 'mic_listen_stop')).toBe(false)
    expect(hold).toHaveAttribute('aria-busy', 'true')
    await act(async () => finishStart())
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_cancel', { recordingId: 'recording-1' }))
    expect(invoke.mock.calls.some(([command]) => command === 'mic_listen_stop' || command === 'mic_transcribe')).toBe(false)
    expect(invoke.mock.calls.filter(([command]) => command === 'mic_listen_start')).toHaveLength(1)
  } finally { clock.mockRestore() }
})

it('seeks paused plots without starting audio and resumes from the selected position', async () => {
  items = [item({ attempts: [attempt()] })]
  const native = invoke.getMockImplementation()!
  invoke.mockImplementation((command, args) => command === 'get_cached_reading_audio'
    ? Promise.resolve({ audioBase64: 'cmVmZXJlbmNl', alignment: null }) : native(command, args))
  app()
  const reference = await screen.findByRole('slider', { name: 'Seek reference audio' })
  await waitFor(() => expect(reference).toBeEnabled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled())
  for (let step = 0; step < 6; step++) fireEvent.keyDown(reference, { key: 'ArrowRight' })
  expect(Number(reference.getAttribute('aria-valuenow'))).toBeCloseTo(0.6)
  const attemptCursor = screen.getByRole('slider', { name: 'Attempt' })
  vi.spyOn(attemptCursor.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200 } as DOMRect)
  attemptCursor.setPointerCapture = vi.fn()
  fireEvent(attemptCursor, new MouseEvent('pointerdown', { bubbles: true, clientX: 150 }))
  expect(Number(attemptCursor.getAttribute('aria-valuenow'))).toBeCloseTo(0.75)
  expect(play).not.toHaveBeenCalled()
  expect(speak).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
  expect(play.mock.calls[0][5].startSeconds).toBe(0.6)
  fireEvent.click(screen.getByRole('button', { name: 'Stop playback' }))
  await screen.findByRole('button', { name: 'Play' })
  fireEvent.change(reference, { target: { value: '0.2' } })
  expect(play).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
  expect(play.mock.calls[1][5].startSeconds).toBeCloseTo(0.75)
  attemptCursor.hasPointerCapture = () => true
  attemptCursor.releasePointerCapture = vi.fn()
  fireEvent(attemptCursor, new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }))
  fireEvent.pointerUp(attemptCursor)
  await screen.findByRole('button', { name: 'Play yours' })
  expect(play.mock.results[1].value.stop).toHaveBeenCalled()
  expect(play).toHaveBeenCalledTimes(2)
})

it('restores the durable workspace phrase after startup even with stale webview storage', async () => {
  items = [item(), second()]
  localStorage.setItem('skellyspeak_drill_phrase_spanish', 'item-1')
  const native = invoke.getMockImplementation()!
  let finish!: (id: string) => void
  invoke.mockImplementation((command, args) => command === 'get_last_drill_item'
    ? new Promise(resolve => { finish = resolve }) : native(command, args))
  app()
  await waitFor(() => expect(finish).toBeDefined())
  expect(invoke.mock.calls.some(([command]) => command === 'enter_drill_visit')).toBe(false)
  await act(async () => finish('item-2'))
  await waitFor(() => expect(screen.getByText('Card 2 of 2')).toBeInTheDocument())
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('enter_drill_visit', expect.objectContaining({ itemId: 'item-2' })))
  expect(localStorage.getItem('skellyspeak_drill_phrase_spanish')).toBe('item-2')
})

it('opens the full Add cards modal directly from the cards panel', async () => {
  items = [item()]
  app()
  await openPhrases()
  const panel = await screen.findByRole('region', { name: 'Practice cards' })
  fireEvent.click(within(panel).getByRole('button', { name: 'Add practice cards…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Add practice cards' })
  expect(dialog.tagName).toBe('DIALOG')
  expect(document.querySelector('.drill-entry')).toBeNull()
  expect(screen.queryByPlaceholderText('Type a line to say out loud')).toBeNull()
  expect(document.querySelector('.drill-dropdown')).toBeNull()
})

it('uses the shared microphone preference from recording settings', async () => {
  microphones.mockResolvedValue({ source: 'native', devices: [{ id: 'usb', label: 'USB microphone', isDefault: false, channels: 1, sampleRate: 48000, unavailable: null }] })
  items = [item()]
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Recording settings' }))
  await screen.findByRole('option', { name: /USB microphone.*48,000 Hz/ })
  fireEvent.change(screen.getByRole('combobox', { name: 'Microphone' }), { target: { value: 'usb' } })
  expect(updateSettings).toHaveBeenCalledWith(expect.any(Function), 'Changing microphone')
  const change = updateSettings.mock.lastCall![0]
  expect(change({ microphone_device_id: null, tts_rate: 0.85 })).toEqual({ microphone_device_id: 'usb', tts_rate: 0.85 })
})

it('keeps the practice layout with one large Add practice cards button when there are no cards', async () => {
  localStorage.setItem('skellyspeak_practice_starter', 'closed')
  app()
  const panel = await screen.findByRole('region', { name: 'Practice cards' })
  expect(within(panel).getByRole('button', { name: 'Add practice cards…' })).toHaveAccessibleDescription('No practice cards yet')
  expect(screen.getAllByRole('button', { name: 'Add practice cards…' })).toHaveLength(1)
  // The stage, recorder and attempt list are the real components, empty: no
  // drawn stand-ins, and nothing to play or record until a card exists.
  expect(document.querySelector('.drill-target-card')).toHaveTextContent('No card selected')
  expect(screen.getByRole('button', { name: 'Play reference' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Play yours' })).toBeDisabled()
  const recorder = screen.getByRole('region', { name: 'Record an attempt' })
  expect(within(recorder).getByRole('button', { name: 'Start recording' })).toBeDisabled()
  expect(within(recorder).getByRole('status')).toHaveTextContent('Add a practice card to record.')
  expect(screen.getByRole('complementary', { name: 'Attempts' })).toHaveTextContent('No attempts yet. Record one to compare.')
  expect(document.querySelector('[class*="drill-empty"], .drill-stage-empty')).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'Add practice cards to get started' })).toBeNull()
  fireEvent.click(within(panel).getByRole('button', { name: 'Add practice cards…' }))
  expect(await screen.findByRole('dialog', { name: 'Add practice cards' })).toBeVisible()
  expect(screen.getByText('Generated phrases will appear here.')).toBeVisible()
})

it('says there are no cards only once the card list has been read', async () => {
  localStorage.setItem('skellyspeak_practice_starter', 'closed')
  let answer: (cards: DrillItemView[]) => void = () => { throw new Error('The card list was never requested.') }
  const base = invoke.getMockImplementation()!
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) =>
    command === 'get_drill_items' ? new Promise(resolve => { answer = resolve }) : base(command, args))
  app()
  const recorder = await screen.findByRole('region', { name: 'Record an attempt' })
  expect(within(recorder).getByRole('status')).toHaveTextContent('Preparing the session')
  expect(screen.queryByText('Add a practice card to record.')).toBeNull()
  act(() => answer([]))
  await waitFor(() => expect(within(recorder).getByRole('status')).toHaveTextContent('Add a practice card to record.'))
})

it('keeps the real recorder and attempt list on a phone with no cards, and leads the bar with Add practice cards', async () => {
  localStorage.setItem('skellyspeak_practice_starter', 'closed')
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const view = app()
  try {
    const bar = await screen.findByRole('navigation', { name: 'Practice cards' })
    await waitFor(() => expect(within(bar).getByRole('button', { name: 'Add practice cards…' })).toBeVisible())
    expect(document.querySelector('.drill-target-card')).toHaveTextContent('No card selected')
    const recorder = screen.getByRole('region', { name: 'Record an attempt' })
    expect(within(recorder).getByRole('button', { name: 'Start recording' })).toBeDisabled()
    expect(within(recorder).getByRole('status')).toHaveTextContent('Add a practice card to record.')
    expect(screen.getByRole('region', { name: 'Attempts' })).toBeInTheDocument()
    expect(document.querySelector('[class*="drill-empty"], .drill-stage-empty')).toBeNull()
  } finally {
    view.unmount()
    media.mockRestore()
  }
})

it.each(['beginner', 'idiomatic'] as const)('funnels the %s starter into the full phrase picker and saves only explicitly kept phrases', async set => {
  const phrases = ['Ana es médica.', 'Ana está cansada.']
  const base = invoke.getMockImplementation()!
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    switch (command) {
      case 'preview_practice_set': return { requestId: `bundled:${set}`, requested: null, receiptId: null, shortfall: null,
        candidates: phrases.map((text, index) => ({ candidateId: `phrase-${index}`, text, translation: null,
          reported: { difficulty: null, tags: [] }, verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: false },
          source: { kind: 'bundled', set, contentHash: 'fixture' } })) }
      case 'accept_practice_phrases': {
        const kept = (args.candidateIds as string[]).map(id => item({ id: `kept-${id}`, text: phrases[Number(id.split('-')[1])],
          source: { kind: 'bundled', set, contentHash: 'fixture' } }))
        items = kept
        return kept
      }
      default: return base(command, args)
    }
  })
  app()
  const starter = await screen.findByRole('dialog', { name: 'Add practice cards to get started' })
  // Each level says in one line what it holds, under its name, and its button carries that line.
  for (const [name, description] of [['Add 8 absolute zero phrases', 'Single words and simple phrases'], ['Add 8 beginner phrases', 'Everyday short phrases'],
    ['Add 8 intermediate phrases', 'Fuller sentences to ask and explain'], ['Add 8 advanced phrases', 'Longer, more natural speech'],
    ['Add 15 social phrases', 'Greetings, thanks and everyday social exchanges'], ['Add 8 idiomatic phrases', 'Idioms and familiar sayings']]) {
    expect(await within(starter).findByRole('button', { name })).toBeVisible()
    expect(within(starter).getByRole('button', { name })).toHaveAccessibleDescription(description)
  }
  for (const sample of ['Sí.', 'Ana es médica.', 'Ayer fui al mercado.', 'Aunque parece fácil, hay que pensarlo bien.', '¡Hola!']) {
    expect(within(starter).getByText(sample)).toBeVisible()
  }
  fireEvent.click(within(starter).getByRole('button', { name: `Add 8 ${set} phrases` }))
  const picker = await screen.findByRole('dialog', { name: 'Add practice cards' })
  expect(screen.queryByRole('dialog', { name: 'Add practice cards to get started' })).toBeNull()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(within(picker).getByRole('button', { name: 'Generate again' })).toBeVisible()
  expect(within(picker).getByRole('searchbox', { name: 'Topic (optional)' })).toBeVisible()
  const keep = within(picker).getByRole('button', { name: 'Keep “Ana es médica.”' })
  expect(items).toEqual([])
  expect(invoke.mock.calls.some(([command]) => command === 'accept_practice_phrases')).toBe(false)
  fireEvent.click(keep)
  await waitFor(() => expect(items).toHaveLength(1))
  expect(picker).toBeVisible()
  fireEvent.click(within(picker).getByRole('button', { name: 'Close Add practice cards' }))
  expect(invoke).toHaveBeenCalledWith('preview_practice_set', { scope: {
    language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-us',
  }, set })
  expect(invoke.mock.calls.some(([command]) => ['begin_drill_preview', 'preview_drill_items', 'accept_drill_items'].includes(command))).toBe(false)
  expect(await screen.findByText('Card 1 of 1')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Add practice cards…' }))
  const reopened = await screen.findByRole('dialog', { name: 'Add practice cards' })
  expect(within(reopened).queryByRole('button', { name: 'Keep “Ana está cansada.”' })).toBeNull()
  expect(within(reopened).getByText('Generated phrases will appear here.')).toBeVisible()
})

it('stays closed on later visits once “Don’t show this again” is ticked', async () => {
  const view = app()
  const starter = await screen.findByRole('dialog', { name: 'Add practice cards to get started' })
  fireEvent.click(within(starter).getByRole('checkbox', { name: 'Don’t show this again' }))
  expect(within(starter).getByRole('checkbox', { name: 'Don’t show this again' })).toBeChecked()
  fireEvent.click(within(starter).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'Add practice cards to get started' })).toBeNull()
  view.rerender(<I18nProvider locale="english"><DrillPage active={false} /></I18nProvider>)
  view.rerender(<I18nProvider locale="english"><DrillPage active /></I18nProvider>)
  await screen.findByRole('region', { name: 'Practice cards' })
  expect(screen.queryByRole('dialog', { name: 'Add practice cards to get started' })).toBeNull()
})
