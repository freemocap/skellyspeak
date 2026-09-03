import { useCallback, useEffect, useRef, useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import type { GuidedEvent, GuidedTurnResult, Profile, Settings, TeachingPlan } from '../types'
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
import { openOverlay } from '../lib/back'
import {
  isSpeaking,
  loadVoices,
  speakSmart,
  speechSupported,
  ttsAvailable,
  stopSpeaking,
  subscribeSpeaking,
} from '../lib/speech'
import { comboFromEvent } from '../lib/keyboard'
import { normalizeDocs } from '../lib/normalize'
import { WaveformStrip } from '../components/WaveformStrip'
import { WordInsightModal } from '../components/WordInsightModal'
import { TurnView } from '../components/chat/TurnView'
import { CoachAnalysisPanel } from '../components/panes/CoachAnalysisPanel'
import { logError, logInfo, logWarn } from '../lib/log'
import { STEER_LEVELS, STEER_TOPICS, useSteering } from '../hooks/useSteering'
import { TopicField } from '../components/TopicField'
import { ChatHistory } from '../components/ChatHistory'
import { chatHistory, latestAnswered, latestScaffolds, transcriptForCoach } from '../lib/turns'
import { useConversation, type Turn } from './guided/useConversation'
import { useScaffolds } from './guided/useScaffolds'
import { useWordInspection } from './guided/useWordInspection'
import { useMicRecorder } from '../hooks/useMicRecorder'
import { usePersistentToggle } from '../hooks/useSteering'
import { useIsMobile } from '../hooks/useIsMobile'
import { reportFault } from '../lib/faults'
import { needsProviderSetup } from '../lib/providers'

/// How much of the conversation each caller sends. The tutor needs the thread;
/// a scaffold refresh and the coach only need the recent exchange.
const REPLY_HISTORY_MESSAGES = 30
const COACH_CONTEXT_TURNS = 8

/// The mobile surfaces, in swipe order. The dev panel is last deliberately:
/// it is the deepest rung of the disclosure ladder, always reachable but never
/// in the way.
const MOBILE_SURFACES = ['chat', 'panel', 'dev'] as const
type MobileSurface = (typeof MOBILE_SURFACES)[number]

/// A horizontal swipe has to be clearly horizontal to claim the gesture, or it
/// steals vertical chat scrolling and drag-to-reveal.
const SWIPE_MIN_PX = 60
const SWIPE_MAX_MS = 600


function ScaffoldRow({
  label,
  items,
  onPick,
}: {
  label: string
  items?: string[]
  onPick: (s: string) => void
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="scaffold-row">
      <span className="scaffold-label">{label}</span>
      <div className="scaffold-chips">
        {items.map((s) => (
          <button key={s} type="button" className="scaf" onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

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
  settingsVersion = 0,
  historyOpen = false,
  onHistoryOpenChange,
  onOpenSettings,
}: {
  settingsVersion?: number
  historyOpen?: boolean
  onHistoryOpenChange?: (open: boolean) => void
  /// Open the Settings modal. It lands on the AI provider section, which is
  /// where every "configure a provider" failure is asking the learner to go.
  onOpenSettings?: () => void
}) {
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
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
  const [planOpen, setPlanOpen] = useState(false)
  useEffect(
    () => (planOpen ? openOverlay(() => setPlanOpen(false)) : undefined),
    [planOpen]
  )
  const { open: breakOpen, toggle: toggleBreak } = usePersistentToggle('skellyspeak_break', true)
  const steer = useSteering()
  const words = useWordInspection({ pinTurn: setPinnedId, breakOpen, toggleBreak })
  // Panel reload counter: bumped when the coach thread is reset externally.
  const [threadReload, setThreadReload] = useState(0)

  // Speaking state drives the 🔊/⏹ affordance on every bubble.
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => subscribeSpeaking(setSpeaking), [])

  const speakReply = useCallback(
    (text: string) => {
      // Toggle: if audio is playing, this click stops it.
      if (isSpeaking()) {
        stopSpeaking()
        return
      }
      const lang = settings?.target_language ?? 'es-ES'
      const engine = settings?.tts_engine ?? 'cloud'
      const voice = settings?.tts_voice || 'nova'
      // Any failure to speak reaches the screen. A log line alone would leave
      // a dead button with no explanation.
      void speakSmart(text, lang, engine, voice).catch((e) => reportFault('Speech', e))
    },
    [settings?.target_language, settings?.tts_engine, settings?.tts_voice]
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
    clearWordsRef.current()
    clearScaffoldsRef.current()
    setError(null)
    setSending(false)
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
    openChat,
    startNew: startNewConversation,
    removeChat,
  } = useConversation({
    settings,
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

  const onBubbleTap = useCallback(
    (id: number) => {
      setPinnedId(id)
      if (!breakOpen) toggleBreak()
    },
    [breakOpen, toggleBreak]
  )
  const requestTurn = useCallback(
    async (body: { message?: string; greeting?: boolean; steering?: string }) => {
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
        setTurns((prev) => prev.map((t) => (t.id === pendingId ? fn(t) : t)))

      try {
        const channel = new Channel<GuidedEvent>()
        channel.onmessage = (event) => {
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
              if (autoSpeak) speakReply(event.reply)
              updatePending((t) => ({
                ...t,
                assistant: emptyAssistant(event.reply),
                analysisState: 'pending',
                pendingText: '',
              }))
              setSending(false)
              onBubbleTap(pendingId)
              break
            case 'analysis_section':
              // Turn scaffolds are the freshest suggestions — feed the chips.
              if (event.scaffolds) scaffolds.setFresh(event.scaffolds)
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
              logInfo(
                '[coach] feedback:', event.feedback.corrections.length, 'corrections,',
                'comp', event.feedback.comprehensibility, '/ grammar', event.feedback.grammar
              )
              updatePending((t) => ({ ...t, coach: event.feedback }))
              break
            case 'coach_failed':
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
              scaffolds.setFresh(event.turn.scaffolds)
              updatePending((t) => ({
                ...t,
                assistant: event.turn,
                analysisState: 'done',
              }))
              break
            case 'plan_updated': {
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
          greeting: body.greeting ?? false,
          steering: body.steering ?? null,
          level: steer.level,
          topic: steer.topic || null,
          onEvent: channel,
        })
        // Command resolved = reply pass done. Re-asserted here in case the
        // reply_done event and this resolution raced.
        setSending(false)
        updatePending((t) =>
          t.assistant ? t : { ...t, assistant: emptyAssistant(t.pendingText), analysisState: 'pending', pendingText: '' }
        )
      } catch (e) {
        logError('[guided] turn failed:', e)
        setTurns((prev) => prev.filter((t) => t.id !== pendingId))
        setError(String(e).replace(/^Error:\s*/, ''))
        setSending(false)
      }
    },
    [autoSpeak, onBubbleTap, speakReply, steer.level, steer.topic]
  )

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    stopSpeaking() // new turn: silence any ongoing playback
    await requestTurn({ message })
  }
  sendRef.current = send
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
        if (last?.assistant) speakReply(last.assistant.reply)
      } else if (combo === shortcuts.panel) {
        e.preventDefault()
        toggleBreakRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings?.shortcuts, speakReply])

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
    turnsRef,
    settingsRef,
    settingsLoaded: settings !== null,
    level: steer.level,
    topic: steer.topic,
    onSteered: (change) => void requestTurn({ message: '', steering: change }),
  })
  const chipsForUI = scaffolds.chipsFrom(bestScaffolds)
  clearScaffoldsRef.current = () => scaffolds.setFresh(null)
  clearWordsRef.current = words.clear

  // Context for the coach thread inside the unified panel.
  const buildCoachContext = useCallback(
    () => transcriptForCoach(turnsRef.current, COACH_CONTEXT_TURNS),
    []
  )


  const mic = useMicRecorder({
    micDeviceId: settings?.microphone_device_id,
    onTranscribe: (text: string) => {
      if (text) {
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

  // Mobile mode: below the breakpoint the window switches to a tabbed
  // single-surface layout (Chat / Coach / Analysis) instead of stacking
  // everything into one unusable column. The breakpoint itself lives in
  // useIsMobile — Settings reads the same one.
  const isMobile = useIsMobile()
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('chat')

  // Horizontal swipe walks the surfaces on mobile.
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0]
    swipe.current = { x: t0.clientX, y: t0.clientY, t: Date.now() }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Date.now() - start.t > SWIPE_MAX_MS) return
    // Clearly horizontal, or the gesture belongs to the scroller.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2) return
    const next = MOBILE_SURFACES.indexOf(mobileSurface) + (dx < 0 ? 1 : -1)
    if (next >= 0 && next < MOBILE_SURFACES.length) {
      setMobileSurface(MOBILE_SURFACES[next])
    }
  }
  return (
    <div
      className="split"
      onTouchStart={isMobile ? onTouchStart : undefined}
      onTouchEnd={isMobile ? onTouchEnd : undefined}
    >
      <ChatHistory
        open={historyOpen}
        chats={chats}
        currentId={currentChatId}
        languageName={targetLanguageName}
        onClose={() => setHistoryOpen(false)}
        onOpenChat={(id) => void openChat(id)}
        onNewChat={() => void startNewConversation()}
        onDeleteChat={(id) => void removeChat(id)}
      />
      {/* ── Chat half (paper) ─────────────────────────────────────────── */}
      <section className={`chat ${isMobile && mobileSurface !== 'chat' ? 'mobile-hidden' : ''}`}>
        <div className="chat-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Conversation · {targetLanguageName}</span>
          <button
            type="button"
            className="plan-toggle"
            onClick={() => setPlanOpen(true)}
            title="Teaching plan & profile"
          >
            Plan {plan?.session_focus.length ? `· ${plan.session_focus.length}` : ''}
          </button>
        </div>
        <div className="stream" ref={streamRef}>
          {turns.length === 0 && !error && !sending && (
            <p className="center-note" style={{ color: 'var(--ink-mut)', background: 'none', border: 'none' }}>
              Say hello to start the conversation.
            </p>
          )}
          {turns.map((turn) => (
            <TurnView
              key={turn.id}
              turn={turn}
              focused={(pinnedId ?? latestAssistantId) === turn.id}
              ttsReady={ttsReady}
              speaking={speaking}
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
            />
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

        {/* Composer */}
        <div className="composer">
          <div className="scaffold-block">
            <div className="scaffold-block-head">
              <span className="scaffold-block-title">Suggestions · for your next message</span>
              <span className="scaffold-status">
                {scaffolds.loading
                  ? '⟳ writing…'
                  : scaffolds.error
                    ? `⚠ ${scaffolds.error}`
                    : ''}
              </span>
              <button
                type="button"
                className="scaffold-toggle"
                onClick={scaffolds.toggle}
                aria-expanded={scaffolds.open}
                title={scaffolds.open ? 'Hide suggestions' : 'Show suggestions'}
              >
                {scaffolds.open ? '▾' : '▸'}
              </button>
            </div>
            {scaffolds.open && (
              <div className="scaffold-groups">
                <ScaffoldRow label="Say it" items={chipsForUI.replies} onPick={(s) => void send(s)} />
                <ScaffoldRow label="Build it" items={chipsForUI.frames} onPick={(f) => setInput(f)} />
                <ScaffoldRow label="Start it" items={chipsForUI.starters} onPick={(s) => setInput(`${s} `)} />
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
                </div>
              </div>
            )}
          </div>
          {mic.recording && mic.recAnalyser && (
            <WaveformStrip analyserNode={mic.recAnalyser} height={44} timelineSeconds={10} />
          )}
          <div className="steer-row">
            <select
              className="steer-select"
              value={steer.level}
              onChange={(e) => steer.setLevel(e.target.value)}
              aria-label="Learner level"
              title="Learner level — steers every prompt"
            >
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
            <button
              type="button"
              className="steer-dice"
              title="Start a new conversation — this one is archived, and the tutor keeps what it has learned about you"
              aria-label="New conversation"
              onClick={() => void startNewConversation()}
            >
              ✚
            </button>
          </div>
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
            <button
              type="button"
              className={`mic ${mic.recording ? 'recording' : ''}`}
              onClick={mic.toggleMic}
              disabled={!isTauri || sending}
              title={mic.recording ? 'Stop recording' : 'Record audio'}
              aria-label={mic.recording ? 'Stop recording' : 'Record audio'}
            >
              ●
            </button>
            {mic.recording && (
              <button
                type="button"
                className="mic-cancel"
                onClick={mic.cancel}
                title="Cancel recording (discard)"
                aria-label="Cancel recording"
              >
                ✕
              </button>
            )}
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
      </section>

      {/* ── Breakdown half (dark) — full panel in mobile Coach/Analysis mode ── */}
      <section
        className={`break ${breakOpen ? '' : 'collapsed'} ${
          isMobile && mobileSurface === 'chat' ? 'mobile-hidden' : ''
        }`}
        ref={breakRef}
      >
        <button
          type="button"
          className="break-head"
          onClick={toggleBreak}
          aria-expanded={breakOpen}
          title={breakOpen ? 'Collapse breakdown' : 'Expand breakdown'}
        >
          <span className="k">Breakdown · latest turn</span>
          <span className="head-right">
            <span className="live">● live</span>
            <span className="chev">{breakOpen ? '▾' : '▸'}</span>
          </span>
        </button>

        {/* Unified right panel: Coach + Analysis tabs (see panes/) */}
        <CoachAnalysisPanel
          turns={turns}
          targetLangCode={(settings?.target_language ?? 'es-ES').split('-')[0].toUpperCase()}
          nativeLangCode={(settings?.native_language ?? 'en').toUpperCase()}
          pinnedTurn={pinnedTurn}
          inspect={words.inspect}
          nativeLanguageName={nativeLanguageName}
          showRomanization={showRomanization}
          rtl={rtl}
          threadReload={threadReload}
          buildCoachContext={buildCoachContext}
        />
      </section>

      {/* The dev surface: the same DevPanel as the desktop dock and the
          popped-out window, here as the third swipe surface. */}
      {isMobile && (
        <section
          className={`dev-surface ${mobileSurface !== 'dev' ? 'mobile-hidden' : ''}`}
        >
          <DevPanel />
        </section>
      )}

      {/* Mobile bottom navigation: switch surfaces instead of stacking them */}
      {isMobile && (
        <nav className="mobile-nav">
          {(
            [
              ['chat', '💬', 'Chat'],
              ['panel', '🎓', 'Coach'],
              ['dev', '💭', 'Inside'],
            ] as [MobileSurface, string, string][]
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={`mobile-nav-item ${mobileSurface === id ? 'active' : ''}`}
              onClick={() => setMobileSurface(id)}
            >
              {icon} {label}
            </button>
          ))}
        </nav>
      )}

      {/* ── Plan & Profile drawer (fully observable) ──────────────────── */}
      {planOpen && (
        <div className="plan-backdrop" onClick={() => setPlanOpen(false)}>
          <div className="plan-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="plan-head">
              <span className="k">Teaching plan · profile</span>
              <button type="button" className="popup-x" onClick={() => setPlanOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="plan-body">
              {plan && (
                <>
                  <p className="sect-k">Session focus</p>
                  {plan.session_focus.length > 0 ? (
                    <div className="feats">
                      {plan.session_focus.map((f) => (
                        <span key={f} className="feat">
                          {f}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="plan-muted">Warming up — keep chatting and this fills in.</p>
                  )}

                  <p className="sect-k">Recast queue (correction budget: {plan.correction_budget}/reply)</p>
                  {plan.recurring_errors.length > 0 ? (
                    <ul className="plan-list">
                      {plan.recurring_errors.map((e, i) => (
                        <li key={i}>
                          <s>{e.error}</s> → <b>{e.correction}</b> <span className="plan-dim">×{e.seen_count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="plan-muted">No recurring errors yet.</p>
                  )}

                  {plan.vocab_recycle.length > 0 && (
                    <>
                      <p className="sect-k">Vocabulary to recycle</p>
                      <div className="feats">
                        {plan.vocab_recycle.map((v) => (
                          <span key={v} className="feat">
                            {v}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {plan.avoid.length > 0 && (
                    <>
                      <p className="sect-k">Avoid (overload guard)</p>
                      <div className="feats">
                        {plan.avoid.map((a) => (
                          <span key={a} className="feat">
                            {a}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {plan.energy_read && (
                    <>
                      <p className="sect-k">Learner energy</p>
                      <p className="plan-line">{plan.energy_read}</p>
                    </>
                  )}

                  {plan.taught_ledger.length > 0 && (
                    <>
                      <p className="sect-k">Taught so far</p>
                      <ul className="plan-list">
                        {plan.taught_ledger.map((t, i) => (
                          <li key={i}>
                            {t.mechanic} <span className="plan-dim">(turn {t.last_seen_turn})</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}

              {profile && (
                <>
                  <p className="sect-k" style={{ marginTop: 26 }}>
                    Profile · {profile.sessions} session{profile.sessions === 1 ? '' : 's'}
                  </p>
                  {profile.about && <p className="plan-line">{profile.about}</p>}
                  {profile.level_notes && (
                    <>
                      <p className="sect-k">Level read</p>
                      <p className="plan-line">{profile.level_notes}</p>
                    </>
                  )}
                  {profile.strengths.length > 0 && (
                    <>
                      <p className="sect-k">Strengths</p>
                      <div className="feats">
                        {profile.strengths.map((s) => (
                          <span key={s} className="feat">
                            {s}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {profile.weaknesses.length > 0 && (
                    <>
                      <p className="sect-k">Working on</p>
                      <div className="feats">
                        {profile.weaknesses.map((w) => (
                          <span key={w} className="feat">
                            {w}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {profile.interests.length > 0 && (
                    <>
                      <p className="sect-k">Interests</p>
                      <div className="feats">
                        {profile.interests.map((s) => (
                          <span key={s} className="feat">
                            {s}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {profile.long_term_errors.length > 0 && (
                    <>
                      <p className="sect-k">Long-term errors</p>
                      <ul className="plan-list">
                        {profile.long_term_errors.map((e, i) => (
                          <li key={i}>
                            <s>{e.error}</s> → <b>{e.correction}</b> <span className="plan-dim">×{e.seen_count}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
              {plan && (
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPlan(null)
                      setProfile(null)
                      void getPlan()
                        .then((docs) => {
                          const norm = normalizeDocs(docs.plan, docs.profile)
                          setPlan(norm.plan)
                          setProfile(norm.profile)
                          logInfo('[guided] plan refreshed')
                        })
                        .catch((e) => reportFault('Refreshing teaching plan', e))
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {words.popup && <GlossPopup popup={words.popup} onClose={words.closePopup} />}
      {words.insight && (
        <WordInsightModal
          word={words.insight.word}
          sentence={words.insight.sentence}
          onClose={words.closeInsight}
        />
      )}
    </div>
  )
}
