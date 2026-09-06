// @vitest-environment jsdom
//
// The conversation lifecycle: which chat is on screen, when a greeting fires,
// and what gets saved where. This is the layer every recent frontend bug lived
// in — greeting over a restored conversation, reloading mid-edit and clobbering
// unsaved turns, saving one conversation under another's name — and none of it
// is reachable from a pure-function test.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Settings, StoredTurn } from '../types'

// ── The whole backend is one module, so it is one mock ──────────────────────
// `vi.hoisted` because vi.mock factories are lifted above ordinary consts.
const backend = vi.hoisted(() => ({
  invoke: vi.fn(),
  rawInvoke: vi.fn(),
  getSettings: vi.fn(),
  loadConversation: vi.fn(),
  openConversation: vi.fn(),
  listConversations: vi.fn(),
  saveConversation: vi.fn(),
  newConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getPlan: vi.fn(),
  // The chrome watches the trace buses to know when agents are running.
  // Unsubscribes, so the hook can tear down cleanly.
  subscribeRunStarts: vi.fn(async () => () => {}),
  subscribeRuns: vi.fn(async () => () => {}),
  saveSettings: vi.fn(),
  // The partner picker asks the core who the learner can talk to. `faults`
  // travels with the list: an unreadable personas file must reach the screen.
  listPersonas: vi.fn(
    async (): Promise<{
      personas: { id: string; label: string; sketch: string; builtin: boolean }[]
      faults: string[]
    }> => ({ personas: [], faults: [] })
  ),
  savePersona: vi.fn(),
  deletePersona: vi.fn(),
  languages: vi.fn(),
  languageFor: vi.fn(),
}))

vi.mock('../lib/tauri', () => ({
  isTauri: true,
  invoke: (...a: unknown[]) => backend.invoke(...a),
  ...Object.fromEntries(
    Object.entries(backend).map(([name, fn]) => [name, (...a: unknown[]) => fn(...a)])
  ),
}))

// Anything that reaches for real browser hardware or a real IPC channel.
vi.mock('@tauri-apps/api/core', () => ({
  // GuidedPage reaches for the Tauri package directly for `guided_turn` and
  // `generate_scaffolds` rather than going through lib/tauri, so this is the
  // spy those calls land on.
  invoke: (...a: unknown[]) => backend.rawInvoke(...a),
  Channel: class {
    onmessage: unknown = null
  },
}))
vi.mock('../lib/speech', () => ({
  isSpeaking: () => false,
  loadVoices: async () => [],
  speakSmart: async () => undefined,
  speechSupported: () => false,
  ttsAvailable: () => false,
  stopSpeaking: vi.fn(),
  subscribeSpeaking: () => () => {},
  subscribeSpeechProgress: () => () => {},
  setPlaybackRate: vi.fn(),
}))
const microphone = vi.hoisted(() => ({ recording: false, waveSource: null, toggleMic: vi.fn(), cancel: vi.fn() }))
vi.mock('../hooks/useMicRecorder', () => ({ useMicRecorder: () => microphone }))
// Heavy panes that pull in the graph view; not what these tests are about.
vi.mock('../components/dev/DevPanel', () => ({ DevPanel: () => null }))
vi.mock('../components/panes/CoachAnalysisPanel', () => ({ CoachAnalysisPanel: () => <div /> }))

import GuidedPage from './GuidedPage'
import { useConversation } from './guided/useConversation'
import { armGreeting, disarmGreeting } from '../hooks/useSteering'

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
  target_language: 'es-ES',
  target_dialect: '',
  native_language: 'en',
  microphone_device_id: null,
  auto_speak: false,
  auto_send: false,
  always_romanize: false,
  auto_translate: false,
  tts_engine: 'cloud',
  tts_voice: 'nova',
  tts_rate: 1,
  shortcuts: { mic: 'ctrl+m', speak: 'ctrl+l', panel: 'ctrl+b', settings: 'ctrl+,' },
}

