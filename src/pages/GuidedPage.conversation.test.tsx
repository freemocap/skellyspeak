// @vitest-environment jsdom
//
// The conversation lifecycle: which chat is on screen, when a greeting fires,
// and what gets saved where. This is the layer every recent frontend bug lived
// in — greeting over a restored conversation, reloading mid-edit and clobbering
// unsaved turns, saving one conversation under another's name — and none of it
// is reachable from a pure-function test.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
}))
vi.mock('../hooks/useMicRecorder', () => ({
  // Matches the real hook's shape: { recording, recAnalyser, toggleMic, cancel }.
  useMicRecorder: () => ({
    recording: false,
    recAnalyser: null,
    toggleMic: vi.fn(),
    cancel: vi.fn(),
  }),
}))
// Heavy panes that pull in the graph view; not what these tests are about.
vi.mock('../components/dev/DevPanel', () => ({ DevPanel: () => null }))
vi.mock('../components/panes/CoachAnalysisPanel', () => ({ CoachAnalysisPanel: () => null }))

import GuidedPage from './GuidedPage'
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
  localStorage.clear()
  // The greeting fires once per session; each test starts fresh.
  disarmGreeting()
  backend.invoke.mockResolvedValue('')
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
      sessions: 0,
    },
  })
  backend.listConversations.mockResolvedValue([])
  backend.saveConversation.mockResolvedValue(undefined)
  backend.languages.mockReturnValue([{ base: 'en', endonym: 'English' }])
  backend.languageFor.mockReturnValue({ endonym: 'Español' })
  backend.loadConversation.mockResolvedValue({ id: 'chat-1', turns: [] })
})

describe('opening the app', () => {
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
      expect(backend.loadConversation).toHaveBeenCalledWith('es-ES', 'en')
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
  it('sends the chosen partner and the conversation it belongs to', async () => {
    // Both halves matter. Without the partner the core has no character to
    // build the prompt from; without the chat id "surprise me" would resolve
    // to a different person on every single turn, which is worse than always
    // being the same one.
    backend.loadConversation.mockResolvedValue({ id: 'chat-7', turns: [] })
    render(<GuidedPage />)
    await waitFor(() => {
      const call = backend.rawInvoke.mock.calls.find((c) => c[0] === 'guided_turn')
      expect(call).toBeTruthy()
      const body = call![1] as { persona: string; chatId: string }
      expect(body.persona).toBe('surprise')
      expect(body.chatId).toBe('chat-7')
    })
  })

  it('offers the partners the core actually has, not a list of its own', async () => {
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
    render(<GuidedPage />)
    const picker = await screen.findByLabelText('Persona:')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'The night-shift baker' })).toBeInTheDocument()
    )
    // "Surprise me" is not one of the core's personas — it is the absence of a
    // choice, and the picker supplies it.
    expect(picker).toHaveValue('surprise')
  })

  it('starts a new conversation when the partner changes', async () => {
    // You cannot be mid-sentence with someone and have them become somebody
    // else. The old chat is archived, not lost.
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
    backend.newConversation.mockResolvedValue({ id: 'chat-2', turns: [] })
    render(<GuidedPage />)
    const picker = await screen.findByLabelText('Persona:')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'The night-shift baker' })).toBeInTheDocument()
    )

    fireEvent.change(picker, { target: { value: 'baker' } })

    await waitFor(() => expect(backend.newConversation).toHaveBeenCalled())
    expect(localStorage.getItem('skellyspeak_persona')).toBe('baker')
  })

  it('falls back to surprise when the stored partner has been deleted', async () => {
    // The core treats an id it cannot find as "pick someone". The picker has
    // to say the same thing rather than showing an empty select.
    localStorage.setItem('skellyspeak_persona', 'deleted-one')
    backend.listPersonas.mockResolvedValue({ personas: [BAKER], faults: [] })
    render(<GuidedPage />)
    const picker = await screen.findByLabelText('Persona:')
    await waitFor(() => expect(picker).toHaveValue('surprise'))
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
    expect(await screen.findByText(/You bake bread overnight/)).toBeInTheDocument()
  })

  it('refuses to let a built-in be edited, and offers a copy instead', async () => {
    await openPanel()
    await screen.findByText(/You bake bread overnight/)
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
        within(screen.getByLabelText('Persona:')).getByRole('option', { name: /My uncle/ })
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
  it('folds the practice settings away with the suggestions', async () => {
    // One collapsible, not three strips stacked above a phone keyboard. The
    // level and topic controls live inside it now, so collapsing has to take
    // them with it.
    render(<GuidedPage />)
    const toggle = await screen.findByTitle('Hide suggestions and settings')
    expect(screen.getByLabelText('Learner level')).toBeInTheDocument()

    fireEvent.click(toggle)

    await waitFor(() => expect(screen.queryByLabelText('Learner level')).not.toBeInTheDocument())
    expect(screen.queryByLabelText('Talking to')).not.toBeInTheDocument()
  })

  it('says what is folded away, so the steering is never invisible', async () => {
    // Level and topic steer every reply. Hidden AND unstated, they become
    // settings that silently change the conversation.
    render(<GuidedPage />)
    fireEvent.click(await screen.findByTitle('Hide suggestions and settings'))
    await waitFor(() => expect(screen.getByText(/Beginner/)).toBeInTheDocument())
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
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalledWith('es-ES', 'en'))

    backend.getSettings.mockResolvedValue({ ...SETTINGS, target_language: 'ar' })
    view.rerender(<GuidedPage settingsVersion={1} />)

    await waitFor(() => {
      expect(backend.loadConversation).toHaveBeenCalledWith('ar', 'en')
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
  it('sends the learner dialect with regenerated scaffolds', async () => {
    // The dialect reached `generate_scaffolds` as null for as long as this
    // component existed: the callback is created once, and its closure held
    // the FIRST render's settings, which are still null. Scaffolds were built
    // with no dialect overlay — Levantine practice got MSA suggestions.
    backend.getSettings.mockResolvedValue({ ...SETTINGS, target_language: 'ar', target_dialect: 'ar-LE' })
    const user = userEvent.setup()
    render(<GuidedPage />)
    await waitFor(() => expect(backend.loadConversation).toHaveBeenCalled())

    // Changing the topic is what triggers a scaffold regeneration.
    await user.selectOptions(screen.getByLabelText('Conversation topic'), 'Food & cooking')

    await waitFor(
      () => {
        const call = backend.rawInvoke.mock.calls.find((c) => c[0] === 'generate_scaffolds')
        expect(
          call,
          `generate_scaffolds not called; invoke saw: ${JSON.stringify(backend.rawInvoke.mock.calls.map((c) => c[0]))}`
        ).toBeTruthy()
        expect((call![1] as { req: { dialect: string | null } }).req.dialect).toBe('ar-LE')
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
