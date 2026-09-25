// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { DrillPage } from './DrillPage'
import { ReadingLookupContext } from '../../components/reading/ReadingContext'
import type { DrillAttemptView, DrillItemView, TranscriptionInspectionResult } from '../../generated/contracts'

const invoke = vi.hoisted(() => vi.fn())
const speak = vi.hoisted(() => vi.fn())
const play = vi.hoisted(() => vi.fn())
const setPreference = vi.hoisted(() => vi.fn())
const script = vi.hoisted(() => ({ direction: 'ltr' as 'ltr' | 'rtl' }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('../../platform/audio/reading-speech', async () => ({ ...await vi.importActual('../../platform/audio/reading-speech'), speakSelection: speak }))
vi.mock('../../platform/audio/speech-player', () => ({ playSpeechAudio: play }))
vi.mock('../../platform/audio/speech', async () => {
  const actual = await vi.importActual<typeof import('../../platform/audio/speech')>('../../platform/audio/speech')
  return actual
})
vi.mock('../../platform/ipc/tauri', async () => ({
  languageFor: () => ({ languageTag: 'es', direction: script.direction, romanization: null }),
  languages: () => [],
  isTauri: true,
}))
vi.mock('../../state/settings/settings', () => ({
  useSettingsStore: (select: (state: unknown) => unknown) => select({
    setPreference, savingPreference: false,
    settings: { target_language: 'spanish', target_variety: 'spanish-spain', native_language: 'english', native_variety: 'english-us', tts_rate: 0.85, master_volume: 30, voice_volume: 50 },
  }),
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
  transcriptionAttemptId: 'recording-1', createdAt: '2026-09-22T12:00:00.000Z',
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
    id: 'item-1', text: 'Quisiera un café.', language: 'spanish', variety: 'spanish-spain',
    explanation: 'english', explanationVariety: 'english-us', createdAt: '2026-09-22T11:00:00.000Z',
    attemptCount: attempts.length, bestMatchRatio: ratios.length ? Math.max(...ratios) : null,
    lastAttemptAt: attempts[0]?.createdAt ?? null, attempts: [], ...overrides,
  } as DrillItemView
}
const second = () => item({ id: 'item-2', text: 'Hasta luego.', attempts: [] })

let items: DrillItemView[] = []
let transcription: TranscriptionInspectionResult
beforeEach(() => {
  invoke.mockReset(); speak.mockReset(); play.mockReset()
  items = []
  script.direction = 'ltr'
  transcription = { text: 'quisiera un cafe', audioBase64: 'YXVkaW8=', diagnostics: null, inspection } as unknown as TranscriptionInspectionResult
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    switch (command) {
      case 'get_drill_items': return items
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
      case 'mic_start': return { recordingId: 'recording-1', samplesPerSecond: 689 }
      case 'mic_wave': return []
      case 'mic_transcribe': {
        items = items.map(entry => entry.id === transcription.inspection.owner.id ? { ...entry, attempts: [attempt()] } : entry)
        return transcription
      }
      case 'mic_cancel': return
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
  await screen.findByRole('button', { name: 'Hear it' })
  fireEvent.click(screen.getAllByRole('button').find(node => node.textContent?.startsWith('Hasta luego.'))!)
  await act(async () => release({ audioBase64: 'cmVmZXJlbmNl', alignment: null }))
  expect(invoke.mock.calls.some(([command]) => command === 'inspect_drill_audio')).toBe(false)
  expect(screen.getByRole('slider', { name: 'Seek reference audio' })).toBeDisabled()
  expect(speak).not.toHaveBeenCalled()
})

it('takes a typed phrase, records an attempt against it, and scores what was said', async () => {
  app()
  await screen.findByText('Add a phrase to start practising.')
  fireEvent.change(screen.getByLabelText('Practise a phrase'), { target: { value: '  Quisiera un café.  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  // The phrase is listed, and shown through the shared target card.
  await screen.findByRole('button', { name: 'Delete “Quisiera un café.” and its attempts' })
  expect(screen.getByRole('button', { name: 'Hear it' })).toBeVisible()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_start', { owner: { kind: 'drillItem', id: 'item-1' } }))
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
  fireEvent.click(screen.getByText('Comparison details'))
  expect(screen.getByText('Characters matching the target, after lowercase, strip_punctuation')).toBeVisible()
  expect(screen.getByText('0.06')).toBeVisible()
  expect(screen.getByText('1 of 16 characters')).toBeVisible()
  expect(screen.getByText('lowercase, strip_punctuation')).toBeVisible()
  const words = within(screen.getByRole('group', { name: 'Word by word' }))
  // The target and what was heard sit together, with the outcome named in words.
  expect(words.getByText('cafe')).toBeVisible()
  expect(words.getByText('café')).toBeVisible()
  expect(words.getByText('letters differ')).toBeVisible()
  expect(words.getAllByText('same')).toHaveLength(2)

  await waitFor(() => expect(invoke).toHaveBeenCalledWith('get_drill_attempt_audio', { attemptId: 'attempt-1' }), { timeout: 5000 })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled(), { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  expect(play).toHaveBeenCalledOnce()
  expect(play).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.any(Function), 0.85, 0.15, expect.objectContaining({ onTime: expect.any(Function) }))
  act(() => play.mock.calls[0][5].onTime(0.4, 1))
  expect(document.querySelector('.drill-comparison-panel .audio-spectrum-cursor')).toHaveStyle({ left: '40%' })
  // With no reference played yet, the panel says so instead of comparing one.
  expect(screen.getByText('Play the reference to compare it with this attempt.')).toBeVisible()
})

it('pairs the reference with the attempt once the reference has been heard', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  await screen.findByRole('button', { name: 'Play yours' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hear it' })) })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl', speechAlignment: null }), { timeout: 5000 })
  expect(speak).toHaveBeenCalledWith(
    expect.objectContaining({ text: 'Quisiera un café.', aid: 'speech', language: 'spanish', referenceItem: 'item-1' }),
    expect.any(AbortSignal), expect.any(Function), expect.any(Number), expect.any(Number), expect.objectContaining({ onAudio: expect.any(Function), onTime: expect.any(Function) }))
  // Both recordings are captioned with their own measured length.
  expect(await screen.findByText(/^Reference · /, {}, { timeout: 5000 })).toBeVisible()
  expect(screen.getByText(/^You · /)).toBeVisible()
  // Every replay asks native to validate/cache the source, even when the
  // inspection is already visible. Native cache hits do not call the provider.
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hear it' })) })
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
  expect(await screen.findByText('1 attempts · best 94%')).toBeVisible()
  view.rerender(<I18nProvider locale="english"><DrillPage active={false} /></I18nProvider>)
  view.rerender(<I18nProvider locale="english"><DrillPage active /></I18nProvider>)
  expect(await within(await screen.findByRole('complementary', { name: 'Attempts' })).findByRole('region', { name: 'Attempt 1' })).toBeVisible()
  expect(invoke.mock.calls.filter(([command]) => command === 'get_drill_items').length).toBeGreaterThan(1)

  fireEvent.click(screen.getByRole('button', { name: 'Delete “Quisiera un café.” and its attempts' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('delete_drill_item', { itemId: 'item-1' }))
  expect(await screen.findByText('Add a phrase to start practising.')).toBeVisible()
})

it('refuses playback while the microphone is recording, and lets it go again after', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  await screen.findByRole('button', { name: 'Start recording' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stop recording' })).toBeVisible())
  // The speakers would be recorded: neither the reference nor a replay runs.
  expect(screen.getByRole('button', { name: 'Hear it' })).toBeDisabled()
  const { interruptSpeech, microphoneHeld } = await import('../../platform/audio/speech')
  expect(microphoneHeld()).toBe(true)
  expect(interruptSpeech()).toBeNull()
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
  fireEvent.click(await screen.findByRole('button', { name: 'Hear it' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl', speechAlignment: null }))
  // The learner moves on while the reference inspection is still being prepared.
  fireEvent.click(screen.getAllByRole('button').find(node => node.textContent?.startsWith('Hasta luego.'))!)
  expect((speak.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
  await act(async () => { release(inspection) })
  expect(invoke).not.toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-2', audioBase64: 'cmVmZXJlbmNl' })
  // The seek control keeps its place but has nothing to seek: no reference is drawn.
  expect(screen.getByRole('slider', { name: 'Seek reference audio' })).toBeDisabled()
  expect(screen.getByText('Hear it once to draw the reference here.')).toBeVisible()
})

it('asks about the phrase in its own stored language, and only once', async () => {
  // The item was written in Spanish; today's settings say Spanish too, but the
  // aid must use what the item stored, not what the settings happen to read.
  items = [item({ variety: 'spanish-mexico', explanationVariety: 'english-gb' })]
  const lookup = vi.fn(async () => ({ explanations: { cards: [] } }) as never) as unknown as Lookup & ReturnType<typeof vi.fn>
  app(lookup)
  fireEvent.click(await screen.findByRole('button', { name: 'Analysis' }))
  await waitFor(() => expect(lookup).toHaveBeenCalledWith(
    expect.objectContaining({ text: 'Quisiera un café.', aid: 'explanations', variety: 'spanish-mexico', explanationVariety: 'english-gb' }),
    expect.any(AbortSignal)))
  expect(await screen.findByText('Nothing to flag in this reply.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close Message analysis' }))
  fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
  expect(lookup).toHaveBeenCalledOnce()
})


it('cancels pending reference speech on leaving, and never inspects its late result', async () => {
  items = [item()]
  let finish!: (value: { audioBase64: string }) => void
  speak.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = app()
  fireEvent.click(await screen.findByRole('button', { name: 'Hear it' }))
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
  fireEvent.click(screen.getByRole('button', { name: /#1/ }))
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
  expect(await screen.findByText('Ready to listen')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  expect(await screen.findByText('Recording')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Discard' })).toBeVisible()
})

it('shows how many attempts a phrase has and the best measured match', async () => {
  items = [item({ attempts: [attempt()] }), second()]
  app()
  expect(await screen.findByText('1 attempts · best 94%')).toBeVisible()
  expect(screen.getByText('No attempts yet')).toBeVisible()
})

it('counts attempts without a measurable match instead of inventing a score', async () => {
  const unmeasured = attempt({ comparison: { ...attempt().comparison, matchRatio: null, characterErrorRate: null } })
  items = [item({ attempts: [unmeasured] })]
  app()
  expect(await screen.findByText('1 attempts')).toBeVisible()
})

it('marks where one detected speech segment ended and the next began', async () => {
  items = [item({ attempts: [attempt()] })]
  const native = invoke.getMockImplementation()!
  const split = { ...inspection, duration: 1, activity: { ...inspection.activity, regions: [{ start: 0, end: 0.4 }, { start: 0.6, end: 1 }] } }
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) =>
    command === 'inspect_drill_audio' ? split : native(command, args))
  app()
  // Two detected regions means the learner said the line twice in one recording.
  expect(await screen.findByText('segment 2', {}, { timeout: 5000 })).toBeVisible()
  expect(screen.getByText(/2 speech segments/)).toBeVisible()
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
  const log = within(await screen.findByRole('complementary', { name: 'Attempts' }))
  // The newest, exact attempt is the full report; the older one is a line in the log.
  expect(within(await log.findByRole('region', { name: 'Attempt 2' })).getByText('Exact')).toBeVisible()
  const older = await log.findByRole('button', { name: /#1/ })
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
  const log = within(await screen.findByRole('complementary', { name: 'Attempts' }))
  await waitFor(() => expect(log.getAllByRole('button').length).toBeGreaterThan(1))
  // Ten per page, less the newest, which is reported in full above the log.
  expect(log.getAllByRole('button', { name: /#/ })).toHaveLength(9)
  expect(invoke).toHaveBeenCalledWith('drill_attempts', { itemId: 'item-1', cursor: null, limit: 20 })
  fireEvent.click(log.getByRole('button', { name: 'Show older attempts' }))
  await waitFor(() => expect(log.getAllByRole('button', { name: /#/ })).toHaveLength(14))
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
  fireEvent.click(log.getByRole('button', { name: /#1/ }))
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
  expect(screen.queryByText('Add a phrase to start practising.')).not.toBeInTheDocument()
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
  await waitFor(() => expect(live).toHaveTextContent('Ready to listen'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(live).toHaveTextContent('Recording'))
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
  fireEvent.click(await screen.findByRole('radio', { name: 'Auto-detect' }))
  fireEvent.click(screen.getByLabelText('Recording settings'))
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'End a take after silence of' })).getByRole('radio', { name: '0.6 s' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_start', {
    owner: { kind: 'drillItem', id: 'item-1' }, settings: { pauseMs: 600, thresholdDb: -45, minTakeMs: 300, silenceTimeoutMs: 10000 },
  }))
  expect(await screen.findByText('Take 1 clipped →')).toBeVisible()
  expect(await screen.findByText('Transcribing…')).toBeVisible()
  expect(document.querySelector('.live-take-region')).not.toBeNull()
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_spectrogram', { recordingId: 'listening-1', afterSeconds: null }))
  expect(screen.getByRole('radio', { name: 'Auto-detect' })).toBeDisabled()
  // The meter reads native's measurement, and the threshold moves without restarting.
  expect(screen.getByRole('meter', { name: 'Microphone level' })).toHaveAttribute('aria-valuenow', '-35')
  expect(screen.getByText('Take 1 · 1 queued · 2 ignored')).toBeVisible()
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
  expect(screen.getByRole('button', { name: 'Hear it' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Discard current take' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_discard', { recordingId: 'listening-1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_stop', { recordingId: 'listening-1' }))
  items = [item({ attempts: [attempt({ transcriptionAttemptId: 'take-1' })] })]
  status.processing = false; status.completed = 1; take.state = 'completed'
  expect(await within(screen.getByRole('complementary', { name: 'Attempts' })).findByRole('region', { name: 'Attempt 1' })).toBeVisible()
  expect(screen.queryByText('Transcribing…')).toBeNull()
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
  fireEvent.click(await screen.findByRole('button', { name: 'Hear it' }))
  const slider = await screen.findByRole('slider', { name: 'Seek reference audio' })
  await waitFor(() => expect(slider).toHaveValue('0.25'))
  fireEvent.change(slider, { target: { value: '0.7' } })
  expect(seek).toHaveBeenCalledWith(0.7)
  expect(speak).toHaveBeenCalledOnce()
  view.unmount()
})

it('records while held, and throws away a press shorter than the shortest take', async () => {
  items = [item()]
  let now = 1_000
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
  app()
  fireEvent.click(await screen.findByRole('radio', { name: 'Hold to talk' }))
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
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_transcribe', { recordingId: 'recording-1' }))
  clock.mockRestore()
})

it('defaults audio time to left-to-right for an RTL phrase, while keeping the direction switch', async () => {
  script.direction = 'rtl'
  items = [item({ attempts: [attempt()] })]
  app()
  const toLeft = await screen.findByRole('radio', { name: '← Time' })
  expect(toLeft).toHaveAttribute('aria-checked', 'false')
  expect(document.querySelector('.drill-timelines')).toHaveAttribute('data-time', 'ltr')
  fireEvent.click(toLeft)
  expect(document.querySelector('.drill-timelines')).toHaveAttribute('data-time', 'rtl')
})

it('summarises the phrase across takes and names the word that keeps changing', async () => {
  const changed = (id: string, sequence: bigint) => attempt({ id, sequence })
  const exact = attempt({ id: 'attempt-3', sequence: 3n, comparison: { ...attempt().comparison, edits: 0, matchRatio: 1,
    words: attempt().comparison.words.map(word => ({ ...word, kind: 'same' as const, transcript: word.target })) } })
  items = [item({ attempts: [exact, changed('attempt-2', 2n), changed('attempt-1', 1n)] })]
  app()
  const summary = within(await screen.findByRole('region', { name: 'This phrase' }))
  expect(summary.getByText('Last 3 takes')).toBeVisible()
  const rows = summary.getAllByRole('button')
  expect(rows.map(row => row.getAttribute('aria-label'))).toEqual(['Take 3', 'Take 2', 'Take 1'])
  expect(rows[0]).toHaveAttribute('aria-pressed', 'true')
  expect(within(rows[0]).getByText('café')).toBeVisible()
  expect(rows[0].querySelector('.drill-word-row-cells')).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' })
  const detail = screen.getByRole('region', { name: 'Attempt 3' })
  expect(detail.compareDocumentPosition(screen.getByRole('region', { name: 'This phrase' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(rows[1])
  expect(rows[1]).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('region', { name: 'Attempt 2' })).toBeVisible()
  expect(summary.getByText('Most often different: café, in 2 of 3 takes.')).toBeVisible()
  expect(summary.getByRole('img', { name: 'Transcript match by take, oldest to newest: 94%, 94%, 100%' })).toBeVisible()
})

it('deletes one take, or clears the recent past, and reads the history again', async () => {
  items = [item({ attempts: [attempt({ id: 'attempt-2', sequence: 2n }), attempt()] })]
  const now = Date.parse('2026-09-23T15:00:00.000Z')
  const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
  app()
  const log = within(await screen.findByRole('complementary', { name: 'Attempts' }))
  fireEvent.click(await log.findByRole('button', { name: 'Delete take 1' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('delete_drill_attempt', { attemptId: 'attempt-1' }))
  await waitFor(() => expect(log.queryByRole('button', { name: /#1/ })).toBeNull())

  fireEvent.click(log.getByText('Clear takes…'))
  fireEvent.click(log.getByRole('button', { name: 'Last 5 minutes' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('clear_drill_attempts', { itemId: 'item-1', since: '2026-09-23T14:55:00.000Z' }))
  await waitFor(() => expect(log.queryByRole('region', { name: 'Attempt 2' })).toBeNull())
  clock.mockRestore()
})

it('keeps mobile practice focused and exposes the shared phrases and report on demand', async () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  items = [item({ attempts: [attempt({ id: 'attempt-2', sequence: 2n }), attempt()] }), second()]
  const view = app()
  await screen.findByRole('button', { name: /Full report/ })
  expect(screen.getByRole('region', { name: 'This phrase' })).toBeVisible()
  expect(screen.getByRole('img', { name: /Transcript match by take/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /^Take 2 ·/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: /^Take 1 ·/ }))
  expect(screen.getByRole('button', { name: /^Take 1 ·/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('complementary', { name: 'Your phrases' })).toBeNull()
  expect(screen.queryByRole('complementary', { name: 'Attempts' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Full report/ }))
  const report = await screen.findByRole('dialog', { name: 'Full report' })
  expect(within(report).getByRole('region', { name: 'Attempt 1' })).toBeVisible()
  fireEvent.click(within(report).getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: /Phrases/ }))
  const picker = await screen.findByRole('dialog', { name: 'Phrases' })
  fireEvent.click(within(picker).getByRole('button', { name: /^Hasta luego/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await screen.findByRole('button', { name: 'Stop recording' })
  expect(screen.getByRole('button', { name: 'Previous phrase' })).toBeDisabled()
  view.unmount()
})

it('dismisses a microphone error and its expanded diagnostics without hiding the recorder', async () => {
  items = [item()]
  const implementation = invoke.getMockImplementation()!
  invoke.mockImplementation(async (command, args) => {
    if (command === 'mic_start') throw new Error('Microphone test failure')
    return implementation(command, args)
  })
  app()
  const start = await screen.findByRole('button', { name: 'Start recording' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(start)
  const alert = await screen.findByRole('alert')
  expect(within(alert).getByText('Microphone test failure')).toBeVisible()
  fireEvent.click(within(alert).getByText('Response details'))
  fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss error' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('Response details')).toBeNull()
  expect(start).toBeEnabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(start)
  expect(await screen.findByRole('alert')).toHaveTextContent('Microphone test failure')
})

it('defaults to Auto and exposes the shared voice speed preference without opening settings', async () => {
  items = [item()]
  app()
  expect(await screen.findByRole('radio', { name: 'Auto-detect' })).toHaveAttribute('aria-checked', 'true')
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
  const native = invoke.getMockImplementation()!
  let finish!: () => void
  invoke.mockImplementation((command, args) => command === 'mic_transcribe'
    ? new Promise(resolve => { finish = () => { items = [item({ attempts: [attempt()] })]; resolve(transcription) } })
    : native(command, args))
  const view = app()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('radio', { name: 'Tap to record' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
  expect(screen.getByText('Transcribing…')).toBeVisible()
  const receipt = document.querySelector('[data-recording-id="recording-1"]')
  expect(receipt).not.toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(finish).toBeDefined())
  await act(async () => { finish() })
  await waitFor(() => expect(within(receipt as HTMLElement).getByText('94%')).toBeVisible())
  expect(document.querySelector('[data-recording-id="recording-1"]')).toBe(receipt)
  expect(screen.queryByText('Transcribing…')).toBeNull()
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
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hear it' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Hear it' }))
  const referenceStop = await screen.findByRole('button', { name: 'Stop' })
  expect(referenceStop).toBeEnabled()
  fireEvent.click(referenceStop)
  expect(referenceSignal.aborted).toBe(true)
  await screen.findByRole('button', { name: 'Hear it' })
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
  fireEvent.click(screen.getByLabelText('Recording settings'))
  const timeout = screen.getByRole('radiogroup', { name: 'Stop listening after silence of' })
  expect(within(timeout).getByRole('radio', { name: '10 s' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(within(timeout).getByRole('radio', { name: '15 s' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Recording settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_start', expect.objectContaining({ settings: expect.objectContaining({ silenceTimeoutMs: 15000 }) })))
  view.unmount()
})