const turn = (id: number, user: string): StoredTurn => ({
  id,
  user,
  assistant: {
    reply: 'Hola.',
    translation: null,
    tokens: [],
    user_tokens: [],
    user_translation: null,
    mechanics: [],
    scaffolds: { replies: [], frames: [], starters: [] },
    errors: [],
  },
  analysisState: 'done',
})

beforeEach(() => {
  vi.clearAllMocks()
  microphone.recording = false
  localStorage.clear()
  // The greeting fires once per session; each test starts fresh.
  disarmGreeting()
  backend.invoke.mockImplementation(async (command: string) => command === 'get_conversation_partner'
    ? { persona: BAKER, introduction: 'Soy Carmen. Vivo en Valencia.', origin: 'new_chat' } : '')
  backend.rawInvoke.mockResolvedValue('')
  backend.getSettings.mockResolvedValue(SETTINGS)
  backend.getPlan.mockResolvedValue({
    plan: {
      session_focus: [],
      recurring_errors: [],
      vocab_recycle: [],
      avoid: [],
      learner_interests: [],
      energy_read: '',
      correction_budget: 1,
      taught_ledger: [],
    },
    profile: {
      about: '',
      level_notes: '',
      strengths: [],
      weaknesses: [],
      interests: [],
      long_term_errors: [],
    },
  })
  backend.listConversations.mockResolvedValue([])
  backend.saveConversation.mockResolvedValue(undefined)
  backend.languages.mockReturnValue([{ base: 'en', endonym: 'English' }])
  backend.languageFor.mockReturnValue({ endonym: 'Español' })
  backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [] })
})

describe('opening the app', () => {
  it('saves the selected voice speed without reopening the conversation', async () => {
    backend.saveSettings.mockResolvedValue(undefined)
    backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [turn(1, 'Hola')] })
    render(<GuidedPage />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalledTimes(1))
    const speed = screen.getByLabelText('Voice playback speed')
    expect(screen.getByRole('group', { name: 'Reading and voice options' })).toContainElement(speed)
    fireEvent.change(speed, { target: { value: '0.5' } })
    await waitFor(() => expect(backend.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ tts_rate: 0.5 })))
    expect(backend.loadConversation).toHaveBeenCalledTimes(1)
  })
  it('puts a stored conversation back on screen', async () => {
    backend.loadConversation.mockResolvedValue({
      id: 'chat-1',
      turns: [turn(1, 'Hola, quiero practicar')],
    })
    render(<GuidedPage />)
    await waitFor(() => {
      expect(screen.getByText('Hola, quiero practicar')).toBeInTheDocument()
    })
  })

  it('does not greet over a conversation it just restored', async () => {
    // Greeting on top of restored turns both duplicates the opening and makes
    // it look like nothing was kept.
    backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [turn(1, 'Hola')] })
    render(<GuidedPage />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalled())
    // A greeting would consume the once-per-session flag; it must still be there.
    await new Promise((r) => setTimeout(r, 50))
    expect(armGreeting()).toBe(false)
  })

  it('greets when the conversation is empty', async () => {
    // The greeting is how an empty conversation opens. Nothing else asserts
    // it fires, which is how a refactor that left the greet callback unwired
    // slipped past the type checker.
    backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [] })
    render(<GuidedPage />)
    await waitFor(() => {
      const call = backend.rawInvoke.mock.calls.find((c) => c[0] === 'guided_turn')
      expect(call, 'no guided_turn was issued for the empty conversation').toBeTruthy()
      expect((call![1] as { greeting: boolean }).greeting).toBe(true)
    })
  })

  it('asks for the conversation belonging to the current pairing', async () => {
    render(<GuidedPage />)
    await waitFor(() => {
      expect(backend.loadConversation).toHaveBeenCalledWith('es-ES', 'en', 'surprise')
    })
  })

  it('loads the chat list so the drawer has something to show', async () => {
    render(<GuidedPage />)
    await waitFor(() => {
      expect(backend.listConversations).toHaveBeenCalledWith('es-ES', 'en')
    })
  })
})

