import { useCallback, useEffect, useRef, useState } from 'react'
import { Channel, invoke } from '@tauri-apps/api/core'
import type {
  GuidedEvent,
  GuidedTurnResult,
  Profile,
  Settings,
  Scaffolds,
  TeachingPlan,
} from '../types'
import { DevPanel } from '../components/dev/DevPanel'
import { GlossPopup, type PopupState } from '../components/GlossPopup'
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
import { STEER_LEVELS, STEER_TOPICS, useSteering, armGreeting, disarmGreeting } from '../hooks/useSteering'
import { useMicRecorder } from '../hooks/useMicRecorder'
import { usePersistentToggle } from '../hooks/useSteering'

interface Turn {
  id: number
  user: string | null
  assistant: GuidedTurnResult | null
  pendingText: string
  analysisState: 'pending' | 'done' | 'failed' | null
  coach?: { comprehensibility: number; grammar: number; remark: string; used_target: string[]; used_native: string[]; corrections: { said: string; corrected: string; kind: string; explanation: string }[] }
  coachError?: string
}


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

export default function GuidedPage({ settingsVersion = 0 }: { settingsVersion?: number }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [plan, setPlan] = useState<TeachingPlan | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ttsReady, setTtsReady] = useState(speechSupported())
  const autoSpeak = settings?.auto_speak ?? false
  const [wordPopup, setWordPopup] = useState<PopupState | null>(null)
  const closePopup = useCallback(() => setWordPopup(null), [])
  const [planOpen, setPlanOpen] = useState(false)
  useEffect(
    () => (planOpen ? openOverlay(() => setPlanOpen(false)) : undefined),
    [planOpen]
  )
  useEffect(
    () => (wordPopup ? openOverlay(() => setWordPopup(null)) : undefined),
    [wordPopup]
  )
  const { open: breakOpen, toggle: toggleBreak } = usePersistentToggle('skellyspeak_break', true)
  const steer = useSteering()
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const onReveal = useCallback((keys: string[]) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      for (const k of keys) next.add(k)
      return next
    })
  }, [])
  const [inspect, setInspect] = useState<{ turn: number; side: 'me' | 'bot'; index: number } | null>(
    null
  )

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
      void speakSmart(text, lang, engine, voice).then((ok) => {
        if (!ok) logWarn('[tts] speech unavailable or empty text')
      })
    },
    [settings?.target_language, settings?.tts_engine, settings?.tts_voice]
  )

  const streamRef = useRef<HTMLDivElement | null>(null)
  const nextIdRef = useRef(1)
  const turnsRef = useRef<Turn[]>([])
  turnsRef.current = turns
  const breakRef = useRef<HTMLDivElement | null>(null)

  const settingsRef = useRef<Settings | null>(null)
  settingsRef.current = settings
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {})
  const toggleMicRef = useRef<() => void>(() => {})
  const toggleBreakRef = useRef<() => void>(() => {})

  useEffect(() => {
    logInfo('[guided] page mounted, isTauri =', isTauri)
    void loadVoices().then((v) => {
      setTtsReady(v.length > 0 || speechSupported())
      if (!v.length) logWarn('[tts] no OS voices found — speech disabled')
    })
    // Greeting fires once settings are loaded — it must include the saved
    // level/topic, so it waits for `settings`. A new session also clears the
    // coach thread. Skips if a turn already exists (HMR remount safety).
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
        if (isTauri && armGreeting() && turnsRef.current.length === 0) {
          logInfo('[guided] firing greeting turn')
          void requestTurn({ greeting: true })
          void invoke('coach_thread_clear').catch((e: unknown) =>
            logWarn('[coach] thread reset failed:', e)
          )
          setThreadReload((v) => v + 1)
          setRevealed(new Set())
          setFreshScaffolds(null)
        }
      })
      .catch((e) => logWarn('[guided] settings load failed:', e))
    void getPlan()
      .then((docs) => {
        const norm = normalizeDocs(docs.plan, docs.profile)
        setPlan(norm.plan)
        setProfile(norm.profile)
        logInfo('[guided] plan loaded:', {
          focus: docs.plan.session_focus,
          errors: docs.plan.recurring_errors.length,
        })
      })
      .catch((e) => logWarn('[guided] plan load failed:', e))
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

      const history = turnsRef.current
        .filter((t) => t.assistant !== null)
        .flatMap((t) => {
          const items: { role: string; content: string }[] = []
          if (t.user) items.push({ role: 'user', content: t.user })
          items.push({ role: 'assistant', content: t.assistant!.reply })
          return items
        })
        .slice(-30)

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
              if (event.scaffolds) setFreshScaffolds(event.scaffolds)
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
              setFreshScaffolds(event.turn.scaffolds)
              updatePending((t) => ({
                ...t,
                assistant: event.turn,
                analysisState: 'done',
              }))
              break
            case 'analysis_failed':
              logWarn('[guided] analysis failed (reply-only turn):', event.error)
              updatePending((t) => ({
                ...t,
                analysisState: 'failed',
                assistant: t.assistant
                  ? {
                      ...t.assistant,
                      scaffolds: { replies: [], frames: [], starters: [] },
                    }
                  : t.assistant,
              }))
              break
            case 'plan_updated':
              logInfo('[guided] plan updated:', {
                focus: event.plan.session_focus,
                errors: event.plan.recurring_errors.length,
              })
              const norm = normalizeDocs(event.plan, event.profile)
              setPlan(norm.plan)
              setProfile(norm.profile)
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
        // Command resolved = reply pass done (fallback if the event raced).
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

  // Language pair changed → full conversation reset aligned to the new
  // pairing: turns, reveals, scaffolds, Q&A, and the coach thread are all
  // pair-specific (Rust archives the old documents on save; the greeting
  // fires fresh in the new language).
  const langPair = settings ? `${settings.target_language}|${settings.native_language}` : null
  const prevLangPair = useRef<string | null>(null)
  useEffect(() => {
    if (!langPair) return
    const prev = prevLangPair.current
    prevLangPair.current = langPair
    if (prev === null || prev === langPair) return
    logInfo('[guided] language pair changed:', prev, '->', langPair, '— resetting conversation')
    setTurns([])
    setPinnedId(null)
    setRevealed(new Set())
    setFreshScaffolds(null)
    setInspect(null)
    setWordPopup(null)
    setError(null)
    setSending(false)
    stopSpeaking()
    disarmGreeting()
    void requestTurn({ greeting: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langPair])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setInput('')
    stopSpeaking() // new turn: silence any ongoing playback
    await requestTurn({ message })
  }
  sendRef.current = send
  toggleBreakRef.current = toggleBreak

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
        const last = [...turnsRef.current].reverse().find((t) => t.assistant)
        if (last?.assistant) speakReply(last.assistant.reply)
      } else if (combo === shortcuts.panel) {
        e.preventDefault()
        toggleBreakRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings?.shortcuts, speakReply])

  const latestAssistantId = [...turns].reverse().find((t) => t.assistant)?.id ?? null

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
        void saveSettings(next).catch((e) => logError('[settings] quick toggle failed:', e))
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

  const latestScaffolds: Scaffolds | undefined = [...turns]
    .reverse()
    .find(
      (t) =>
        t.assistant &&
        (t.assistant.scaffolds.replies.length > 0 ||
          t.assistant.scaffolds.frames.length > 0 ||
          t.assistant.scaffolds.starters.length > 0)
    )?.assistant?.scaffolds
  const pinnedTurn =
    turns.find((t) => t.id === (pinnedId ?? latestAssistantId) && t.assistant) ?? null

  // Right-click on a word: pin the turn, open the breakdown, highlight the
  // token in the word lists.
  const onWordInspect = useCallback(
    (turnId: number, side: 'me' | 'bot', index: number) => {
      setPinnedId(turnId)
      setInspect({ turn: turnId, side, index })
      if (!breakOpen) toggleBreak()
    },
    [breakOpen, toggleBreak]
  )

  // Deep word insight (press-and-hold / analysis-pane click): a modal that
  // hydrates lemma, morphology, grammatical role, and a usage note.
  const [wordInsight, setWordInsight] = useState<{ word: string; sentence: string } | null>(
    null
  )
  const closeInsight = useCallback(() => setWordInsight(null), [])
  const onHoldWord = useCallback(
    (word: string, sentence: string) => setWordInsight({ word, sentence }),
    []
  )

  // Reveal toggling: drag adds; dblclick toggles the whole bubble
  // (reveal-all ⇄ hide-all).
  const onToggleReveal = useCallback((keys: string[]) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      const allOn = keys.every((k) => prev.has(k))
      for (const k of keys) {
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }, [])



  // Fresh scaffolds: regenerated when steering changes, so suggestions track
  // level/topic instead of going stale. Turn analysis clears this override.
  const [freshScaffolds, setFreshScaffolds] = useState<Scaffolds | null>(null)
  const [scaffoldsLoading, setScaffoldsLoading] = useState(false)
  const [scaffoldsError, setScaffoldsError] = useState<string | null>(null)
  const { open: scaffoldsOpen, toggle: toggleScaffolds } = usePersistentToggle('skellyspeak_scaffolds', true)
  const scaffoldsLoadingRef = useRef(false)
  const regenerateScaffolds = useCallback(
    async (level: string, topic: string) => {
      if (!isTauri || scaffoldsLoadingRef.current) return
      scaffoldsLoadingRef.current = true
      setScaffoldsLoading(true)
      setScaffoldsError(null)
      try {
        const history = turnsRef.current
          .filter((t) => t.assistant !== null)
          .flatMap((t) => {
            const items: { role: string; content: string }[] = []
            if (t.user) items.push({ role: 'user', content: t.user })
            items.push({ role: 'assistant', content: t.assistant!.reply })
            return items
          })
          .slice(-8)
        const s = await invoke<Scaffolds>('generate_scaffolds', {
          req: { history, level, topic: topic || null, dialect: settings?.target_dialect || null },
        })
        setFreshScaffolds(s)
      } catch (e) {
        setScaffoldsError(String(e).replace(/^Error:\s*/, ''))
      } finally {
        scaffoldsLoadingRef.current = false
        setScaffoldsLoading(false)
      }
    },
    []
  )
  // Steering change: regenerate scaffolds AND have the partner re-open the
  // conversation aligned to the new level/topic. Skips until settings have
  // loaded AND the greeting has fired — the greeting itself is the first
  // steered message, so the first settle here must not double-send. The
  // first-run guard is only consumed AFTER settings load; a guard consumed
  // while settings were absent would let the settingsLoaded transition fire
  // a spurious steering turn on top of the greeting.
  const steerInitialized = useRef(false)
  const lastSteer = useRef<string | null>(null)
  const settingsLoaded = settings !== null
  useEffect(() => {
    if (!settingsLoaded) return
    const key = `${steer.level}|${steer.topic}`
    if (!steerInitialized.current) {
      steerInitialized.current = true
      lastSteer.current = key
      return
    }
    // The effect also re-runs when `requestTurn` changes identity — and it
    // does that whenever the language changes, because `speakReply` is one of
    // its deps. That fired a steering turn straight after the post-switch
    // greeting, which is the "it doubles the first message" bug. React to the
    // VALUES, not to callback identity.
    if (lastSteer.current === key) return
    lastSteer.current = key
    const t = setTimeout(() => {
      void regenerateScaffolds(steer.level, steer.topic)
      const change = [
        steer.level ? `level: ${steer.level}` : null,
        steer.topic ? `topic: ${steer.topic}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      void requestTurn({ message: '', steering: change })
    }, 300)
    return () => clearTimeout(t)
  }, [steer.level, steer.topic, regenerateScaffolds, requestTurn, settingsLoaded])

  // Chips: fresh steer-driven scaffolds win; otherwise the newest turn that
  // produced any (best-available across turns).
  const chipsForUI: Scaffolds =
    freshScaffolds ??
    latestScaffolds ?? { replies: [], frames: [], starters: [] }

  // Context for the coach thread inside the unified panel.
  const buildCoachContext = useCallback(() => {
    return turnsRef.current
      .slice(-8)
      .flatMap((t) =>
        [
          t.user ? `LEARNER: ${t.user}` : null,
          t.assistant ? `NATIVE: ${t.assistant.reply}` : null,
        ].filter(Boolean) as string[]
      )
      .join('\n')
  }, [])

  // Analysis highlight: scroll the inspected token into view.
  useEffect(() => {
    if (!inspect) return
    const el = document.querySelector('.tok.inspected')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [inspect])

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

  // Analysis highlight scroll.
  useEffect(() => {
    if (!inspect) return
    const el = document.querySelector('.tok.inspected')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [inspect])

  // Mobile mode: below the breakpoint the window switches to a tabbed
  // single-surface layout (Chat / Coach / Analysis) instead of stacking
  // everything into one unusable column.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 860
  )
  // Three surfaces on mobile, in this order. The dev panel is the last one
  // deliberately: it is the deepest rung of the disclosure ladder, always
  // reachable but never in the way.
  const MOBILE_SURFACES = ['chat', 'panel', 'dev'] as const
  type MobileSurface = (typeof MOBILE_SURFACES)[number]
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('chat')

  // Horizontal swipe walks the surfaces on mobile. Only claims gestures that
  // are clearly horizontal (>|dx|, >2x|dy|, <600ms) so vertical chat
  // scrolling and drag-to-reveal are untouched.
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0]
    swipe.current = { x: t0.clientX, y: t0.clientY, t: Date.now() }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Date.now() - s.t > 600) return
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return
    const i = MOBILE_SURFACES.indexOf(mobileSurface)
    const next = dx < 0 ? i + 1 : i - 1
    if (next >= 0 && next < MOBILE_SURFACES.length) {
      setMobileSurface(MOBILE_SURFACES[next])
    }
  }
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div
      className="split"
      onTouchStart={isMobile ? onTouchStart : undefined}
      onTouchEnd={isMobile ? onTouchEnd : undefined}
    >
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
              revealed={revealed}
              showRomanization={showRomanization}
              alwaysRomanize={alwaysRomanize}
              autoTranslate={settings?.auto_translate ?? false}
              rtl={rtl}
              onReveal={onReveal}
              onBubbleTap={onBubbleTap}
              onSpeak={speakReply}
              onPopup={setWordPopup}
              onInspect={onWordInspect}
              onHold={onHoldWord}
              onToggleReveal={onToggleReveal}
            />
          ))}
          {error && <div className="err">{error}</div>}
        </div>

        {/* Composer */}
        <div className="composer">
          <div className="scaffold-block">
            <div className="scaffold-block-head">
              <span className="scaffold-block-title">Suggestions · for your next message</span>
              <span className="scaffold-status">
                {scaffoldsLoading
                  ? '⟳ writing…'
                  : scaffoldsError
                    ? `⚠ ${scaffoldsError}`
                    : ''}
              </span>
              <button
                type="button"
                className="scaffold-toggle"
                onClick={toggleScaffolds}
                aria-expanded={scaffoldsOpen}
                title={scaffoldsOpen ? 'Hide suggestions' : 'Show suggestions'}
              >
                {scaffoldsOpen ? '▾' : '▸'}
              </button>
            </div>
            {scaffoldsOpen && (
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
            <select
              className="steer-select topic"
              value={steer.topic}
              onChange={(e) => steer.setTopic(e.target.value)}
              aria-label="Conversation topic"
              title="Topic steering — the tutor works the conversation toward this"
            >
              <option value="">Topic: anything</option>
              {STEER_TOPICS.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
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
          inspect={inspect}
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
                        .catch((e) => logError('[guided] plan refresh failed:', e))
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

      {wordPopup && <GlossPopup popup={wordPopup} onClose={closePopup} />}
      {wordInsight && (
        <WordInsightModal
          word={wordInsight.word}
          sentence={wordInsight.sentence}
          onClose={closeInsight}
        />
      )}
    </div>
  )
}
