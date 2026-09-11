import { ReadingPreferencesProvider } from '../components/ReadingPreferences'
import { configureRewardSounds, stopRewardSounds } from '../lib/reward-sounds'
import { RewardPresentationProvider } from '../components/chat/RewardPresentation'
import { ActivityIndicator } from '../components/ActivityIndicator'
import { ComposerHelp } from '../components/panes/ComposerHelp'
import { TopicNotesProvider } from '../components/panes/TopicNotesProvider'
import { useSkillNavigation } from '../hooks/useSkillNavigation'
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { nativeError } from '../lib/workspace'
import type { Profile, Settings, TeachingPlan } from '../types'
import { unreportedInput, type InputEvidence } from '../lib/skills'
import { PracticeContext, DraftAssistanceContext } from '../components/panes/PracticeContext'
import { SkillRewards } from '../components/chat/SkillRewards'
import { GlossPopup } from '../components/GlossPopup'
import {
  getSettings,
  isTauri,
  languageFor,
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
import { WaveformStrip } from '../components/WaveformStrip'
import { WordInsightModal } from '../components/WordInsightModal'
import { EditFeedback } from '../components/chat/EditFeedback'
import { TurnView } from '../components/chat/TurnView'
import { DetailDialog } from '../components/DetailDialog'
import { AnalysisContent } from '../components/panes/AnalysisContent'
import { CoachAnalysisPanel } from '../components/panes/CoachAnalysisPanel'
import { logInfo, logWarn } from '../lib/log'
import { STEER_LEVELS, STEER_TOPICS, useSteering } from '../hooks/useSteering'
import { PersonaField } from '../components/PersonaField'
import { TopicField } from '../components/TopicField'
import { ChatHistory } from '../components/ChatHistory'
import { latestAnswered, latestScaffolds } from '../lib/turns'
import { useConversation } from './guided/useConversation'
import { useScaffolds } from './guided/useScaffolds'
import { useWordInspection } from './guided/useWordInspection'
import { useMicRecorder } from '../hooks/useMicRecorder'
import { usePersistentToggle } from '../hooks/useSteering'
import { useIsMobile } from '../hooks/useIsMobile'
import { reportFault } from '../lib/faults'
import { needsProviderSetup } from '../lib/providers'

export type MobileLocation = 'chat' | 'panel'

export default function GuidedPage({
  active,
  languagePicker,
  mobileSurface,
  onMobileSurfaceChange: setMobileLocation,
  settingsVersion = 0,
  historyOpen = false,
  onHistoryOpenChange,
  onOpenSettings,
}: {
  active: boolean
  languagePicker: ReactNode
  mobileSurface: MobileLocation
  onMobileSurfaceChange: (surface: MobileLocation) => void
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
  const errorRef = useRef(error)
  errorRef.current = error
  const [input, setInputState] = useState('')
  const inputRevision = useRef(0)
  const setInput = useCallback((value: string | ((previous: string) => string)) => { inputRevision.current += 1; setInputState(value) }, [])
  const inputEvidence = useRef<InputEvidence>(unreportedInput())
  // Set while the learner is retrying a past message: the composer is
  // pre-filled with what they said, and sending it discards that turn and
  // everything after it, then regenerates from the edited text.
  const [editingTurnId, setEditingTurnId] = useState<number | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [plan] = useState<TeachingPlan | null>(null)
  const [profile] = useState<Profile | null>(null)
  // Whether the webview's own speech engine is usable. Some webviews (notably
  // Android's) implement no speechSynthesis, making the OS engine unavailable
  // there; the cloud engine is unaffected.
  const [osVoiceReady, setOsVoiceReady] = useState(speechSupported())
  const ttsEngine = settings?.tts_engine ?? 'cloud'
  const ttsReady = ttsAvailable(ttsEngine, osVoiceReady)
  useEffect(() => {
    if (settings) configureRewardSounds(settings.reward_sounds, settings.auto_speak)
    if (!active) stopRewardSounds()
  }, [settings?.reward_sounds, settings?.auto_speak, active])
  useEffect(() => () => stopRewardSounds(), [])
  const [panelTab, setPanelTab] = useState<'lesson' | 'analysis'>('lesson')
  const [coachDraft, setCoachDraft] = useState('')
  const [reviewing, setReviewing] = useState<Set<number>>(new Set())
  const [observationStatus, setObservationStatus] = useState('May lag behind the latest lesson choices.')
  const consumeCoachDraft = useCallback(() => setCoachDraft(''), [])
  const { open: breakOpen, toggle: toggleBreak } = usePersistentToggle('skellyspeak_break', true)
  const steer = useSteering()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsPanel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!settingsOpen) return
    const dismiss = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[role="dialog"]')) return
      if (!settingsPanel.current?.contains(target as Node)) setSettingsOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setSettingsOpen(false)
        settingsPanel.current?.querySelector<HTMLButtonElement>('.chat-config-toggle')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [settingsOpen])
  const words = useWordInspection({ pinTurn: setPinnedId, breakOpen, toggleBreak })
  // Panel reload counter: bumped when the coach thread is reset externally.
  const [threadReload, setThreadReload] = useState(0)

  // Speaking state drives the 🔊/⏹ affordance on every bubble.
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => subscribeSpeaking(setSpeaking), [])
  const [speechProgress, setSpeechProgress] = useState<SpeechProgress | null>(null)
  const [, setSavingSpeechRate] = useState(false)
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

  // Also assigned below: `resetView` runs above the scaffolds hook because
  // `useConversation` needs it, so it clears the chips through a ref.
  const clearScaffoldsRef = useRef<() => void>(() => {})
  const clearWordsRef = useRef<() => void>(() => {})
  const {
    turns,
    turnsRef,
    chats,
    currentChatId,
    openingFailed,
    chatIdRef,
    openChat,
    startNew: startNewConversation,
    removeChat,
    flush,
    sendMessage,
    pendingReply,
    snapshotRevision,
  } = useConversation({
    settings,
    setHistoryOpen,
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
        logInfo('[guided] settings:')
        // A saved settings refresh supersedes the missing-provider banner.
        // Only an empty chat retries its greeting; existing turns stay intact.
        if (settingsVersion > 0 && errorRef.current && needsProviderSetup(errorRef.current)) {
          errorRef.current = null
          setError(null)
        }
      })
      .catch((e) => reportFault('Loading settings', e))
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
      setAnalysisOpen(true)
    },
    []
  )
  const acceptingSend = useRef(false)
  useEffect(() => setSending(pendingReply), [pendingReply, snapshotRevision])
  const requestTurn = useCallback(async (body: { message?: string; steering?: string; replacesMessageId?: number; inputEvidence?: InputEvidence }) => {
    if (body.replacesMessageId !== undefined || body.steering !== undefined) {
      setError('This action is not connected yet.')
      return
    }
    const text = body.message?.trim()
    if (!text || acceptingSend.current) return
    acceptingSend.current = true
    const submittedDraftRevision = inputRevision.current
    setSending(true)
    setError(null)
    try {
      await sendMessage(text)
    } catch (error) {
      setError(nativeError(error))
      if (inputRevision.current === submittedDraftRevision) setInput(text)
      setSending(false)
    } finally { acceptingSend.current = false }
  }, [sendMessage])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    const provenance = { ...inputEvidence.current, revision: editingTurnId !== null }
    inputEvidence.current = unreportedInput()
    setInput('')
    stopSpeaking() // new turn: silence any ongoing playback
    const replacesMessageId = editingTurnId ?? undefined
    await requestTurn({ message, replacesMessageId, inputEvidence: provenance })
  }
  sendRef.current = send

  const cancelEdit = useCallback(() => {
    inputEvidence.current = unreportedInput()
    setEditingTurnId(null)
    setInput('')
  }, [])
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

  const [savingReading, setSavingReading] = useState(false)
  const readingWrite = useRef(false)
  const toggleSetting = useCallback(async (key: 'auto_speak' | 'auto_send' | 'always_romanize' | 'auto_translate' | 'always_pronunciation' | 'fast_mode') => {
    if (!settings || readingWrite.current) return
    readingWrite.current = true
    setSavingReading(true)
    try {
      await saveSettings({ ...settings, [key]: !settings[key] })
      setSettings(await getSettings())
    } catch (error) { reportFault('Saving reading preference', nativeError(error)) }
    finally { readingWrite.current = false; setSavingReading(false) }
  }, [settings])

  const targetLanguageName = settings ? languageFor(settings.target_language)?.endonym ?? settings.target_language : ''
  const nativeLanguageName = settings ? languageFor(settings.native_language)?.endonym ?? settings.native_language : ''
  const bestScaffolds = latestScaffolds(turns)
  const pinnedTurn = turns.find(t => t.id === (pinnedId ?? latestAssistantId) && t.assistant) ?? null

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
    conversationId: currentChatId,
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
  })
  toggleMicRef.current = mic.toggleMic

  const aiBusy = pendingReply

  useEffect(() => { if (words.inspect) setAnalysisOpen(true) }, [words.inspect])

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
          <div className="composer-activity" aria-live="polite">
            {mic.transcribing ? <ActivityIndicator label="Transcribing audio…" /> : sending ? <ActivityIndicator label="Partner is replying…" /> : (aiBusy || turns.some(turn => turn.analysisState === 'pending') || reviewing.size > 0) ? <ActivityIndicator label="AI is analysing…" /> : null}
          </div>
          {mic.recording && mic.waveSource && (
            <WaveformStrip source={mic.waveSource} height={44} timelineSeconds={10} />
          )}
          {<ComposerHelp
            key={`${currentChatId}:${turns.at(-1)?.id}`}
            busy={sending}
            help={turns.at(-1)?.assistant?.scaffolds.coach_help ?? null}
            pending={sending || turns.at(-1)?.analysisState === 'pending'}
            errors={turns.at(-1)?.assistant?.errors ?? []}
            onUse={(text, source) => {
              inputEvidence.current = { ...inputEvidence.current, [source]: true }
              setInput(previous => previous.trim() ? `${previous.trimEnd()} ${text}` : text)
              composer.current?.querySelector<HTMLInputElement>('.field')?.focus()
            }} />}
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
    <ReadingPreferencesProvider settings={settings}><RewardPresentationProvider fastMode={settings?.fast_mode ?? true} workspace={workspace} chatId={currentChatId} active={active}><TopicNotesProvider scope={`${settingsVersion}:${settings?.target_language}:${settings?.native_language}`}><PracticeContext value={{ chatId: currentChatId, selectionVersion: navigation.state.sequence, selected: navigation.state.selected && navigation.state.selected.target === settings?.target_language ? navigation.state.selected.skillId : null, select: skillId => { if (!settings) throw new Error('Settings are not loaded'); navigation.select({ target: settings.target_language, skillId }) } }}><DraftAssistanceContext value={{ suggestions: chipsForUI, suggestionsError: null, useExample: (text, source) => { inputEvidence.current = { ...inputEvidence.current, [source]: true }; setInput(previous => previous.trim() ? `${previous.trimEnd()} ${text}` : text) } }}>
    <div className="guided-workspace">
    <div
      ref={workspace}
      className={`split ${isMobile ? 'mobile-conversation' : ''} ${isMobile && mobileSurface === 'panel' ? 'mobile-lesson' : ''}`}
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
      <section className="chat">
        <div className="chat-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="conversation-title" aria-label="Current conversation settings">{languagePicker}<small>{STEER_LEVELS.find(item => item.value === steer.level)?.label ?? steer.level}{steer.topic ? ` · ${steer.topic}` : ''}</small></div>
          <div className="chat-heading-actions">
          <div className="chat-config" ref={settingsPanel}>
            <button type="button" className="chat-config-toggle" aria-label="Settings & voice" aria-expanded={settingsOpen} aria-controls="chat-settings" title={settingsOpen ? 'Hide chat settings' : 'Show chat settings'} onClick={() => setSettingsOpen(open => !open)}>⚙</button>
            {settingsOpen && <div id="chat-settings" className="scaffold-groups chat-config-panel" role="region" aria-label="Chat settings">
                <fieldset className="conversation-controls" disabled={sending}>
                <fieldset className="steer-row" disabled title="Conversation steering is not connected yet.">
                  <select
                    disabled
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
                </fieldset>
                {(currentChatId || openingFailed) && <PersonaField
                  chatId={currentChatId}
                  onChange={(id) => {
                    void openChat(id).catch(error => reportFault('Opening conversation', nativeError(error)))
                  }}
                />}
                </fieldset>

                {/* The same Settings record the modal edits — Rust owns it,
                    these are a second VIEW of one variable, not a copy. */}
                <div className="quick-toggles" role="group" aria-label="Reading and voice options">
                  {(
                    [
                      ['auto_speak', 'Read aloud', 'Speak each reply automatically'],
                      ['auto_send', 'Auto-send', 'Send speech transcriptions immediately'],
                      ['auto_translate', 'Translation', 'Always show the translation under each reply'],
                      ['always_pronunciation', 'Pronunciation', 'Show saved pronunciation in replies and coach advice'],
                      ['fast_mode', 'Fast mode', 'Automatically dismiss new XP cards; point icons reopen them'],
                      ...(showRomanization
                        ? ([['always_romanize', 'Romanization', 'Always show romanization under each word']] as const)
                        : []),
                    ] as [
                      'auto_speak' | 'auto_send' | 'auto_translate' | 'always_romanize' | 'always_pronunciation' | 'fast_mode',
                      string,
                      string,
                    ][]
                  ).map(([key, label, title]) => (
                    <button
                      key={key}
                      type="button"
                      className={`quick-toggle ${settings?.[key] ? 'on' : ''}`}
                      onClick={() => void toggleSetting(key)}
                      aria-pressed={settings?.[key] ?? false}
                      title={title}
                      disabled={!settings || savingReading || ['auto_speak', 'auto_send', 'fast_mode'].includes(key)}
                    >
                      {settings?.[key] ? '☑' : '☐'} {label}
                    </button>
                  ))}
                  <label className="speech-speed" title={ttsEngine === 'cloud'
                    ? 'Adjust playback speed while keeping the natural pitch.'
                    : 'Speed changes apply on replay.'}>
                    Voice speed
                    <select aria-label="Voice playback speed" value={settings?.tts_rate ?? 1}
                      disabled={true}
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


          {!isMobile && (
          <button
            type="button"
            className="plan-toggle"
            onClick={() => { setPanelTab('lesson'); setMobileLocation('panel'); if (!breakOpen) toggleBreak() }}
            title="Show lesson and coach"
          >
            Lesson & coach
          </button>
          )}
          <button type="button" className="new-chat" aria-label="New chat"
            title="Start a new chat — this conversation stays in history"
            disabled={!settings || sending}
            onClick={() => void startNewConversation(steer.persona)}>+</button>
          </div>
        </div>
        <SkillRewards chatId={currentChatId} active={active} />
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
              onAskCoach={setCoachDraft}
              focused={(pinnedId ?? latestAssistantId) === turn.id}
              ttsReady={ttsReady}
              speaking={speaking && speechProgress?.utteranceId === String(turn.id)}
              revealed={words.revealed}
              showRomanization={showRomanization}
              alwaysRomanize={alwaysRomanize}
              alwaysPronunciation={settings?.always_pronunciation ?? false}
              autoTranslate={settings?.auto_translate ?? false}
              rtl={rtl}
              onReveal={words.reveal}
              onBubbleTap={onBubbleTap}
              onSpeak={speakReply}
              onPopup={words.setPopup}
              onInspect={words.inspectWord}
              onHold={words.holdWord}
              onToggleReveal={words.toggleReveal}
              onEditUser={undefined}
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

      {isMobile && <div className="chat mobile-composer">{chatComposer}</div>}

      {/* ── Breakdown half (dark) — full panel in mobile Coach/Analysis mode ── */}
      <section
        className={`break ${breakOpen || isMobile ? '' : 'collapsed'}`}
        ref={breakRef}
      >
        {!breakOpen && !isMobile && <button type="button" className="break-head" onClick={toggleBreak} aria-expanded={false}>Open lesson &amp; coach ▸</button>}

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

    </div>

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
    </DraftAssistanceContext></PracticeContext></TopicNotesProvider></RewardPresentationProvider></ReadingPreferencesProvider>
  )
}
