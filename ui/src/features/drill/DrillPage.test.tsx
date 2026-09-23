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
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('../../platform/audio/reading-speech', async () => ({ ...await vi.importActual('../../platform/audio/reading-speech'), speakSelection: speak }))
vi.mock('../../platform/audio/speech-player', () => ({ playSpeechAudio: play }))
vi.mock('../../platform/audio/speech', async () => {
  const actual = await vi.importActual<typeof import('../../platform/audio/speech')>('../../platform/audio/speech')
  return actual
})
vi.mock('../../platform/ipc/tauri', async () => ({
  languageFor: () => ({ languageTag: 'es', direction: 'ltr', romanization: null }),
  languages: () => [],
  isTauri: true,
}))
vi.mock('../../state/settings/settings', () => ({
  useSettingsStore: (select: (state: unknown) => unknown) => select({
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
  transcription = { text: 'quisiera un cafe', audioBase64: 'YXVkaW8=', diagnostics: null, inspection } as unknown as TranscriptionInspectionResult
  invoke.mockImplementation(async (command: string, args: Record<string, unknown>) => {
    switch (command) {
      case 'get_drill_items': return items
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
      case 'record_frontend_diagnostic': return
      default: throw new Error(`Unexpected native command: ${command}`)
    }
  })
  speak.mockImplementation(async (...args) => { const result = { audioBase64: 'cmVmZXJlbmNl', receipt: null }; await args[5]?.onAudio?.(result); return result })
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

it('takes a typed phrase, records an attempt against it, and scores what was said', async () => {
  app()
  await screen.findByText('Add a phrase to start practising.')
  fireEvent.change(screen.getByLabelText('Practise a phrase'), { target: { value: '  Quisiera un café.  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  // The phrase is listed, and shown through the shared target card.
  await screen.findByRole('button', { name: 'Delete “Quisiera un café.” and its attempts' })
  expect(screen.getByRole('button', { name: 'Hear it' })).toBeVisible()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_start', { owner: { kind: 'drillItem', id: 'item-1' } }))
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
  // Native completion publishes the attempt; the UI only reloads it.
  expect(invoke.mock.calls.some(([command]) => command === 'save_drill_attempt')).toBe(false)
  await within(await screen.findByRole('complementary', { name: 'Attempts' }, { timeout: 5000 }))
    .findByRole('button', { name: /94%/ }, { timeout: 5000 })
})

it('shows the measured comparison, the words that differed, and replays the attempt', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  // The newest attempt fills the panel without being asked for.
  await screen.findByRole('button', { name: 'Play yours' })
  expect(screen.getByText('Characters matching the target, after lowercase, strip_punctuation')).toBeVisible()
  // The measurement itself stays available under the summary.
  fireEvent.click(screen.getByText('Comparison details'))
  expect(screen.getByText('0.06')).toBeVisible()
  expect(screen.getByText('1 of 16 characters')).toBeVisible()
  expect(screen.getByText('lowercase, strip_punctuation')).toBeVisible()
  const words = within(screen.getByRole('list', { name: 'Word by word' }))
  // The target and what was heard sit together, with the outcome named in words.
  expect(words.getByText('cafe')).toBeVisible()
  expect(words.getByText('café')).toBeVisible()
  expect(words.getByText('letters differ')).toBeVisible()
  expect(words.getAllByText('same')).toHaveLength(2)

  await waitFor(() => expect(invoke).toHaveBeenCalledWith('get_drill_attempt_audio', { attemptId: 'attempt-1' }), { timeout: 5000 })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play yours' })).toBeEnabled(), { timeout: 5000 })
  fireEvent.click(screen.getByRole('button', { name: 'Play yours' }))
  expect(play).toHaveBeenCalledOnce()
  expect(play).toHaveBeenCalledWith(expect.anything(), expect.any(Function), expect.any(Function), 0.85, 0.15, undefined)
  // With no reference played yet, the panel says so instead of comparing one.
  expect(screen.getByText('Play the reference to compare it with this attempt.')).toBeVisible()
})

it('pairs the reference with the attempt once the reference has been heard', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  await screen.findByRole('button', { name: 'Play yours' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hear it' })) })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl' }), { timeout: 5000 })
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
  expect(await within(await screen.findByRole('complementary', { name: 'Attempts' })).findByRole('button', { name: /94%/ })).toBeVisible()
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
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-1', audioBase64: 'cmVmZXJlbmNl' }))
  // The learner moves on while the reference inspection is still being prepared.
  fireEvent.click(screen.getAllByRole('button').find(node => node.textContent?.startsWith('Hasta luego.'))!)
  expect((speak.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
  await act(async () => { release(inspection) })
  expect(invoke).not.toHaveBeenCalledWith('inspect_drill_audio', { itemId: 'item-2', audioBase64: 'cmVmZXJlbmNl' })
  expect(screen.queryByRole('slider', { name: 'Seek reference audio' })).toBeNull()
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
  expect(await screen.findByText('Ready to record')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
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

it('says when the recognizer returned no word timings instead of drawing any', async () => {
  items = [item({ attempts: [attempt()] })]
  app()
  expect(await screen.findByText('Word timings unavailable.', {}, { timeout: 5000 })).toBeVisible()
  expect(screen.queryByLabelText('Timed words')).not.toBeInTheDocument()
  expect(screen.queryByText('segment 2')).not.toBeInTheDocument()
})

it('calls an attempt exact only when the comparison needed no edits', async () => {
  const perfect = attempt({ id: 'attempt-2', sequence: 2n, transcript: 'Quisiera un café.',
    comparison: { ...attempt().comparison, edits: 0, characterErrorRate: 0, matchRatio: 1 } })
  items = [item({ attempts: [perfect, attempt()] })]
  app()
  const log = within(await screen.findByRole('complementary', { name: 'Attempts' }))
  const cards = await log.findAllByRole('button')
  expect(within(cards[0]).getByText('Exact')).toBeVisible()
  expect(within(cards[1]).queryByText('Exact')).not.toBeInTheDocument()
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
  expect(log.getAllByRole('button', { name: /#/ })).toHaveLength(10)
  expect(invoke).toHaveBeenCalledWith('drill_attempts', { itemId: 'item-1', cursor: null, limit: 20 })
  fireEvent.click(log.getByRole('button', { name: 'Show older attempts' }))
  await waitFor(() => expect(log.getAllByRole('button', { name: /#/ })).toHaveLength(15))
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
  await waitFor(() => expect(live).toHaveTextContent('Ready to record'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(live).toHaveTextContent('Recording'))
})

it('wires repeated takes, native cuts and live spectra into the real Drill page', async () => {
  items = [item()]
  const native = invoke.getMockImplementation()!
  const take = { recordingId: 'take-1', number: 1, startSeconds: 0, endSeconds: 1, cutSeconds: 1.6, state: 'processing', failure: null }
  const status = { recordingId: 'listening-1', listening: true, speaking: false, queued: 0, processing: true, completed: 0, failure: null, takes: [take] }
  invoke.mockImplementation(async (command, args) => {
    if (command === 'mic_listen_start') return { recordingId: 'listening-1', samplesPerSecond: 689, browserCapture: false }
    if (command === 'mic_listen_status') return status
    if (command === 'mic_listen_spectrogram') return args.afterSeconds === null ? { data: inspection.spectrogram, endSeconds: 2 } : null
    if (command === 'mic_listen_discard') return
    if (command === 'mic_listen_stop') { status.listening = false; return }
    return native(command, args)
  })
  app()
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Repeat with pauses (desktop)' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Pause between takes' }), { target: { value: '600' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_start', { owner: { kind: 'drillItem', id: 'item-1' }, pauseMs: 600 }))
  expect(await screen.findByText('Take 1 clipped →')).toBeVisible()
  expect(await screen.findByText('Transcribing…')).toBeVisible()
  expect(document.querySelector('.live-take-region')).not.toBeNull()
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_spectrogram', { recordingId: 'listening-1', afterSeconds: null }))
  expect(screen.getByRole('checkbox', { name: 'Repeat with pauses (desktop)' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Hear it' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Discard current take' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_discard', { recordingId: 'listening-1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_listen_stop', { recordingId: 'listening-1' }))
  items = [item({ attempts: [attempt({ transcriptionAttemptId: 'take-1' })] })]
  status.processing = false; status.completed = 1; take.state = 'completed'
  expect(await within(screen.getByRole('complementary', { name: 'Attempts' })).findByRole('button', { name: /94%/ })).toBeVisible()
  expect(screen.queryByText('Transcribing…')).toBeNull()
  expect(invoke.mock.calls.some(([command]) => command === 'mic_start')).toBe(false)
})

it('shows reference audio before an attempt and seeks the actual player clock', async () => {
  items = [item()]
  const seek = vi.fn()
  speak.mockImplementation(async (...args) => {
    await args[5].onAudio({ audioBase64: 'cmVmZXJlbmNl', receipt: null })
    args[5].onReady({ seek })
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