const BAKER = {
  id: 'baker',
  label: 'The night-shift baker',
  sketch: "You bake bread overnight and your neighbour's dog howls when you sleep.",
  builtin: true,
}

describe('who the learner is talking to', () => {
  it('selects a template only when opening a chat and sends only chat ownership with each turn', async () => {
    backend.loadConversation.mockResolvedValue({ id: 'chat-7', turns: [] })
    render(<GuidedPage />)
    await waitFor(() => {
      const call = backend.rawInvoke.mock.calls.find((c) => c[0] === 'guided_turn')
      expect(call).toBeTruthy()
      const body = call![1] as { persona: string; chatId: string }
      expect(body).not.toHaveProperty('persona')
      expect(backend.loadConversation).toHaveBeenCalledWith('es-ES', 'en', 'surprise')
      expect(body.chatId).toBe('chat-7')
    })
  })

  it('offers the partners the core actually has, not a list of its own', async () => {
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
    render(<GuidedPage />)
    const picker = await screen.findByLabelText('Partner:')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'The night-shift baker' })).toBeInTheDocument()
    )
    // "Surprise me" is not one of the core's personas — it is the absence of a
    // choice, and the picker supplies it.
    expect(picker).toHaveValue('__current__')
  })

  it('starts a new conversation when the partner changes', async () => {
    // You cannot be mid-sentence with someone and have them become somebody
    // else. The old chat is archived, not lost.
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
    backend.newConversation.mockResolvedValue('chat-2')
    render(<GuidedPage />)
    const picker = await screen.findByLabelText('Partner:')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'The night-shift baker' })).toBeInTheDocument()
    )

    fireEvent.change(picker, { target: { value: 'baker' } })

    await waitFor(() => expect(backend.newConversation).toHaveBeenCalledWith('es-ES', 'en', 'baker'))
    expect(localStorage.getItem('skellyspeak_persona')).toBe('baker')
  })

  it('shows the saved partner independently of a deleted global preference', async () => {
    // The current chat owns its identity even if the future-chat preference is stale.
    localStorage.setItem('skellyspeak_persona', 'deleted-one')
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
    render(<GuidedPage />)
    const picker = await screen.findByLabelText('Partner:')
    await waitFor(() => expect(picker).toHaveValue('__current__'))
  })

  it('surfaces an unreadable personas file instead of losing it quietly', async () => {
    // Hand-written characters. "They are just gone" with no reason is the
    // failure this guards.
    backend.listPersonas.mockResolvedValue({
      personas: [BAKER],
      faults: ['Your saved personas could not be read. Nothing was deleted.'],
    })
    render(<GuidedPage />)
    // The fault bar itself lives in App; what this pins is that the fault
    // leaves the persona code at all rather than being logged and forgotten.
    const { subscribeFaults } = await import('../lib/faults')
    const seen: { message: string }[] = []
    subscribeFaults((f) => seen.push(...f))
    await waitFor(() =>
      expect(seen.some((f) => f.message.includes('could not be read'))).toBe(true)
    )
  })
})

