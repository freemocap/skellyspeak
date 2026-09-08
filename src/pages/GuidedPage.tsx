import { RewardPresentationProvider } from '../components/chat/RewardPresentation'
import { ActivityIndicator } from '../components/ActivityIndicator'
import { TopicNotesProvider } from '../components/panes/TopicNotesProvider'
import { useSkillNavigation } from '../hooks/useSkillNavigation'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import type { GuidedEvent, GuidedTurnResult, Profile, Settings, TeachingPlan } from '../types'
import { unreportedInput, type InputEvidence } from '../lib/skills'
import { PracticeContext, DraftAssistanceContext } from '../components/panes/PracticeContext'
import { SkillRewards } from '../components/chat/SkillRewards'
import { DevPanel } from '../components/dev/DevPanel'
import { GlossPopup } from '../components/GlossPopup'
import {
  getPlan,
  getSettings,
  isTauri,
  languageFor,
  languages,
  saveSettings,
} from '../lib/tauri'
import {
  isSpeaking,
  loadVoices,
  speakSmart,
  speechSupported,
  ttsAvailable,
  stopSpeaking,
  subscribeSpeaking,
  subscribeSpeechProgress,
  setPlaybackRate,
  type SpeechProgress,
} from '../lib/speech'
import { comboFromEvent } from '../lib/keyboard'
import { normalizeDocs } from '../lib/normalize'
import { WaveformStrip } from '../components/WaveformStrip'
import { WordInsightModal } from '../components/WordInsightModal'
import { EditFeedback } from '../components/chat/EditFeedback'
import { TurnView } from '../components/chat/TurnView'
import { DetailDialog } from '../components/DetailDialog'
import { AnalysisContent } from '../components/panes/AnalysisContent'
import { CoachAnalysisPanel } from '../components/panes/CoachAnalysisPanel'
import { logError, logInfo, logWarn } from '../lib/log'
import { STEER_LEVELS, STEER_TOPICS, useSteering } from '../hooks/useSteering'
import { PersonaField } from '../components/PersonaField'
import { TopicField } from '../components/TopicField'
import { ChatHistory } from '../components/ChatHistory'
import { chatHistory, latestAnswered, latestScaffolds } from '../lib/turns'
import { useConversation, type Turn } from './guided/useConversation'
import { useScaffolds } from './guided/useScaffolds'
import { useWordInspection } from './guided/useWordInspection'
import { useMicRecorder } from '../hooks/useMicRecorder'
import { usePersistentToggle } from '../hooks/useSteering'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAiActivity } from '../hooks/useAiActivity'
import { reportFault } from '../lib/faults'
import { needsProviderSetup } from '../lib/providers'

/// How much of the conversation each caller sends. The tutor needs the thread;
/// a scaffold refresh and the coach only need the recent exchange.
const REPLY_HISTORY_MESSAGES = 30

type MobileLocation = 'chat' | 'panel' | 'dev'

/// A turn whose reply is known but analysis hasn't landed yet.
function emptyAssistant(reply: string): GuidedTurnResult {
  return {
    reply,
    translation: null,
    tokens: [],
    user_tokens: [],
    user_translation: null,
    mechanics: [],
    scaffolds: { replies: [], frames: [], starters: [] },
    errors: [],
  }
}

