import { DEFAULT_APPEARANCE } from '../../generated/contracts'
// @vitest-environment jsdom
import { StrictMode } from 'react'
import userEvent from '@testing-library/user-event'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command, ConversationSnapshot, Receipt, Snapshot } from '../../generated/contracts'
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
  languages: () => [{ code: 'es', base: 'es', name: 'Spanish', endonym: 'Español' }, { code: 'en', base: 'en', name: 'English', endonym: 'English' }],
  languageFor: (code: string) => code === 'en' ? { code: 'en', name: 'English', endonym: 'English' } : { code: 'es', name: 'Spanish', endonym: 'Español' },
}))
vi.mock('../../platform/audio/reward-sounds', () => ({ configureRewardSounds: vi.fn(), stopRewardSounds: vi.fn() }))
vi.mock('./speech/useMicRecorder', () => ({ useMicRecorder: ({ onTranscribe }: { onTranscribe: (text: string) => void }) => { microphone.transcribe = onTranscribe; return { recording: false, transcribing: false, waveSource: null, toggleMic: vi.fn(), cancel: vi.fn() } } }))
vi.mock('./coaching/CoachAnalysisPanel', () => ({ CoachAnalysisPanel: ({ coachingContent, tab }: { coachingContent: React.ReactNode; tab: string }) => tab === 'lesson' ? coachingContent : null }))
vi.mock('./progress/RewardPresentation', () => ({ RewardPresentationProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('./progress/SkillRewards', () => ({ SkillRewards: () => null }))

import ConversationPage from './ConversationPage'
import { useConversation } from './session/useConversation'
import { useSettingsStore } from '../../state/settings/settings'
import { useSessionStore } from '../../state/session/session'

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
  target_variety: '',
  native_language: 'en', native_variety: 'en-US', interface_locale: 'en',
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
    learner: { id: 'learner', name: '', revision: 1, preferences: { appearance: { ...DEFAULT_APPEARANCE }, explanationVarietyId: 'en-US', interfaceLocale: 'en', targetVarieties: {}, theme: 'dark', explanationLanguage: 'en', textSize: 100, textSpacing: 2, highContrast: false, onboarding: 'completed' } },
    languages: [], languageProfiles: [], personas: [], contacts: [],
    conversations: ['a', 'b'].map((id, index) => ({
      id, contactId: 'contact', languageId: 'es', title: id, archived: false,
      revision: 7 + index, settingsRevision: 1, createdAt: '2026-09-10', lastUsed: 2 - index,
      settings: { difficulty: 'beginner', explanationLanguage: 'en', varietyId: '', explanationVarietyId: 'en-US', composingHelp: 'balanced', coachProactivity: 'on_request', translation: true, pronunciation: false, romanization: false, autoSend: true, readAloud: true, speechVoice: 'alloy' },
    })),
  }
}
function snapshot(id = 'a', revision = 1, text?: string): ConversationSnapshot {
  return {
    mystery: null, lessons: [], lessonChoices: [], opening: null, starterCards: [], revisionSuffixCounts: [], conversationId: id, sessionId: 'native-session', revision, hasOlder: false,
    messages: text === undefined ? [] : [{ coachDecision: null, wordGloss: null, glossState: null, glossError: null, glossOperationId: null, turnId: `${id}-turn`, replacesTurnId: null, replacedBy: null, id: `${id}-source`, sequence: 1, role: 'user', text, createdAt: '2026-09-10', translation: null, translationState: null }],
    turns: [], coachMessages: [], holds: [], transcriptionAttempts: [],
    connection: { route: 'hosted', signedIn: true, ownKeyConfigured: false, email: '', revision: 1, configured: true, standardModel: 'google/gemini-2.5-flash', fastModel: '', transcriptionModel: 'whisper-large-v3', paused: false },
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
  useSessionStore.setState(useSessionStore.getInitialState())
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
    expect(result.current.readError).toContain('Conversation snapshot scope mismatch.')
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
  return <ConversationPage nativePicker={null} mobileSurface="chat" active />
}
it('offers AI access settings alongside hosted sign-in on an unconfigured conversation', async () => {
  useSessionStore.setState({ connection: {
    route: 'custom', signedIn: false, ownKeyConfigured: false, email: '', revision: 1,
    configured: false, standardModel: 'standard', fastModel: 'fast', transcriptionModel: 'whisper-large-v3', paused: false,
  } })
  const openSettings = vi.fn()
  render(<ConversationPage nativePicker={null} mobileSurface="chat" active onOpenSettings={openSettings} />)
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(snapshot()))
  expect(screen.getByText('Choose how to connect to AI.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Or set up AI access in another way' }))
  expect(openSettings).toHaveBeenCalledOnce()
})
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
  const edit = screen.getByRole('button', { name: 'Edit message' })
  expect(edit).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit message' }))
  const composer = screen.getByPlaceholderText(/Write in/)
  expect(composer).toHaveValue('Yo fue ayer')
  fireEvent.change(composer, { target: { value: 'Yo fui ayer' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(screen.getByText('Edit saved — updating conversation…')).toBeVisible()
  expect(commands()[0].action).toEqual({ kind: 'reviseTurn', conversationId: 'a', turnId: 'a-turn', text: 'Yo fui ayer', expectedRevision: 31, input: { modality: 'text', suggestion: false, scaffold: false, revision: true } })
  const revised: ConversationSnapshot = { ...initial, revision: 32, messages: [
    ...initial.messages.map(message => ({ ...message, replacedBy: 'repair' })),
    { ...initial.messages[0], turnId: 'repair', replacesTurnId: 'a-turn', id: 'repair-user', sequence: 3, text: 'Yo fui ayer' },
    { ...initial.messages[1], turnId: 'repair', replacesTurnId: 'a-turn', id: 'repair-reply', sequence: 4, text: '¿Qué hiciste allí?' },
  ], revisionSuffixCounts: [{ turnId: 'repair', exchangeCount: 0, coachTurnCount: 0 }] }
  // The edited wording must replace the bubble as soon as native storage accepts
  // it, before a regenerated partner reply or word help has arrived.
  const pendingRevision = { ...revised, messages: revised.messages.filter(message => message.id !== 'repair-reply') }
  await act(async () => watches[1].resolve(pendingRevision))
  expect(screen.getAllByText('Yo fui ayer').some(element => element.closest('.msg.me'))).toBe(true)
  expect(screen.queryByText('Edit saved — updating conversation…')).not.toBeInTheDocument()
  expect(screen.queryByText('Yo fue ayer')).not.toBeInTheDocument()
  expect(screen.queryByText('¿Adónde fuiste?')).not.toBeInTheDocument()
  await waitFor(() => expect(watches).toHaveLength(3))
  await act(async () => watches[2].resolve({ ...revised, revision: 33 }))
  expect(screen.getAllByText('Yo fui ayer').some(element => element.closest('.msg.me'))).toBe(true)
  expect(screen.queryByText('Edit saved — updating conversation…')).not.toBeInTheDocument()
  expect(screen.queryByText('Yo fue ayer')).not.toBeInTheDocument()
  expect(screen.queryByText('Earlier version')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Edit message' })).toHaveLength(1)
})

it('confirms native suffix scope and retains the edit draft after a stale admission', async () => {
  submit = async () => { throw { code: 'conflict', message: 'Conversation changed; review the revision again.' } }
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(exchangeSnapshot(true)))
  fireEvent.click(screen.getByRole('button', { name: 'Edit message' }))
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
  expect(screen.getByRole('button', { name: 'Edit message' })).toBeDisabled()
})

it.each(['resolve', 'reject'] as const)('ignores late revision %s after switching conversations', async outcome => {
  const pending = deferred<Receipt>()
  submit = async command => command.action.kind === 'reviseTurn' ? pending.promise : { actionId: command.actionId, entityId: 'b', revision: 40 }
  let newChat: (() => void) | null = null
  render(<ConversationPage nativePicker={null} mobileSurface="chat" active onNewChatReady={action => { if (action) newChat = action }} />)
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(exchangeSnapshot()))
  fireEvent.click(screen.getByRole('button', { name: 'Edit message' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Edit message' }))
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  fireEvent.click(await screen.findByText('⚠ Request failed'))
  expect(screen.getByText('A partner reply is pending.')).toBeVisible()
  expect(screen.getByPlaceholderText(/Write in/)).toHaveValue('Yo fue ayer')
  expect(commands()).toHaveLength(1)
})

it('starts with a native card as a partner-first exchange while the composer remains usable', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const value = snapshot('a', 41)
  value.starterCards = [{ id: 'food', label: 'Ordering food', preview: 'Quiero café.', translation: 'I want coffee.', reason: 'From your focus' }]
  await act(async () => watches[0].resolve(value))
  expect(screen.getByPlaceholderText(/Write in/)).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: /Ordering food/ }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(commands()[0].action).toEqual({ kind: 'startConversation', conversationId: 'a', expectedRevision: 41, opening: { kind: 'starter', starterId: 'food' } })
  expect(screen.queryByText('¿Qué quieres beber?')).toBeNull()
  const response = snapshot('a', 42)
  response.messages = [{ ...exchangeSnapshot().messages[1], text: '¿Qué quieres beber?' }]
  await act(async () => watches[1].resolve(response))
  expect(within(document.querySelector('.msg.bot') as HTMLElement).getByText('¿Qué quieres beber?')).toBeVisible()
  expect(document.querySelector('.msg.me')).toBeNull()
})

it('shows a failed partner start without blocking the composer', async () => {
  submit = async () => { throw { code: 'conflict', message: 'This conversation already started.' } }
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(snapshot('a', 41)))
  fireEvent.click(screen.getByRole('button', { name: /Let .* start/ }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(commands()[0].action).toEqual({ kind: 'startConversation', conversationId: 'a', expectedRevision: 41, opening: { kind: 'surprise' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('This conversation already started.')
  expect(screen.getByPlaceholderText(/Write in/)).toBeEnabled()
})

it('persists Show answer through the real handler and renders only the returned native correction', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const value = exchangeSnapshot()
  value.messages[0].feedback = { meaningRecovered: 'full', items: [{ construct: 'past', quote: 'fue', outcome: 'partial', rationale: 'Past reference' }], candidatesSent: 18, itemsReturned: 1 }
  value.messages[0].coachDecision = { exposedMove: null, repairStatus: null, shown: { construct: 'past', quote: 'fue', move: 'hint', text: 'Which form goes with yo?' }, retryInvited: true, fixed: null, alsoNoticed: [], keptGoing: false }
  await act(async () => watches[0].resolve(value))
  fireEvent.click(screen.getByRole('button', { name: 'Coach feedback for message 1' }))
  await waitFor(() => expect(commands()).toHaveLength(1))
  expect(commands()[0].action).toEqual({ kind: 'coachControl', turnId: 'a-turn', control: 'open_card', expectedRevision: 31 })
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  const exposed = structuredClone(value)
  exposed.revision++
  exposed.messages[0].coachDecision!.exposedMove = 'hint'
  await act(async () => watches[1].resolve(exposed))
  expect(within(screen.getByRole('region', { name: 'Conversation coaching' })).getByText('Which form goes with yo?')).toBeVisible()
  expect(screen.queryByText('Yo fui ayer.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }))
  await waitFor(() => expect(commands()).toHaveLength(2))
  expect(commands()[1].action).toEqual({ kind: 'coachControl', turnId: 'a-turn', control: 'show_answer', expectedRevision: 32 })
  expect(screen.queryByText('Yo fui ayer.')).toBeNull()
  const next = structuredClone(exposed)
  next.revision++
  next.messages[0].coachDecision!.exposedMove = 'explicit'
  next.messages[0].coachDecision!.shown = { ...value.messages[0].coachDecision!.shown!, move: 'explicit', text: 'Yo fui ayer.' }
  await act(async () => watches[2].resolve(next))
  expect(within(screen.getByRole('region', { name: 'Conversation coaching' })).getByText('Yo fui ayer.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Show answer' })).toBeNull()
})

it('opens empty starter content at the top but scrolls real messages to the bottom', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const stream = document.querySelector<HTMLDivElement>('.stream')!
  Object.defineProperty(stream, 'scrollHeight', { value: 1500, configurable: true })
  stream.scrollTop = 300
  await act(async () => watches[0].resolve(snapshot()))
  expect(stream.scrollTop).toBe(0)
  await act(async () => watches[1].resolve(exchangeSnapshot()))
  expect(stream.scrollTop).toBe(1500)
})

it('hides starters after accepting an opening and surfaces failure without a learner bubble', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  const value = snapshot('a', 41)
  value.opening = { kind: 'surprise' }
  value.turns = [{ id: 'opening', replacesTurnId: null, replacedBy: null, route: 'hosted', state: 'pending', paused: false, hold: null, attempts: [], operations: [{ id: 'opening-operation', kind: 'persona_opening', state: 'ready', sourceMessageId: null, contractVersion: 1, dependencies: [], role: 'standard' }] }]
  await act(async () => watches[0].resolve(value))
  expect(screen.queryByRole('button', { name: /Let .* start/ })).toBeNull()
  expect(screen.getByLabelText('Conversation opening')).toHaveTextContent('Starting conversation')
  const paused = structuredClone(value)
  paused.revision++
  paused.connection.paused = true
  await act(async () => watches[1].resolve(paused))
  expect(screen.getByLabelText('Conversation opening')).toHaveTextContent('Conversation opening is paused.')
  expect(screen.getByLabelText('Conversation opening')).not.toHaveTextContent('Starting conversation')
  const resumed = structuredClone(paused)
  resumed.revision++
  resumed.connection.paused = false
  await act(async () => watches[2].resolve(resumed))
  expect(screen.getByLabelText('Conversation opening')).toHaveTextContent('Starting conversation')
  const failed = structuredClone(resumed)
  failed.revision++
  failed.turns[0].state = 'failed'
  failed.turns[0].hold = { code: 'credential', message: 'Opening provider refused access.', refusal: null }
  await act(async () => watches[3].resolve(failed))
  expect(screen.getByRole('alert')).toHaveTextContent('Opening provider refused access.')
  expect(screen.getByRole('button', { name: 'Open AI activity' })).toBeEnabled()
  expect(document.querySelector('.msg.me')).toBeNull()
})

it('keeps the committed contact selection after failed navigation and follows another opened contact', async () => {
  workspace.contacts = ['a', 'b', 'c'].map(id => ({ id: `contact-${id}`, learnerId: 'learner', personaId: `persona-${id}`, archived: false, revision: 1, createdAt: 'today' }))
  workspace.personas = ['a', 'b', 'c'].map(id => ({ id: `persona-${id}`, languageId: 'es', revision: 1, details: { name: id.toUpperCase(), vibe: [] } } as unknown as Snapshot['personas'][number]))
  workspace.conversations = ['a', 'b', 'c'].map((id, index) => ({ ...directory().conversations[0], id, contactId: `contact-${id}`, lastUsed: 3 - index }))
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].resolve(snapshot()))
  const partner = (name: string) => {
    if (!screen.queryByRole('menu', { name: 'Contacts' })) fireEvent.click(document.querySelector('.persona-picker-toggle')!)
    return screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) })
  }
  expect(partner('A')).toHaveAttribute('aria-checked', 'true')
  submit = async () => { throw new Error('Navigation refused') }
  fireEvent.click(partner('B'))
  await screen.findByText('Navigation refused')
  expect(partner('A')).toHaveAttribute('aria-checked', 'true')
  expect(partner('B')).toHaveAttribute('aria-checked', 'false')
  submit = async command => ({ actionId: command.actionId, entityId: 'accepted', revision: 11 })
  fireEvent.click(partner('B'))
  await waitFor(() => expect(watches.some(watch => watch.conversationId === 'b')).toBe(true))
  await act(async () => watches.find(watch => watch.conversationId === 'b')!.resolve(snapshot('b')))
  expect(partner('B')).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(partner('C'))
  await waitFor(() => expect(watches.some(watch => watch.conversationId === 'c')).toBe(true))
  await act(async () => watches.find(watch => watch.conversationId === 'c')!.resolve(snapshot('c')))
  expect(partner('C')).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(partner('B'))
  await waitFor(() => expect(commands().filter(command => command.action.kind === 'openConversation' && command.action.conversationId === 'b')).toHaveLength(3))
})

it('offers explicit read recovery in the chat without issuing inference', async () => {
  render(page())
  await waitFor(() => expect(watches).toHaveLength(1))
  await act(async () => watches[0].reject(new Error('Native read failed')))
  expect(screen.getByText(/Native read failed/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Retry reading conversation' }))
  await waitFor(() => expect(watches).toHaveLength(2))
  await act(async () => watches[1].resolve(exchangeSnapshot()))
  expect(screen.queryByText(/Native read failed/)).toBeNull()
  expect(commands()).toEqual([])
})