describe('the persona panel', () => {
  beforeEach(() => {
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
  })

  async function openPanel() {
    render(<GuidedPage />)
    fireEvent.click(await screen.findByLabelText('Open the persona panel'))
    return screen.findByRole('dialog', { name: 'Personas' })
  }

  it('shows the description that is actually sent to the model', async () => {
    // Not a paraphrase: the sketch in the panel is the text the reply prompt
    // is built from, which is the only reason reading it is worth anything.
    await openPanel()
    expect((await screen.findAllByText(/You bake bread overnight/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Soy Carmen. Vivo en Valencia.')).toBeInTheDocument()
  })

  it('refuses to let a built-in be edited, and offers a copy instead', async () => {
    await openPanel()
    await screen.findAllByText(/You bake bread overnight/)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Duplicate/ }))

    // The fork arrives in the editor unsaved, carrying the original's words.
    const name = screen.getByPlaceholderText('My uncle Kiko') as HTMLInputElement
    expect(name.value).toBe('The night-shift baker (mine)')
  })

  it('saves a persona the learner wrote and puts it in the picker', async () => {
    backend.savePersona.mockImplementation(async (_id: string, label: string, sketch: string) => {
      // A save changes what the core has, so the next list includes it.
      backend.listPersonas.mockResolvedValue({
        personas: [BAKER, { id: 'my-uncle', label, sketch, builtin: false }],
        faults: [],
      })
      return { id: 'my-uncle', label, sketch, builtin: false }
    })
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: /Write your own/ }))
    fireEvent.change(screen.getByPlaceholderText('My uncle Kiko'), {
      target: { value: 'My uncle' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Who they are/ }), {
      target: { value: 'You drive a taxi and are convinced the radio is lying to you.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save persona' }))

    await waitFor(() => expect(backend.savePersona).toHaveBeenCalled())
    // Persisted through the core, not held in the component: it is in the
    // PICKER because the list was re-read, which is what makes it survive a
    // reload. Scoped to the select — the panel's own list uses the option role
    // too, and finding it only there would prove nothing about the picker.
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Partner:')).getByRole('option', { name: /My uncle/ })
      ).toBeInTheDocument()
    )
  })

  it('says what is wrong with a description too thin to be a person', async () => {
    // The core rejects it. The message belongs next to the field, not in the
    // fault bar at the top of the app.
    backend.savePersona.mockRejectedValue(new Error('The description is too short to be a person'))
    await openPanel()
    fireEvent.click(screen.getByRole('button', { name: /Write your own/ }))
    fireEvent.change(screen.getByPlaceholderText('My uncle Kiko'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save persona' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too short to be a person/)
  })
})