export default function GuidedPage({
  active,
  settingsVersion = 0,
  historyOpen = false,
  onHistoryOpenChange,
  onOpenSettings,
}: {
  active: boolean
  settingsVersion?: number
  historyOpen?: boolean
  onHistoryOpenChange?: (open: boolean) => void
  /// Open the Settings modal. It lands on the AI provider section, which is
  /// where every "configure a provider" failure is asking the learner to go.
  onOpenSettings?: () => void
}) {
  const workspace = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLDivElement>(null)
  const navigation = useSkillNavigation()
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const inputEvidence = useRef<InputEvidence>(unreportedInput())
  // Set while the learner is retrying a past message: the composer is
  // pre-filled with what they said, and sending it discards that turn and
  // everything after it, then regenerates from the edited text.
  const [editingTurnId, setEditingTurnId] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [plan, setPlan] = useState<TeachingPlan | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Whether the webview's own speech engine is usable. Some webviews (notably
  // Android's) implement no speechSynthesis, making the OS engine unavailable
  // there; the cloud engine is unaffected.
  const [osVoiceReady, setOsVoiceReady] = useState(speechSupported())
  const ttsEngine = settings?.tts_engine ?? 'cloud'
  const ttsReady = ttsAvailable(ttsEngine, osVoiceReady)
  const autoSpeak = settings?.auto_speak ?? false
  const [panelTab, setPanelTab] = useState<'lesson' | 'analysis'>('lesson')
  const [coachDraft, setCoachDraft] = useState('')
  const [reviewing, setReviewing] = useState<Set<number>>(new Set())
  const [observationStatus, setObservationStatus] = useState('May lag behind the latest lesson choices.')
  const consumeCoachDraft = useCallback(() => setCoachDraft(''), [])
  const { open: breakOpen, toggle: toggleBreak } = usePersistentToggle('skellyspeak_break', true)
  const steer = useSteering()
  const setupPanel = usePersistentToggle('skellyspeak_chat_settings', false)
  const words = useWordInspection({ pinTurn: setPinnedId, breakOpen, toggleBreak })
  // Panel reload counter: bumped when the coach thread is reset externally.
  const [threadReload, setThreadReload] = useState(0)

  // Speaking state drives the 🔊/⏹ affordance on every bubble.
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => subscribeSpeaking(setSpeaking), [])
  const [speechProgress, setSpeechProgress] = useState<SpeechProgress | null>(null)
  const [savingSpeechRate, setSavingSpeechRate] = useState(false)
  useEffect(() => subscribeSpeechProgress(setSpeechProgress), [])
  useEffect(() => () => stopSpeaking(), [])
  useEffect(() => { stopSpeaking() }, [settingsVersion, active])

  const speakReply = useCallback(
    (text: string, turnId: number) => {
      // Toggle: if audio is playing, this click stops it.
      if (isSpeaking() && speechProgress?.utteranceId === String(turnId)) {
        stopSpeaking()
        return
      }
      const lang = settings?.target_language ?? 'es-ES'
      const engine = settings?.tts_engine ?? 'cloud'
      const voice = settings?.tts_voice || 'nova'
      // Any failure to speak reaches the screen. A log line alone would leave
      // a dead button with no explanation.
      void speakSmart(text, lang, engine, voice, settings?.tts_rate ?? 1, String(turnId), chatIdRef.current?.id ?? null, `${settingsVersion}:${settings?.native_language}:${settings?.target_language}`)
        .catch((e) => reportFault('Speech', e))
    },
    [settingsVersion, settings?.native_language, settings?.target_language, settings?.tts_engine, settings?.tts_voice, settings?.tts_rate, speechProgress?.utteranceId]
  )

  const streamRef = useRef<HTMLDivElement | null>(null)
  const breakRef = useRef<HTMLDivElement | null>(null)

  const settingsRef = useRef<Settings | null>(null)
  settingsRef.current = settings
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {})
  const toggleMicRef = useRef<() => void>(() => {})
  const toggleBreakRef = useRef<() => void>(() => {})

  const setHistoryOpen = useCallback(
    (open: boolean) => onHistoryOpenChange?.(open),
    [onHistoryOpenChange]
  )

  /// Everything tied to the conversation leaving the screen. The turns
  /// themselves are set by whoever swapped them.
  const resetView = useCallback(() => {
    setPinnedId(null)
    setCoachDraft('')
    setReviewing(new Set())
    setObservationStatus('May lag behind the latest lesson choices.')
    clearWordsRef.current()
    clearScaffoldsRef.current()
    setError(null)
    setSending(false)
    setEditingTurnId(null)
    stopSpeaking()
    setThreadReload((v) => v + 1)
  }, [])

  // `requestTurn` is defined below and closes over this hook's state, so the
  // greeting is reached through a ref rather than by hoisting one into the
  // other.
  const greetRef = useRef<() => void>(() => {})
  // Also assigned below: `resetView` runs above the scaffolds hook because
  // `useConversation` needs it, so it clears the chips through a ref.
  const clearScaffoldsRef = useRef<() => void>(() => {})
  const clearWordsRef = useRef<() => void>(() => {})
  const {
    turns,
    setTurns,
    turnsRef,
    nextIdRef,
    chats,
    currentChatId,
    openingFailed,
    chatIdRef,
    openChat,
    startNew: startNewConversation,
    removeChat,
    flush,
  } = useConversation({
    settings,
    persona: steer.persona,
    sending,
    setHistoryOpen,
    greet: () => greetRef.current(),
    resetView,
  })

  useEffect(() => {
    logInfo('[guided] page mounted, isTauri =', isTauri)
    void loadVoices().then((v) => {
      const ready = v.length > 0 || speechSupported()
      setOsVoiceReady(ready)
      logInfo(`[tts] OS voice engine ${ready ? 'available' : 'unavailable'}; ${v.length} voices`)
    })
    // Settings only. This effect re-runs on `settingsVersion`, which the
    // Settings modal bumps on every autosave mid-edit — so it must not touch
    // the conversation. Restoring and greeting are keyed on the pairing
    // instead, in the effect below, which fires only when the pairing really
    // changes.
    void getSettings()
      .then((s) => {
        setSettings(s)
        logInfo('[guided] settings:', {
          target: s.target_language,
          native: s.native_language,
          model: s.openrouter_model,
          openrouterKey: s.openrouter_key ? 'set' : 'MISSING',
          groqKey: s.groq_key ? 'set' : 'MISSING',
        })
      })
      .catch((e) => reportFault('Loading settings', e))
    void getPlan()
      .then((docs) => {
        const norm = normalizeDocs(docs.plan, docs.profile)
        setPlan(norm.plan)
        setProfile(norm.profile)
        // Read from the NORMALIZED copy: the raw document crosses IPC and a
        // missing array here would throw, defeating the normalization on the
        // line above whose whole job is to make that safe.
        logInfo('[guided] plan loaded:', {
          focus: norm.plan.session_focus,
          errors: norm.plan.recurring_errors.length,
        })
      })
      .catch((e) => reportFault('Loading teaching plan', e))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsVersion])

  useEffect(() => {
    const el = streamRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns])

  const isMobile = useIsMobile()
  const [analysisOpen, setAnalysisOpen] = useState(false)
  useEffect(() => { setAnalysisOpen(false) }, [currentChatId, settingsVersion])

  const onBubbleTap = useCallback(
    (id: number) => {
      setPinnedId(id)
      if (isMobile) { setAnalysisOpen(true); return }
      setPanelTab('analysis')
      if (!breakOpen) toggleBreak()
    },
    [breakOpen, toggleBreak, isMobile]
  )
  const requestTurn = useCallback(
    async (body: { message?: string; greeting?: boolean; steering?: string; replacesMessageId?: number; inputEvidence?: InputEvidence }) => {
      const owner = chatIdRef.current
      if (!owner) {
        setError('No conversation is open. Open a chat from history or start a new one.')
        return
      }
      const isCurrent = () => chatIdRef.current === owner
      let earlySections: Partial<GuidedTurnResult> = {}
      setSending(true)
      setError(null)
      logInfo('[guided] turn start:', {
        greeting: body.greeting ?? false,
        message: body.message ?? '',
        level: steer.level,
        topic: steer.topic || '(any)',
      })
      const pendingId = nextIdRef.current++
      const userText = body.greeting ? null : (body.message ?? '')
      if (userText) setReviewing((ids) => new Set([...ids, pendingId]))
      const turnStarted = performance.now()
      setTurns((prev) => [
        ...prev,
        {
          id: pendingId,
          user: userText,
          assistant: null,
          pendingText: '',
          analysisState: null,
        },
      ])

      const history = chatHistory(turnsRef.current, REPLY_HISTORY_MESSAGES)

      let deltaCount = 0
      const updatePending = (fn: (t: Turn) => Turn) =>
        setTurns((prev) => isCurrent() ? prev.map((t) => (t.id === pendingId ? fn(t) : t)) : prev)

      try {
        const channel = new Channel<GuidedEvent>()
        channel.onmessage = (event) => {
          if (!isCurrent()) return
          switch (event.type) {
            case 'reply_delta':
              deltaCount++
              updatePending((t) => ({ ...t, pendingText: t.pendingText + event.text }))
              break
            case 'reply_done':
              logInfo(
                `[guided] reply done in ${(performance.now() - turnStarted).toFixed(0)}ms` +
                  ` (${deltaCount} deltas, ${event.reply.length} chars)`
              )
              if (autoSpeak) speakReply(event.reply, pendingId)
              updatePending((t) => ({
                ...t,
                assistant: { ...emptyAssistant(event.reply), ...earlySections },
                analysisState: 'pending',
                pendingText: '',
              }))
              setSending(false)
              setPinnedId(pendingId)
              break
            case 'analysis_section':
              if (event.user_tokens) earlySections = { ...earlySections, user_tokens: event.user_tokens }
              if (event.user_translation) earlySections = { ...earlySections, user_translation: event.user_translation }
              // Turn scaffolds are the freshest suggestions — feed the chips.
              if (event.scaffolds && turnsRef.current.at(-1)?.id === pendingId) scaffolds.setFresh(event.scaffolds)
              updatePending((t) =>
                t.assistant
                  ? {
                      ...t,
                      assistant: {
                        ...t.assistant,
                        tokens: event.tokens ?? t.assistant.tokens,
                        translation: event.translation ?? t.assistant.translation,
                        user_tokens: event.user_tokens ?? t.assistant.user_tokens,
                        user_translation: event.user_translation ?? t.assistant.user_translation,
                        mechanics: event.mechanics ?? t.assistant.mechanics,
                        scaffolds: event.scaffolds ?? t.assistant.scaffolds,
                      },
                    }
                  : t
              )
              break
            case 'coach_done':
              setReviewing((ids) => { const next = new Set(ids); next.delete(pendingId); return next })
              logInfo(
                '[coach] feedback:', event.feedback.corrections.length, 'corrections,',
                'comp', event.feedback.comprehensibility, '/ grammar', event.feedback.grammar
              )
              updatePending((t) => ({ ...t, coach: event.feedback }))
              break
            case 'coach_failed':
              setReviewing((ids) => { const next = new Set(ids); next.delete(pendingId); return next })
              logWarn('[coach] failed:', event.error)
              updatePending((t) => ({ ...t, coachError: event.error }))
              break
            case 'analysis_done':
              logInfo(
                `[guided] analysis arrived in ${(performance.now() - turnStarted).toFixed(0)}ms:`,
                {
                  tokens: event.turn.tokens.length,
                  mechanics: event.turn.mechanics.length,
                  scaffolds: `${event.turn.scaffolds.replies.length}/${event.turn.scaffolds.frames.length}/${event.turn.scaffolds.starters.length}`,
                }
              )
              // End of turn = freshest suggestions for the NEXT message.
              if (turnsRef.current.at(-1)?.id === pendingId) scaffolds.setFresh(event.turn.scaffolds)
              updatePending((t) => ({
                ...t,
                assistant: event.turn,
                analysisState: 'done',
              }))
              break
            case 'plan_updated': {
              setObservationStatus('Refreshed after a conversation turn. Your explicit choices still take priority.')
              logInfo('[guided] plan updated:', {
                focus: event.plan.session_focus,
                errors: event.plan.recurring_errors.length,
              })
              const norm = normalizeDocs(event.plan, event.profile)
              setPlan(norm.plan)
              setProfile(norm.profile)
              break
            }
            case 'fault':
              reportFault(event.context, event.message)
              break
          }
        }
        await invoke<string>('guided_turn', {
          message: body.message ?? '',
          history,
          messageId: pendingId,
          historyAvailable: chatHistory(turnsRef.current, Number.MAX_SAFE_INTEGER).length,
          replacesMessageId: body.replacesMessageId ?? null,
          inputEvidence: body.inputEvidence ?? unreportedInput(),
          greeting: body.greeting ?? false,
          steering: body.steering ?? null,
          level: steer.level,
          topic: steer.topic || null,
            // The core reads the character saved for this conversation.
          // Read from the ref, not from `currentChatId`: the greeting turn is
          // fired from inside the effect that opens the chat, and this callback
          // still holds the null from the render before it existed.
          chatId: owner.id,
          onEvent: channel,
        })
        if (!isCurrent()) return
        // Command resolved = reply pass done. Re-asserted here in case the
        // reply_done event and this resolution raced.
        setSending(false)
        updatePending((t) =>
          t.assistant ? t : { ...t, assistant: emptyAssistant(t.pendingText), analysisState: 'pending', pendingText: '' }
        )
      } catch (e) {
        if (!isCurrent()) return
        logError('[guided] turn failed:', e)
        setTurns((prev) => prev.filter((t) => t.id !== pendingId))
        setError(String(e).replace(/^Error:\s*/, ''))
        setSending(false)
      }
    },
    [autoSpeak, onBubbleTap, speakReply, steer.level, steer.topic, chatIdRef]
  )

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    const provenance = { ...inputEvidence.current, revision: editingTurnId !== null }
    inputEvidence.current = unreportedInput()
    setInput('')
    stopSpeaking() // new turn: silence any ongoing playback
    const replacesMessageId = editingTurnId ?? undefined
    if (editingTurnId !== null) {
      const idx = turnsRef.current.findIndex((t) => t.id === editingTurnId)
      if (idx !== -1) {
        // Mutate the ref immediately, not just via setTurns: requestTurn reads
        // turnsRef.current synchronously below to build history, before React
        // has re-rendered with the truncated state.
        const truncated = turnsRef.current.slice(0, idx)
        turnsRef.current = truncated
        setTurns(truncated)
      }
      setEditingTurnId(null)
    }
    await requestTurn({ message, replacesMessageId, inputEvidence: provenance })
  }
  sendRef.current = send

  /// Start retrying a past message: everything from that turn onward gets
  /// discarded once the learner actually sends a replacement, so the tutor
  /// and coach regenerate against the edited line instead of the original.
  const beginEditTurn = useCallback(
    (turn: { id: number; user: string | null }) => {
      if (sending) return
      const idx = turnsRef.current.findIndex((t) => t.id === turn.id)
      const laterTurns = idx === -1 ? 0 : turnsRef.current.length - idx - 1
      if (
        laterTurns > 0 &&
        !window.confirm(
          `Editing this message will discard the ${laterTurns} turn${laterTurns === 1 ? '' : 's'} after it. Continue?`
        )
      ) {
        return
      }
      setEditingTurnId(turn.id)
      inputEvidence.current = { ...unreportedInput(), revision: true }
      setInput(turn.user ?? '')
      stopSpeaking()
    },
    [sending, turnsRef]
  )
  const cancelEdit = useCallback(() => {
    inputEvidence.current = unreportedInput()
    setEditingTurnId(null)
    setInput('')
  }, [])
  toggleBreakRef.current = toggleBreak
  // How `useConversation` opens an empty conversation. Assigned here because
  // `requestTurn` is defined in this component and the hook runs above it.
  greetRef.current = () => void requestTurn({ greeting: true })

  // Configurable keyboard shortcuts. Modifier combos work while typing;
  // the handler ignores repeat events and the shortcut-capture inputs.
  useEffect(() => {
    const shortcuts = settings?.shortcuts
    if (!shortcuts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.('[data-shortcut-capture]')) return
      const combo = comboFromEvent(e)
      const inField = /^(input|textarea|select)$/i.test(target?.tagName ?? '')
      const hasMod = e.ctrlKey || e.altKey || e.metaKey
      if (!hasMod && inField) return
      if (combo === shortcuts.mic) {
        e.preventDefault()
        toggleMicRef.current()
      } else if (combo === shortcuts.speak) {
        e.preventDefault()
        const last = latestAnswered(turnsRef.current)
        if (last?.assistant) speakReply(last.assistant.reply, last.id)
      } else if (combo === shortcuts.panel) {
        e.preventDefault()
        toggleBreakRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings?.shortcuts, speakReply])

  const editingTurn = turns.find((turn) => turn.id === editingTurnId)
  const latestAssistantId = latestAnswered(turns)?.id ?? null

  // Romanization shows for targets whose script needs it (Arabic → ALA-LC).
  const showRomanization =
    settings != null && languageFor(settings.target_language)?.romanization != null

  // RTL targets render token lines right-to-left.
  const rtl =
    settings != null && languageFor(settings.target_language)?.direction === 'rtl'

  // Romanization visibility: "always" setting OR a revealed token.
  const alwaysRomanize = settings?.always_romanize ?? false

  /// Toggle a boolean setting from the composer's quick row.
  ///
  /// This is the SAME record the Settings modal edits — Rust's `Settings` is
  /// the single source of truth. We patch optimistically for responsiveness
  /// and persist immediately; the modal re-reads on open, so the two surfaces
  /// cannot drift. Duplicating this into local component state is exactly the
  /// bug to avoid.
  const toggleSetting = useCallback(
    (key: 'auto_speak' | 'auto_send' | 'always_romanize' | 'auto_translate') => {
      setSettings((prev) => {
        if (!prev) return prev
        const next = { ...prev, [key]: !prev[key] }
        void saveSettings(next).catch((e) => reportFault('Saving setting', e))
        return next
      })
    },
    []
  )

  // Display name from the shared language list — no ad-hoc mapping.
  const targetLanguageName = settings
    ? (languageFor(settings.target_language)?.endonym ??
       settings.target_language.split('-')[0].toUpperCase())
    : ''
  const nativeLanguageName = settings
    ? (languages().find((l) => l.base === settings.native_language)?.endonym ??
       settings.native_language.toUpperCase())
    : ''

  const bestScaffolds = latestScaffolds(turns)
  const pinnedTurn =
    turns.find((t) => t.id === (pinnedId ?? latestAssistantId) && t.assistant) ?? null




  // Fresh scaffolds: regenerated when steering changes, so suggestions track
  // level/topic instead of going stale. Turn analysis clears this override.
  const scaffolds = useScaffolds({
    settingsLoaded: settings !== null,
    level: steer.level,
    topic: steer.topic,
    onSteered: (change) => void requestTurn({ message: '', steering: change }),
  })
  const chipsForUI = scaffolds.chipsFrom(bestScaffolds)
  clearScaffoldsRef.current = () => scaffolds.setFresh(null)
  clearWordsRef.current = words.clear

  const mic = useMicRecorder({
    micDeviceId: settings?.microphone_device_id,
    onTranscribe: (text: string) => {
      if (text) {
        inputEvidence.current.modality = 'speech_transcript'
        if (settingsRef.current?.auto_send) {
          logInfo('[mic] auto-send enabled — sending transcription')
          void sendRef.current(text)
        } else {
          setInput((prev) => (prev ? `${prev} ${text}` : text))
        }
      } else logWarn('[mic] transcription was empty (silence?)')
    },
    buildPrompt: () => {
      // Whisper context hint. Keep it TARGET-LANGUAGE ONLY: the hint text
      // itself teaches the model what language to emit, so English content
      // here causes doubled Arabic+English transcripts. Few natural words
      // from the recent conversation are the strongest bias.
      const lines = turnsRef.current
        .slice(-4)
        .flatMap((t) => [t.user, t.assistant?.reply].filter(Boolean) as string[])
      return [...lines].join('\n').slice(0, 850)
    },
  })
  toggleMicRef.current = mic.toggleMic

  // Chat and lesson share one mobile scroll; AI remains a separate surface.
  const aiBusy = useAiActivity()
  const [mobileSurface, setMobileLocation] = useState<MobileLocation>('chat')

  useEffect(() => { if (words.inspect) { if (isMobile) setAnalysisOpen(true); else setPanelTab('analysis') } }, [words.inspect, isMobile])

  useEffect(() => {
    if (isMobile && mobileSurface === 'panel') breakRef.current?.scrollIntoView({ block: 'start' })
  }, [isMobile, mobileSurface, panelTab])
  const chatComposer = (
        <div className="composer" ref={composer}>
          {editingTurnId !== null && (
            <div className="edit-banner">
              <span>✎ Editing your message — send or record to try again</span>
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          )}
          {editingTurn && settings && <EditFeedback key={editingTurn.id} id={editingTurn.id} feedback={editingTurn.coach} error={editingTurn.coachError} reviewing={reviewing.has(editingTurn.id)} targetLangCode={settings.target_language} nativeLangCode={settings.native_language} />}
          <div className="scaffold-block chat-settings-block">
            <div className="chat-section-heading">
              <button type="button" className="chat-panel-toggle" onClick={setupPanel.toggle}
                aria-expanded={setupPanel.open} aria-controls="chat-settings" title={setupPanel.open ? 'Hide chat settings' : 'Show chat settings'}>
                {setupPanel.open ? '▾' : '▸'} Settings &amp; voice
              </button>
              {!setupPanel.open && <span className="chat-panel-summary">
                {STEER_LEVELS.find((l) => l.value === steer.level)?.label ?? steer.level}
                {steer.topic ? ` · ${steer.topic}` : ' · any topic'}
              </span>}
            </div>
            {setupPanel.open && <div id="chat-settings" className="scaffold-groups">
                <fieldset className="conversation-controls" disabled={sending}>
                <div className="steer-row">
                  <select
                    className="steer-select"
                    value={steer.level}
                    onChange={(e) => steer.setLevel(e.target.value)}
                    aria-label="Learner level"
                    title="Learner level — steers every prompt"
                  >
                    {!STEER_LEVELS.some((level) => level.value === steer.level) && (
                      <option value={steer.level} disabled>Unrecognized saved level — choose a level</option>
                    )}
                    {STEER_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <TopicField topics={STEER_TOPICS} value={steer.topic} onChange={steer.setTopic} />
                  <button
                    type="button"
                    className="steer-dice"
                    title="Random topic"
                    aria-label="Random topic"
                    onClick={steer.randomTopic}
                  >
                    🎲
                  </button>
                </div>
                {/* Changing who you are talking to starts a fresh conversation:
                    the person you were mid-sentence with cannot turn into
                    somebody else. The old chat is archived, not lost. */}
                {(currentChatId || openingFailed) && <PersonaField
                  chatId={currentChatId}
                  onChange={(id) => {
                    steer.setPersona(id)
                    void startNewConversation(id)
                  }}
                />}
                </fieldset>

                {/* The same Settings record the modal edits — Rust owns it,
                    these are a second VIEW of one variable, not a copy. */}
                <div className="quick-toggles" role="group" aria-label="Reading and voice options">
                  {(
                    [
                      ['auto_speak', 'Read aloud', 'Speak each reply automatically'],
                      ['auto_send', 'Auto-send voice', 'Send speech transcriptions immediately'],
                      ['auto_translate', 'Show translation', 'Always show the translation under each reply'],
                      ...(showRomanization
                        ? ([['always_romanize', 'Show romanization', 'Always show romanization under each word']] as const)
                        : []),
                    ] as [
                      'auto_speak' | 'auto_send' | 'auto_translate' | 'always_romanize',
                      string,
                      string,
                    ][]
                  ).map(([key, label, title]) => (
                    <button
                      key={key}
                      type="button"
                      className={`quick-toggle ${settings?.[key] ? 'on' : ''}`}
                      onClick={() => toggleSetting(key)}
                      aria-pressed={settings?.[key] ?? false}
                      title={title}
                      disabled={!settings}
                    >
                      {settings?.[key] ? '☑' : '☐'} {label}
                    </button>
                  ))}
                  <label className="speech-speed" title={ttsEngine === 'cloud'
                    ? 'Adjust playback speed while keeping the natural pitch.'
                    : 'Speed changes apply on replay.'}>
                    Voice speed
                    <select aria-label="Voice playback speed" value={settings?.tts_rate ?? 1}
                      disabled={!settings || savingSpeechRate}
                      onChange={(event) => {
                        if (!settings) return
                        const rate = Number(event.target.value)
                        const updated = { ...settings, tts_rate: rate }
                        setSavingSpeechRate(true)
                        void saveSettings(updated).then(() => {
                          setSettings(updated)
                          setPlaybackRate(rate)
                        }).catch((error: unknown) => reportFault('Saving voice speed', error))
                          .finally(() => setSavingSpeechRate(false))
                      }}>
                      {[0.5, 0.65, 0.8, 1, 1.25, 1.5].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                    </select>
                  </label>
                </div>

              </div>
            }
          </div>
          <div className="composer-activity" aria-live="polite">
            {mic.transcribing ? <ActivityIndicator label="Transcribing audio…" /> : sending ? <ActivityIndicator label="Partner is replying…" /> : (aiBusy || turns.some(turn => turn.analysisState === 'pending') || reviewing.size > 0) ? <ActivityIndicator label="AI is analysing…" /> : null}
          </div>
          {mic.recording && mic.waveSource && (
            <WaveformStrip source={mic.waveSource} height={44} timelineSeconds={10} />
          )}
          <form
            className="crow"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              className="field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={targetLanguageName ? `Write in ${targetLanguageName}…` : 'Write…'}
              disabled={!isTauri}
              lang={settings?.target_language ?? 'es-ES'}
              enterKeyHint="send"
              autoCorrect="off"
              spellCheck={false}
            />
            {mic.recording && (
              <button
                type="button"
                className="mic-cancel"
                onClick={mic.cancel}
                title="Discard recording without transcribing"
                aria-label="Discard recording"
              >
                Discard
              </button>
            )}
            <button
              type="button"
              className={`mic ${mic.recording ? 'recording' : ''}`}
              onClick={mic.toggleMic}
              disabled={!isTauri || sending || mic.transcribing}
              title={mic.recording ? (settings?.auto_send ? 'Stop and send recording' : 'Stop and transcribe recording') : 'Record audio'}
              aria-label={mic.recording ? (settings?.auto_send ? 'Stop and send recording' : 'Stop and transcribe recording') : 'Record audio'}
            >
              <span aria-hidden="true">{mic.recording ? '■' : '●'}</span>
              <span>{mic.recording ? 'Stop' : 'Record'}</span>
            </button>

            <button
              type="submit"
              className="send"
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              ↑
            </button>
          </form>
        </div>
  )

  return (
    <RewardPresentationProvider workspace={workspace} chatId={currentChatId} active={active}><TopicNotesProvider scope={`${settingsVersion}:${settings?.target_language}:${settings?.native_language}`}><PracticeContext value={{ chatId: currentChatId, selectionVersion: navigation.state.sequence, selected: navigation.state.selected && navigation.state.selected.target === settings?.target_language ? navigation.state.selected.skillId : null, select: skillId => { if (!settings) throw new Error('Settings are not loaded'); navigation.select({ target: settings.target_language, skillId }) } }}><DraftAssistanceContext value={{ suggestions: chipsForUI, suggestionsError: null, useExample: (text, source) => { inputEvidence.current = { ...inputEvidence.current, [source]: true }; setInput(previous => previous.trim() ? `${previous.trimEnd()} ${text}` : text) } }}>
    <div className="guided-workspace">
    <div
      ref={workspace}
      className={`split ${isMobile ? "mobile-conversation" : ""}`}
    >
      <ChatHistory
        open={historyOpen}
        chats={chats}
        currentId={currentChatId}
        languageName={targetLanguageName}
        onClose={() => setHistoryOpen(false)}
        onOpenChat={(id) => void openChat(id)}
        onNewChat={() => void startNewConversation(steer.persona)}
        onDeleteChat={(id) => void removeChat(id)}
      />
      {/* ── Chat half (paper) ─────────────────────────────────────────── */}
      <section className={`chat ${isMobile && mobileSurface === 'dev' ? 'mobile-hidden' : ''}`}>
        <div className="chat-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="conversation-title"><span className="chat-heading-label">{targetLanguageName}</span><small>{STEER_LEVELS.find(item => item.value === steer.level)?.label ?? steer.level}{steer.topic ? ` · ${steer.topic}` : ''}</small></div>
          <div className="chat-heading-actions">

          <button
            type="button"
            className="plan-toggle"
            onClick={() => { setPanelTab('lesson'); setMobileLocation('panel'); if (!breakOpen) toggleBreak() }}
            title="Show lesson and coach"
          >
            Lesson & coach
          </button>
          <button type="button" className="new-chat" aria-label="New chat"
            title="Start a new chat — this conversation stays in history"
            disabled={!settings || sending}
            onClick={() => void startNewConversation(steer.persona)}>+</button>
          </div>
        </div>
        <SkillRewards chatId={currentChatId} active={active} workspace={workspace} />
        <div className="stream" ref={streamRef}>
          {turns.length === 0 && !error && !sending && (
            <p className="center-note" style={{ color: 'var(--ink-mut)', background: 'none', border: 'none' }}>
              Say hello to start the conversation.
            </p>
          )}
          {turns.map((turn) => (
            <Fragment key={turn.id}><TurnView
              turn={turn}
              reviewing={reviewing.has(turn.id)}
              targetLangCode={(settings?.target_language ?? 'es-ES').split('-')[0]}
              nativeLangCode={settings?.native_language ?? 'en'}
              onAskCoach={(question) => { setCoachDraft(question); setPanelTab('lesson'); setMobileLocation('panel'); if (!breakOpen) toggleBreak() }}
              focused={(pinnedId ?? latestAssistantId) === turn.id}
              ttsReady={ttsReady}
              speaking={speaking && speechProgress?.utteranceId === String(turn.id)}
              revealed={words.revealed}
              showRomanization={showRomanization}
              alwaysRomanize={alwaysRomanize}
              autoTranslate={settings?.auto_translate ?? false}
              rtl={rtl}
              onReveal={words.reveal}
              onBubbleTap={onBubbleTap}
              onSpeak={speakReply}
              onPopup={words.setPopup}
              onInspect={words.inspectWord}
              onHold={words.holdWord}
              onToggleReveal={words.toggleReveal}
              onEditUser={sending ? undefined : beginEditTurn}
            />
            {turn.analysisState === 'pending' && <ActivityIndicator label="Analysing reply…" />}
            </Fragment>
          ))}
          {error && (
            <div className="err">
              <span>{error}</span>
              {/* A message that says "go to Settings" should take you there,
                  rather than making you find the gear yourself. */}
              {onOpenSettings && needsProviderSetup(error) && (
                <button type="button" className="err-action" onClick={onOpenSettings}>
                  Open Settings
                </button>
              )}
            </div>
          )}
        </div>

        {!isMobile && chatComposer}
      </section>

      {isMobile && <div className={`chat mobile-composer ${mobileSurface === 'dev' ? 'mobile-hidden' : ''}`}>{chatComposer}</div>}

      {/* ── Breakdown half (dark) — full panel in mobile Coach/Analysis mode ── */}
      <section
        className={`break ${breakOpen ? '' : 'collapsed'} ${
          isMobile && mobileSurface === 'dev' ? 'mobile-hidden' : ''
        }`}
        ref={breakRef}
      >
        {!breakOpen && <button type="button" className="break-head" onClick={toggleBreak} aria-expanded={false}>Open lesson &amp; coach ▸</button>}

        {/* Lesson choices and private coaching share the learning panel. */}
        {currentChatId && <CoachAnalysisPanel
          key={`${currentChatId}:${settings?.target_language}:${settings?.native_language}:${threadReload}`}
          chatId={currentChatId}
          level={steer.level}
          topic={steer.topic}
          prepareContext={flush}
          conversationBusy={sending}
          plan={plan}
          profile={profile}
          tab={isMobile ? 'lesson' : panelTab}
          onTab={tab => { if (isMobile && tab === 'analysis') setAnalysisOpen(true); else setPanelTab(tab) }}
          observationStatus={observationStatus}
          draftQuestion={coachDraft}
          onDraftConsumed={consumeCoachDraft}
          pinnedTurn={pinnedTurn}
          inspect={words.inspect}
          nativeLanguageName={nativeLanguageName}
          showRomanization={showRomanization}
          rtl={rtl}
        />}

      </section>

      {/* The dev surface: the same DevPanel as the desktop dock and the
          popped-out window, here as the separate diagnostic surface. */}
      {isMobile && (
        <section
          className={`dev-surface ${mobileSurface !== 'dev' ? 'mobile-hidden' : ''}`}
        >
          <DevPanel />
        </section>
      )}

    </div>
      {/* Mobile navigation jumps within practice or opens diagnostics */}
      {isMobile && (
        <nav className="mobile-nav">
          {(
            [
              ['chat', '💬', 'Chat'],
              ['panel', '🎓', 'Lesson'],
              ['dev', '💭', 'AI'],
            ] as [MobileLocation, string, string][]
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={`mobile-nav-item ${mobileSurface === id ? 'active' : ''} ${
                id === 'dev' && aiBusy ? 'busy' : ''
              }`}
              onClick={() => { setMobileLocation(id); if (id === 'panel') { if (!breakOpen) toggleBreak(); breakRef.current?.scrollIntoView({ block: 'start' }) } else if (id === 'chat') composer.current?.scrollIntoView({ block: 'end' }) }}
            >
              {/* Wrapped so the icon alone can pulse while agents are running
                  — the phone has no topbar button to carry that signal. */}
              <span className="mobile-nav-icon">{icon}</span> {label}
            </button>
          ))}
        </nav>
      )}

      {analysisOpen && <DetailDialog title="Message analysis" onClose={() => setAnalysisOpen(false)}>
        <h2>Message analysis</h2>
        {pinnedTurn ? <AnalysisContent turn={pinnedTurn} inspect={words.inspect} nativeLanguageName={nativeLanguageName} showRomanization={showRomanization} rtl={rtl} /> : <p>Select Analysis on a conversation reply to inspect that message.</p>}
      </DetailDialog>}
      {words.popup && <GlossPopup popup={words.popup} onClose={words.closePopup} />}
      {words.insight && (
        <WordInsightModal
          word={words.insight.word}
          sentence={words.insight.sentence}
          onClose={words.closeInsight}
        />
      )}
    </div>
    </DraftAssistanceContext></PracticeContext></TopicNotesProvider></RewardPresentationProvider>
  )
}
