// @vitest-environment jsdom
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command, ConversationSnapshot, Receipt, Snapshot } from '../../contracts'
import type { Settings } from '../../types'

const ipc = vi.hoisted(() => ({ invoke: vi.fn(), fault: vi.fn() }))
const microphone = vi.hoisted(() => ({ transcribe: (_text: string) => {} }))
const chrome = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: ipc.invoke }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: ipc.fault }))
vi.mock('../../platform/diagnostics/log', () => ({ logDiagnostic: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }))
// Only peripheral presentation/hardware is replaced. The page, controller,
// workspace command builder and native snapshot projection run unchanged.
vi.mock('../../platform/ipc/tauri', () => ({
  isTauri: true, getSettings: chrome.getSettings, saveSettings: chrome.saveSettings,
  languages: () => [{ base: 'es', endonym: 'Español' }, { base: 'en', endonym: 'English' }],
  languageFor: () => ({ endonym: 'Español' }),
}))
vi.mock('../../platform/audio/reward-sounds', () => ({ configureRewardSounds: vi.fn(), stopRewardSounds: vi.fn() }))
vi.mock('./useMicRecorder', () => ({ useMicRecorder: ({ onTranscribe }: { onTranscribe: (text: string) => void }) => { microphone.transcribe = onTranscribe; return { recording: false, transcribing: false, waveSource: null, toggleMic: vi.fn(), cancel: vi.fn() } } }))
vi.mock('./CoachAnalysisPanel', () => ({ CoachAnalysisPanel: () => null }))
vi.mock('./RewardPresentation', () => ({ RewardPresentationProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('./SkillRewards', () => ({ SkillRewards: () => null }))

import GuidedPage from './GuidedPage'
import { useConversation } from './useConversation'
import { useSettingsStore } from '../../state/settings'

const SETTINGS: Settings = {
  provider_mode: 'hosted',
  hosted_token: '',
  hosted_email: 'me@example.com',
  install_id: '',
  openrouter_key: '',
  custom_base_url: '',
  custom_api_key: '',
  custom_model: '',
  groq_key: '',
  openrouter_model: 'google/gemini-2.5-flash',
  observer_model: null,
  target_language: 'es',
  target_dialect: '',
  native_language: 'en',
  microphone_device_id: null,
  auto_speak: false,
  auto_send: false,
  always_romanize: false,
  auto_translate: false,
  always_pronunciation: false,
  text_size: 100,
  text_spacing: 2,
  fast_mode: true, reward_sounds: 'follow_tts',
  master_volume: 100, voice_volume: 100, effects_volume: 100,
  tts_rate: 1,
  shortcuts: { mic: 'ctrl+m', speak: 'ctrl+l', panel: 'ctrl+b', settings: 'ctrl+,' },
}


function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function directory(): Snapshot {
  return {
    sessionId: 'native-session', revision: 10,
    learner: { id: 'learner', name: '', revision: 1, preferences: { explanationLanguage: 'en', textSize: 100, textSpacing: 2, highContrast: false, onboarding: 'completed' } },
    languages: [], languageProfiles: [], personas: [], contacts: [],
    conversations: ['a', 'b'].map((id, index) => ({
      id, contactId: 'contact', languageId: 'es', title: id, archived: false,
      revision: 7 + index, settingsRevision: 1, createdAt: '2026-09-10', lastUsed: 2 - index,
      settings: { difficulty: 'beginner', explanationLanguage: 'en', varietyId: '', composingHelp: 'balanced', coachProactivity: 'on_request', translation: true, pronunciation: false, romanization: false, autoSend: true, readAloud: true, speechVoice: 'alloy' },
    })),
  }
}
function snapshot(id = 'a', revision = 1, text?: string): ConversationSnapshot {
  return {
    revisionSuffixCounts: [], conversationId: id, sessionId: 'native-session', revision, hasOlder: false,
    messages: text === undefined ? [] : [{ wordGloss: null, glossState: null, glossError: null, glossOperationId: null, turnId: `${id}-turn`, replacesTurnId: null, replacedBy: null, id: `${id}-source`, sequence: 1, role: 'user', text, createdAt: '2026-09-10', translation: null, translationState: null }],
    turns: [], coachMessages: [], holds: [], transcriptionAttempts: [],
    connection: { route: 'hosted', signedIn: true, ownKeyConfigured: false, email: '', revision: 1, configured: true, standardModel: 'google/gemini-2.5-flash', fastModel: '', paused: false },
  }
}
let workspace: Snapshot
let watches: Array<{ conversationId: string; afterRevision: number } & ReturnType<typeof deferred<ConversationSnapshot>>>
let submit: (command: Command) => Promise<Receipt>
const resetView = vi.fn()
const setHistoryOpen = vi.fn()
function useSubject(settings = SETTINGS) { return useConversation({ settings, resetView, setHistoryOpen }) }
function commands(): Command[] {
  return ipc.invoke.mock.calls.filter(([name]) => name === 'execute_command').map(([, args]) => args.command as Command)
}
beforeEach(async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  vi.clearAllMocks()
  localStorage.clear()
  workspace = directory()
  watches = []
  submit = async command => ({ actionId: command.actionId, entityId: 'accepted', revision: 11 })
  chrome.getSettings.mockResolvedValue(SETTINGS)
  chrome.saveSettings.mockResolvedValue(undefined)
  // The page reads settings from the store, so seed it the way startup does.
  // Test setup resets every store between tests, so this is the first load.
  await useSettingsStore.getState().load()
  ipc.invoke.mockImplementation((name: string, args?: { conversationId: string; afterRevision: number; command: Command }) => {
    if (name === 'get_snapshot') return Promise.resolve(workspace)
    if (name === 'watch_conversation') {
      const pending = { conversationId: args!.conversationId, afterRevision: args!.afterRevision, ...deferred<ConversationSnapshot>() }
      watches.push(pending)
      return pending.promise
    }
    if (name === 'execute_command') return submit(args!.command)
    throw new Error(`Unexpected native command: ${name}`)
  })
})

describe('native conversation ownership', () => {
  it('mount, StrictMode replay, preferences and remount observe without greeting or saving', async () => {
    const view = renderHook(({ settings }) => useSubject(settings), { initialProps: { settings: SETTINGS }, wrapper: StrictMode })
    await waitFor(() => expect(watches).toHaveLength(1))
    await act(async () => watches[0].resolve(snapshot()))
    await waitFor(() => expect(watches).toHaveLength(2))
    view.rerender({ settings: { ...SETTINGS, auto_translate: true, text_size: 140, always_pronunciation: true } })
    await act(async () => {})
    expect(watches).toHaveLength(2)
    view.unmount()
    renderHook(() => useSubject(), { wrapper: StrictMode })
    await waitFor(() => expect(watches).toHaveLength(3))
    expect(commands()).toEqual([])
    expect(new Set(ipc.invoke.mock.calls.map(([name]) => name))).toEqual(new Set(['get_snapshot', 'watch_conversation']))
  })

  it('Send uses fresh native session/revision once and waits for the durable snapshot', async () => {
    const { result } = renderHook(() => useSubject())
    await waitFor(() => expect(watches).toHaveLength(1))
    workspace = { ...workspace, sessionId: 'current-session', conversations: workspace.conversations.map(c => ({ ...c, revision: 42 })) }
    await act(async () => result.current.sendMessage('  Sí, 你好 👩🏽‍💻\n'))
    expect(commands()).toHaveLength(1)
    expect(commands()[0]).toEqual({ sessionId: 'current-session', actionId: expect.any(String), action: { kind: 'sendMessage', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, conversationId: 'a', expectedRevision: 42, text: '  Sí, 你好 👩🏽‍💻\n' } })
    expect(commands()[0].actionId).not.toBe('')
    expect(result.current.turns).toEqual([])
    await act(async () => watches[0].resolve(snapshot('a', 12, 'Durably accepted')))
    expect(result.current.turns[0].user).toBe('Durably accepted')
    expect(commands()).toHaveLength(1)
  })

  it('ignores an old watcher after explicit conversation switch', async () => {
    const { result } = renderHook(() => useSubject())
    await waitFor(() => expect(watches).toHaveLength(1))
    const old = watches[0]
    await act(async () => result.current.openChat('b'))
    await waitFor(() => expect(watches).toHaveLength(2))
    expect(commands().map(c => c.action)).toEqual([{ kind: 'openConversation', conversationId: 'b' }])
    await act(async () => watches[1].resolve(snapshot('b', 5, 'Current conversation')))
    await waitFor(() => expect(watches).toHaveLength(3))
    await act(async () => old.resolve(snapshot('a', 999, 'Stale result')))
    expect(result.current.currentChatId).toBe('b')
    expect(result.current.turns.map(t => t.user)).toEqual(['Current conversation'])
    expect(watches.filter(w => w.conversationId === 'a')).toHaveLength(1)
    expect(watches[2].afterRevision).toBe(5)
  })

  it.each(['resolve', 'reject'] as const)('ignores watcher %s after unmount without restarting it', async outcome => {
    const view = renderHook(() => useSubject())
    await waitFor(() => expect(watches).toHaveLength(1))
    view.unmount()
    await act(async () => {
      if (outcome === 'resolve') watches[0].resolve(snapshot('a', 99, 'Late'))
      else watches[0].reject(new Error('Late watch failure'))
    })
    expect(watches).toHaveLength(1)
    expect(commands()).toEqual([])
    expect(ipc.fault).not.toHaveBeenCalled()
  })

  it('rejects wrong-scope snapshots without publication or another watch', async () => {
    const { result } = renderHook(() => useSubject())
    await waitFor(() => expect(watches).toHaveLength(1))
    await act(async () => watches[0].resolve(snapshot('b', 7, 'Wrong owner')))
    expect(result.current.turns).toEqual([])
    expect(ipc.fault).toHaveBeenCalledWith('Reading conversation', 'Conversation snapshot scope mismatch.')
    expect(watches).toHaveLength(1)
    expect(commands()).toEqual([])
  })

  it('propagates Send failure without optimistic messages, saves or automatic retries', async () => {
    submit = async () => { throw new Error('Admission refused') }
    const { result } = renderHook(() => useSubject())
    await waitFor(() => expect(watches).toHaveLength(1))
    await act(async () => { await expect(result.current.sendMessage('Keep my draft')).rejects.toThrow('Admission refused') })
    expect(commands()).toHaveLength(1)
    expect(result.current.turns).toEqual([])
  })

  it('assisting does not block the next reply, but pending does', async () => {
    const { result } = renderHook(() => useSubject())
    await waitFor(() => expect(watches).toHaveLength(1))
    const assisting = snapshot()
    assisting.turns = [{ id: 'turn', replacesTurnId: null, replacedBy: null, route: 'hosted', state: 'assisting', paused: false, hold: null, operations: [], attempts: [] }]
    await act(async () => watches[0].resolve(assisting))
    expect(result.current.pendingReply).toBe(false)
    await act(async () => watches[1].resolve({ ...assisting, revision: 2, turns: [{ ...assisting.turns[0], state: 'pending' }] }))
    expect(result.current.pendingReply).toBe(true)
    expect(commands()).toEqual([])
  })
})

function page() {
  return <GuidedPage learningPicker={null} nativePicker={null} mobileSurface="chat" active />
}
describe('native composer admission', () => {
  it.each(['Enter', 'Send'])('types into the extracted composer and submits once with %s', async (action) => {
    const user = userEvent.setup()
    const pending = deferred<Receipt>()
    submit = () => pending.promise
    render(page())
    await waitFor(() => expect(watches).toHaveLength(1))
    const composer = await screen.findByPlaceholderText(/Write in/)
    await user.click(composer)
    await user.type(composer, 'Hola, ¿cómo estás?')
    expect(composer).toHaveFocus()
    expect(composer).toHaveValue('Hola, ¿cómo estás?')
    expect(commands()).toHaveLength(0)
    if (action === 'Enter') await user.keyboard('{Enter}')
    else await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(commands()).toHaveLength(1))
    expect(commands()[0].action).toEqual({ kind: 'sendMessage', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, conversationId: 'a', expectedRevision: 7, text: 'Hola, ¿cómo estás?' })
    await act(async () => pending.reject(new Error('Authentication failed')))
    expect(composer).toHaveValue('Hola, ¿cómo estás?')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(commands()).toHaveLength(1)
  })

  it('preserves a newer draft when an earlier Send fails', async () => {
    const pending = deferred<Receipt>()
    submit = () => pending.promise
    render(page())
    await waitFor(() => expect(watches).toHaveLength(1))
    const composer = await screen.findByPlaceholderText(/Write in/)
    fireEvent.change(composer, { target: { value: 'Earlier attempted message' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(commands()).toHaveLength(1))
    fireEvent.change(composer, { target: { value: 'New draft typed while waiting' } })
    await act(async () => pending.reject(new Error('Admission refused')))
    expect(composer).toHaveValue('New draft typed while waiting')
    expect(commands()).toHaveLength(1)
  })

  it('settings refresh and empty conversation hydration do not send an automatic greeting', async () => {
    render(page())
    await waitFor(() => expect(watches).toHaveLength(1))
    await act(async () => watches[0].resolve(snapshot()))
    chrome.getSettings.mockResolvedValue({ ...SETTINGS, auto_translate: true, text_size: 150 })
    // A settings write landed elsewhere: the revision moves and the page re-reads
    // through the store rather than through a prop it was handed.
    await act(async () => { await useSettingsStore.getState().refresh() })
    expect(useSettingsStore.getState().revision).toBe(1)
    expect(useSettingsStore.getState().settings?.text_size).toBe(150)
    expect(commands()).toEqual([])
    expect(chrome.saveSettings).not.toHaveBeenCalled()
  })

  it('submits one command and restores the draft after rejected Send', async () => {
    const pending = deferred<Receipt>()
    submit = () => pending.promise
    render(page())
    await waitFor(() => expect(watches).toHaveLength(1))
    const composer = await screen.findByPlaceholderText(/Write in/)
    fireEvent.change(composer, { target: { value: 'Keep this unsent text' } })
    const button = screen.getByRole('button', { name: 'Send' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(commands()).toHaveLength(1))
    await act(async () => pending.reject(new Error('Admission refused')))
    expect(composer).toHaveValue('Keep this unsent text')
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed')
    fireEvent.click(screen.getByText('⚠ Request failed'))
    expect(screen.getByText('Admission refused')).toBeVisible()
    expect(commands()[0].action).toEqual({ kind: 'sendMessage', input: { modality: 'text', suggestion: false, scaffold: false, revision: false }, conversationId: 'a', expectedRevision: 7, text: 'Keep this unsent text' })
    expect(commands()).toHaveLength(1)
  })
})

it('auto-sends one native transcript and retains a later transcript while a reply is pending', async () => {
  const pending = deferred<Receipt>()
  submit = () => pending.promise
  chrome.getSettings.mockResolvedValue({ ...SETTINGS, auto_send: true })
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const input = await screen.findByPlaceholderText(/Write in/)
  act(() => microphone.transcribe('Primera frase'))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(commands()[0].action).toMatchObject({ kind: 'sendMessage', text: 'Primera frase' })
  act(() => microphone.transcribe('Guardar esta frase'))
  expect(input).toHaveValue('Guardar esta frase')
  expect(commands()).toHaveLength(1)
  await act(async () => pending.reject(new Error('Rejected')))
  expect(input).toHaveValue('Guardar esta frase')
})

function exchangeSnapshot(earlier = false): ConversationSnapshot {
  const value = snapshot('a', 31, 'Yo fue ayer')
  value.messages.push({ ...value.messages[0], id: 'reply', sequence: 2, role: 'assistant', text: '¿Adónde fuiste?' })
  value.revisionSuffixCounts = [{ turnId: 'a-turn', exchangeCount: earlier ? 1 : 0, coachTurnCount: earlier ? 2 : 0 }]
  return value
}

it('edits through the real page handler, sends durable identity and renders retained wording', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const initial = exchangeSnapshot()
  await act(async () => watches[0].resolve(initial))
  const edit = screen.getByRole('button', { name: 'Edit this message and try again' })
  expect(edit).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit & try again' }))
  const composer = screen.getByPlaceholderText(/Write in/)
  expect(composer).toHaveValue('Yo fue ayer')
  fireEvent.change(composer, { target: { value: 'Yo fui ayer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(commands()[0].action).toEqual({ kind: 'reviseTurn', conversationId: 'a', turnId: 'a-turn', text: 'Yo fui ayer', expectedRevision: 31, input: { modality: 'text', suggestion: false, scaffold: false, revision: true } })
  const revised: ConversationSnapshot = { ...initial, revision: 32, messages: [
    ...initial.messages.map(message => ({ ...message, replacedBy: 'repair' })),
    { ...initial.messages[0], turnId: 'repair', replacesTurnId: 'a-turn', id: 'repair-user', sequence: 3, text: 'Yo fui ayer' },
    { ...initial.messages[1], turnId: 'repair', replacesTurnId: 'a-turn', id: 'repair-reply', sequence: 4, text: '¿Qué hiciste allí?' },
  ], revisionSuffixCounts: [{ turnId: 'repair', exchangeCount: 0, coachTurnCount: 0 }] }
  await act(async () => watches[1].resolve(revised))
  expect(screen.getByText('Yo fui ayer')).toBeVisible()
  const earlier = screen.getByText('Earlier version').closest('details')!
  expect(earlier).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('Earlier version'))
  expect(earlier).toHaveTextContent('Yo fue ayer')
  expect(earlier).toHaveTextContent('¿Adónde fuiste?')
  expect(screen.getAllByRole('button', { name: 'Edit this message and try again' })).toHaveLength(1)
})

it('confirms native suffix scope and retains the edit draft after a stale admission', async () => {
  submit = async () => { throw { code: 'conflict', message: 'Conversation changed; review the revision again.' } }
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(exchangeSnapshot(true)))
  fireEvent.click(screen.getByRole('button', { name: 'Edit this message and try again' }))
  const composer = screen.getByPlaceholderText(/Write in/)
  fireEvent.change(composer, { target: { value: 'Yo fui ayer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(screen.getByRole('dialog', { name: 'Revise earlier message' })).toHaveTextContent('1 later conversation turns and 2 private coach turns')
  expect(commands()).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Revise and remove later turns' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(composer).toHaveValue('Yo fui ayer')
  expect(await screen.findByRole('alert')).toHaveTextContent('Request failed')
  expect(commands()[0].action).toMatchObject({ expectedRevision: 31 })
})

it('disables editing while a native partner reply is pending', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const value = exchangeSnapshot()
  value.turns = [{ id: 'pending', replacesTurnId: null, replacedBy: null, route: 'hosted', state: 'pending', paused: false, hold: null, operations: [], attempts: [] }]
  await act(async () => watches[0].resolve(value))
  expect(screen.getByRole('button', { name: 'Edit this message and try again' })).toBeDisabled()
})

it.each(['resolve', 'reject'] as const)('ignores late revision %s after switching conversations', async outcome => {
  const pending = deferred<Receipt>()
  submit = async command => command.action.kind === 'reviseTurn' ? pending.promise : { actionId: command.actionId, entityId: 'b', revision: 40 }
  let newChat: (() => void) | null = null
  render(<GuidedPage learningPicker={null} nativePicker={null} mobileSurface="chat" active onNewChatReady={action => { if (action) newChat = action }} />)
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(exchangeSnapshot()))
  fireEvent.click(screen.getByRole('button', { name: 'Edit this message and try again' }))
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  await act(async () => newChat!())
  await waitFor(() => expect(watches.some(watch => watch.conversationId === 'b')).toBe(true))
  const composer = screen.getByPlaceholderText(/Write in/)
  fireEvent.change(composer, { target: { value: 'New conversation draft' } })
  await act(async () => outcome === 'resolve' ? pending.resolve({ actionId: 'revision', entityId: 'repair', revision: 41 }) : pending.reject(new Error('Old conversation failed')))
  expect(composer).toHaveValue('New conversation draft')
  expect(screen.queryByRole('alert')).toBeNull()
})

it('shows a raced native pending-turn rejection without dropping the repair draft', async () => {
  submit = async () => { throw { code: 'pending_turn', message: 'A partner reply is pending.' } }
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(exchangeSnapshot()))
  fireEvent.click(screen.getByRole('button', { name: 'Edit this message and try again' }))
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  fireEvent.click(await screen.findByText('⚠ Request failed'))
  expect(screen.getByText('A partner reply is pending.')).toBeVisible()
  expect(screen.getByPlaceholderText(/Write in/)).toHaveValue('Yo fue ayer')
  expect(commands()).toHaveLength(1)
})