describe('the suggestions panel', () => {
  it('folds suggestions independently from settings', async () => {
    render(<GuidedPage />)
    const toggle = await screen.findByTitle('Hide suggestions')
    expect(await screen.findByLabelText('Learner level')).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(screen.getByLabelText('Learner level')).toBeInTheDocument()
    expect(screen.getByTitle('Show suggestions')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Hide chat settings'))
    expect(screen.queryByLabelText('Learner level')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Show suggestions'))
    expect(screen.getByTitle('Show chat settings')).toBeInTheDocument()
    expect(localStorage.getItem('skellyspeak_chat_settings')).toBe('closed')
    expect(localStorage.getItem('skellyspeak_scaffolds')).toBe('open')
  })

  it('says what is folded away, so the steering is never invisible', async () => {
    // Level and topic steer every reply. Hidden AND unstated, they become
    // settings that silently change the conversation.
    render(<GuidedPage />)
    fireEvent.click(await screen.findByTitle('Hide chat settings'))
    expect(screen.queryByLabelText('Learner level')).not.toBeInTheDocument()
    expect(screen.getByText(/any topic/)).toBeInTheDocument()
  })
})

describe('a settings edit', () => {
  it('does not reload the conversation', async () => {
    // `settingsVersion` bumps on EVERY autosave keystroke in the Settings
    // modal. Reloading here would drop turns that had not been saved yet.
    const view = render(<GuidedPage settingsVersion={0} />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalledTimes(1))

    view.rerender(<GuidedPage settingsVersion={1} />)
    view.rerender(<GuidedPage settingsVersion={2} />)
    await new Promise((r) => setTimeout(r, 50))

    expect(backend.loadConversation).toHaveBeenCalledTimes(1)
  })

  it('reloads the conversation when the language actually changes', async () => {
    const view = render(<GuidedPage settingsVersion={0} />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalledWith('es-ES', 'en', 'surprise'))

    backend.getSettings.mockResolvedValue({ ...SETTINGS, target_language: 'ar' })
    view.rerender(<GuidedPage settingsVersion={1} />)

    await waitFor(() => {
      expect(backend.loadConversation).toHaveBeenCalledWith('ar', 'en', 'surprise')
    })
  })

  it('treats a dialect change as the same conversation', async () => {
    // Levantine and MSA are a setting on one conversation, not two.
    const view = render(<GuidedPage settingsVersion={0} />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalledTimes(1))

    backend.getSettings.mockResolvedValue({ ...SETTINGS, target_dialect: 'ar-LE' })
    view.rerender(<GuidedPage settingsVersion={1} />)
    await new Promise((r) => setTimeout(r, 50))

    expect(backend.loadConversation).toHaveBeenCalledTimes(1)
  })
})

describe('when the backend refuses', () => {
  it('surfaces a failure to restore instead of showing an empty chat', async () => {
    backend.loadConversation.mockRejectedValue(new Error('session.json is unreadable'))
    render(<GuidedPage />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalled())
    // reportFault puts it on the fault bar; the point is that it is not
    // swallowed into a silently blank conversation.
    const { subscribeFaults } = await import('../lib/faults')
    const seen: unknown[] = []
    subscribeFaults((f) => seen.push(...f))
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
  })
})


describe('steering the conversation', () => {
  it('opens the selected topic without generating suggestions from the old exchange', async () => {
    // A steering turn owns the reply and its suggestions as one pipeline.
    const user = userEvent.setup()
    render(<GuidedPage />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalled())

    // Changing the topic must not generate suggestions from the old history.
    await user.selectOptions(screen.getByLabelText('Conversation topic'), 'Food & cooking')

    await waitFor(
      () => {
        const call = backend.rawInvoke.mock.calls.find((c) => c[0] === 'guided_turn' && (c[1] as { steering?: string }).steering)
        expect(call).toBeTruthy()
        expect((call![1] as { topic: string }).topic).toBe('Food & cooking')
        expect(backend.rawInvoke.mock.calls.some((c) => c[0] === 'generate_scaffolds')).toBe(false)
      },
      { timeout: 2000 }
    )
  })
})


describe('a failure that names Settings', () => {
  const SIGN_IN =
    'Sign in to use the free hosted service, or choose a different AI provider, in Settings.'

  it('offers a way straight there', async () => {
    // Telling someone to go to Settings and making them find the gear is a
    // dead end dressed as an instruction.
    const onOpenSettings = vi.fn()
    backend.rawInvoke.mockRejectedValue(new Error(SIGN_IN))
    const user = userEvent.setup()
    render(<GuidedPage onOpenSettings={onOpenSettings} />)

    const button = await screen.findByRole('button', { name: 'Open Settings' })
    await user.click(button)
    expect(onOpenSettings).toHaveBeenCalled()
    expect(screen.getByText(SIGN_IN)).toBeInTheDocument()
  })

  it('does not offer it for a failure Settings cannot fix', async () => {
    backend.rawInvoke.mockRejectedValue(
      new Error('The tutor hit a rate limit — give it a few seconds and try again.')
    )
    render(<GuidedPage onOpenSettings={vi.fn()} />)
    await screen.findByText(/rate limit/)
    expect(screen.queryByRole('button', { name: 'Open Settings' })).not.toBeInTheDocument()
  })
})

describe('conversation ownership under delayed operations', () => {
  it('flushes before deletion and never saves the deleted chat afterward', async () => {
    backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [turn(1, 'Keep this history')] })
    backend.newConversation.mockResolvedValue('chat-2')
    const { result } = renderHook(() => useConversation({ persona: 'surprise', settings: SETTINGS, sending: false,
      setHistoryOpen: vi.fn(), greet: vi.fn(), resetView: vi.fn() }))
    await waitFor(() => expect(result.current.currentChatId).toBe('chat-1'))
    let finishSave!: () => void
    backend.saveConversation.mockImplementationOnce(() => new Promise<void>((resolve) => { finishSave = resolve }))
    let removal!: Promise<void>
    act(() => { removal = result.current.removeChat('chat-1') })
    await waitFor(() => expect(backend.saveConversation).toHaveBeenCalled())
    expect(backend.deleteConversation).not.toHaveBeenCalled()
    await act(async () => { finishSave(); await removal })
    expect(backend.deleteConversation).toHaveBeenCalledWith('es-ES', 'en', 'chat-1')
    expect(result.current.currentChatId).toBe('chat-2')
    const deletedAt = backend.deleteConversation.mock.invocationCallOrder[0]
    backend.saveConversation.mock.calls.forEach((args, index) => {
      if (args[2] === 'chat-1') expect(backend.saveConversation.mock.invocationCallOrder[index]).toBeLessThan(deletedAt)
    })
  })

  it('ignores a late load from another language pair', async () => {
    let finishSpanish!: (value: { id: string; turns: StoredTurn[] }) => void
    backend.loadConversation.mockImplementation((target: string) => target === 'es-ES'
      ? new Promise((resolve) => { finishSpanish = resolve })
      : Promise.resolve({ id: 'arabic', turns: [turn(9, 'Arabic conversation')] }))
    const { result, rerender } = renderHook(({ settings }) => useConversation({ persona: 'surprise', settings, sending: false,
      setHistoryOpen: vi.fn(), greet: vi.fn(), resetView: vi.fn() }), { initialProps: { settings: SETTINGS } })
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalledWith('es-ES', 'en', 'surprise'))
    rerender({ settings: { ...SETTINGS, target_language: 'ar' } })
    await waitFor(() => expect(result.current.currentChatId).toBe('arabic'))
    await act(async () => { finishSpanish({ id: 'spanish', turns: [turn(1, 'Spanish conversation')] }) })
    expect(result.current.currentChatId).toBe('arabic')
    expect(result.current.turns[0].user).toBe('Arabic conversation')
  })
})

