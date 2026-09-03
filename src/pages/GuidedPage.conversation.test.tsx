// @vitest-environment jsdom
//
// The conversation lifecycle: which chat is on screen, when a greeting fires,
// and what gets saved where. This is the layer every recent frontend bug lived
// in — greeting over a restored conversation, reloading mid-edit and clobbering
// unsaved turns, saving one conversation under another's name — and none of it
// is reachable from a pure-function test.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  saveSettings: vi.fn(),
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