it('keeps the primary recording control immediately before Send when Discard appears', async () => {
  backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [turn(1, 'Hola')] })
  const { rerender } = render(<GuidedPage />)
  const record = await screen.findByRole('button', { name: 'Record audio' })
  const send = screen.getByRole('button', { name: 'Send' })
  expect(record.nextElementSibling).toBe(send)
  fireEvent.click(record)
  microphone.recording = true
  rerender(<GuidedPage />)
  const stop = screen.getByRole('button', { name: /Stop and (send|transcribe) recording/ })
  expect(stop).toBe(record)
  expect(stop.nextElementSibling).toBe(send)
  expect(stop.previousElementSibling).toBe(screen.getByRole('button', { name: 'Discard recording' }))
  fireEvent.click(stop)
  expect(microphone.toggleMic).toHaveBeenCalledTimes(2)
  expect(microphone.cancel).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Discard recording' }))
  expect(microphone.cancel).toHaveBeenCalledTimes(1)
})

it.each(['new', 'reopened'] as const)('does not send another chat’s history into a %s empty chat greeting', async (kind) => {
  backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [turn(1, 'Old conversation')] })
  backend.newConversation.mockResolvedValue('chat-2')
  backend.openConversation.mockResolvedValue({ id: 'chat-2', turns: [] })
  const seenHistory: StoredTurn[][] = []
  const { result } = renderHook(() => useConversation({ persona: 'surprise', settings: SETTINGS, sending: false,
    setHistoryOpen: vi.fn(), resetView: vi.fn(),
    greet: () => { seenHistory.push([...result.current.turnsRef.current]) },
  }))
  await waitFor(() => expect(result.current.currentChatId).toBe('chat-1'))
  await act(async () => { if (kind === 'new') await result.current.startNew('surprise'); else await result.current.openChat('chat-2') })
  expect(seenHistory).toEqual([[]])
})

it('sends the established partner introduction as assistant history alongside the learner message', async () => {
  const greeting: StoredTurn = { ...turn(1, ''), user: null }
  greeting.assistant!.reply = 'Soy Carmen. Vivo cerca de Valencia.'
  backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [greeting] })
  render(<GuidedPage />)
  await screen.findByText('Soy Carmen. Vivo cerca de Valencia.')
  fireEvent.change(screen.getByPlaceholderText(/Write in/), { target: { value: 'Soy Juan. ¿Y tus geranios?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(backend.rawInvoke).toHaveBeenCalledWith('guided_turn', expect.objectContaining({
    chatId: 'chat-1', message: 'Soy Juan. ¿Y tus geranios?', greeting: false,
    history: [{ role: 'assistant', content: 'Soy Carmen. Vivo cerca de Valencia.' }],
  })))
})

it('keeps template selection reachable when a chat cannot initialize', async () => {
  backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
  backend.loadConversation.mockRejectedValue(new Error('The selected persona no longer exists.'))
  backend.newConversation.mockResolvedValue('replacement-chat')
  render(<GuidedPage />)
  const picker = await screen.findByLabelText('Partner:')
  expect(picker).toHaveValue('__choose__')
  fireEvent.change(picker, { target: { value: 'baker' } })
  await waitFor(() => expect(backend.newConversation).toHaveBeenCalledWith('es-ES', 'en', 'baker'))
  await waitFor(() => expect(screen.getByLabelText('Partner:')).toHaveValue('__current__'))
})

it('shows recovered identity separately from the template library', async () => {
  backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
  backend.invoke.mockImplementation(async (command: string) => command === 'get_conversation_partner'
    ? { persona: { id: '__legacy__', label: 'Partner from saved conversation', sketch: 'Preserve the saved identity.', builtin: false }, introduction: 'Soy Carmen. Vivo en Valencia.', origin: 'recovered_history' } : '')
  render(<GuidedPage />)
  fireEvent.click(await screen.findByLabelText('Open the persona panel'))
  expect(await screen.findByText('Soy Carmen. Vivo en Valencia.')).toBeInTheDocument()
  expect(screen.getByText(/Recovered from the earliest saved reply/)).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'The night-shift baker', selected: true })).toBeInTheDocument()
  expect(backend.invoke).toHaveBeenCalledWith('get_conversation_partner', { chatId: 'chat-1' })
})

it('keeps the edited attempt’s corrections visible while recording and removes them on cancel', async () => {
  const original: StoredTurn = { ...turn(1, 'Yo es'), coach: { comprehensibility: 4, grammar: 2, remark: 'Use the first-person form.', used_target: [], used_native: [], corrections: [{ said: 'Yo es', corrected: 'Yo soy', kind: 'grammar', explanation: 'Soy goes with yo.' }] } }
  const latest: StoredTurn = { ...turn(2, 'Hola'), coach: { comprehensibility: 5, grammar: 5, remark: 'Latest attempt feedback.', used_target: [], used_native: [], corrections: [] } }
  backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [original, latest] })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const { rerender } = render(<GuidedPage />)
  const edits = await screen.findAllByRole('button', { name: 'Edit this message and try again' })
  fireEvent.click(edits[0])
  let reference = screen.getByRole('region', { name: 'Coach feedback while editing' })
  expect(within(reference).getByText('Yo soy')).toBeVisible()
  expect(within(reference).queryByText('Latest attempt feedback.')).not.toBeInTheDocument()
  microphone.recording = true
  rerender(<GuidedPage />)
  expect(screen.getByRole('button', { name: /Stop and (send|transcribe) recording/ })).toBeVisible()
  reference = screen.getByRole('region', { name: 'Coach feedback while editing' })
  expect(within(reference).getByText('Soy goes with yo.')).toBeVisible()
  microphone.recording = false
  rerender(<GuidedPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
  expect(screen.queryByRole('region', { name: 'Coach feedback while editing' })).not.toBeInTheDocument()
  confirm.mockRestore()
})
