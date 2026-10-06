import { AskCoachContext } from '../src/components/learning/AskCoachButton'
import { CoachChatLayout } from '../src/features/conversation/coaching/CoachChatLayout'
import { CoachPanelTabs } from '../src/features/conversation/coaching/CoachPanelTabs'
/** Layout review using production components and sample data. No native or AI calls. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { AiViewPanel } from '../src/features/activity/AiViewPanel'
import { aiTraySlot } from '../src/state/navigation/ai-tray'
import { AI_VIEW_CONVERSATION, aiViewCommand, presentTurn } from './ai-view-fixture'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '../src/app/shell/TopBar'
import { ToolbarIcon } from '../src/components/controls/ToolbarIcon'
import { DifficultySelect } from '../src/components/controls/DifficultySelect'
import { ConversationHeader } from '../src/features/conversation/session/ConversationHeader'
import { ConversationSettings } from '../src/features/conversation/session/ConversationSettings'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { PersonaPicker } from '../src/features/conversation/partners/PersonaPicker'
import { ConversationStart } from '../src/features/conversation/session/ConversationStart'
import { ComposerInput } from '../src/features/conversation/composer/ComposerInput'
import { MicrophoneSelector } from '../src/components/media/MicrophoneSelector'
import { MicrophoneCheck } from '../src/components/media/MicrophoneCheck'
import { LiveRecording } from '../src/components/media/LiveRecording'
import { useRecorderLayout } from '../src/components/media/useRecorderLayout'
import { createSpectrumFeed, mergeSpectrum } from '../src/domain/audio/spectrum-feed'
import { ResizeHandle, useStoredSize } from '../src/components/layout/ResizeHandle'
import type { WaveSource } from '../src/domain/audio/waveform'
import type { AudioInspection } from '../src/generated/contracts'
import spectra from './spectrogram-fixture.json'
import { MessageReadingScope } from '../src/features/conversation/reading/MessageReadingScope'
import { replyHelpFixture } from '../src/features/conversation/composer/ReplyHelp.fixtures'
import { ReplyHelp } from '../src/features/conversation/composer/ReplyHelp'
import { TurnView } from '../src/features/conversation/messages/TurnView'
import { PracticeDivider } from '../src/features/conversation/messages/PracticeDivider'
import { ConversationFeedbackCard } from '../src/features/conversation/coaching/ConversationFeedbackCard'
import { ReadingHelp } from '../src/components/reading/ReadingHelp'
import type { ReadingServices } from '../src/components/reading/ReadingContext'
import { ReadingProvider } from '../src/components/reading/TargetText'
import { ReadingPreferencesProvider } from '../src/components/reading/ReadingPreferences'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { useWidthTier } from '../src/components/layout/useWidthTier'
import { useNavigationStore } from '../src/state/navigation/navigation'
import { AiStatus } from '../src/features/conversation/composer/AiStatus'
import { useSessionStore } from '../src/state/session/session'
import { useConnectionHealth } from '../src/state/session/connection-health'
import { useAttemptStreams } from '../src/state/session/attempt-streams'
import { PREVIEW_SETTINGS } from './preview-settings'
import { DEFAULT_APPEARANCE } from '../src/generated/contracts'
import type { ConversationFeedback, ConversationStartConfig, TopicCard, TurnView as RecordedTurn } from '../src/generated/contracts'
import '../src/styles/index.css'

// Production controls may expose native-only actions (for example Customize).
// Keep those explicit and isolated instead of reaching a workspace from a fixture.
// The language registry is read through IPC before the first render, so the
// preview answers that read and simulates the add-to-Drill receipt; it refuses other
// native action. Without it the whole surface throws and renders blank.
const previewLanguages = [
  { transcriptionLanguage:'zh',languageTag:'zh-CN',fontScale:1,id:'mandarin',name:'Mandarin',nativeName:'中文',direction:'ltr',romanization:'pinyin',defaultVariety:'mandarin-mainland',varieties:[{transcriptionLanguage:'zh',id:'mandarin-mainland',name:'Mainland',description:'Mainland',direction:'ltr',fontScale:1,romanization:'pinyin'}]},
  { transcriptionLanguage: 'es', languageTag: 'es', fontScale: 1, id: 'spanish', name: 'Spanish', nativeName: 'Español', direction: 'ltr', romanization: null, defaultVariety: 'spanish-spain',
    varieties: [{ transcriptionLanguage: 'es', id: 'spanish-spain', name: 'Spain', description: 'Spain', direction: 'ltr', fontScale: 1, romanization: null }] },
  { transcriptionLanguage: 'en', languageTag: 'en', fontScale: 1, id: 'english', name: 'English', nativeName: 'English', direction: 'ltr', romanization: null, defaultVariety: 'english-united-states',
    varieties: [{ transcriptionLanguage: 'en', id: 'english-united-states', name: 'United States', description: 'United States', direction: 'ltr', fontScale: 1, romanization: null }] },
]
// The AI View reads a conversation mid-turn, so its tray and full screen show a live graph.
const aiViewTurns = [presentTurn(14, 'live'), presentTurn(99, 'older')]
mockIPC((command, args) => {
  const aiView = aiViewCommand(command, args, aiViewTurns)
  if (aiView !== undefined) return aiView
  if (command === 'inspect_message_speech') return spectra[0]
  if (command === 'create_drill_item') return { id: 'preview-drill-copy' }
  if (command === 'get_snapshot') return { languages: previewLanguages, savedTopics: [{ id: 'preview-saved', text: 'Mi barrio' }], conversations: [AI_VIEW_CONVERSATION] } as unknown
  if (command === 'list_microphones') return { source: 'native', devices: [{ id: 'sample-microphone', label: 'Sample microphone', isDefault: true, channels: 1, sampleRate: 48000, unavailable: null }] }
  // The local microphone check in Recording settings: a sample signal, no capture.
  if (command === 'microphone_test_start') return { browserCapture: false, deviceLabel: 'Sample microphone' }
  if (command === 'microphone_test_samples') return Array.from({ length: 480 }, (_, i) => 0.3 * Math.sin(i / 7) * Math.abs(Math.sin(performance.now() / 350)))
  if (command === 'microphone_test_stop') return null
  throw new Error('This layout preview does not support native actions. Use the running app for this control.')
})
await loadLanguages()
const topics: TopicCard[] = [
  { id: 'weekend', glyph: '☕', target: 'Your weekend', romanized: null, translation: 'Your weekend' },
  { id: 'food', glyph: '☕', target: 'Food', romanized: null, translation: 'Food' },
  { id: 'travel', glyph: '☕', target: 'Travel', romanized: null, translation: 'Travel' },
]
const initialStart: ConversationStartConfig = {
  difficulty: 'beginner', varietyId: 'spanish-spain',
  direction: { topic: null, timeReference: 'any', usePersonaDetails: true },
}
// Existing ConversationFeedbackCard.test.tsx fixture, reproduced verbatim.
// These are test judgments, not an assessment of a live conversation.
const feedback: ConversationFeedback = { grammar: 3, conversation: 5, answers: {} }
// Exact word and saved fields visible in the user's token-help screenshot.
// Regression fixture only; this does not generate or assess language data.
const arabicText = 'البيوت'
const arabicSegments = [
  { start: 0, end: 2, kind: 'gloss' as const, gloss: 'the', romanization: 'al-', pronunciation: 'il' },
  { start: 2, end: 6, kind: 'gloss' as const, gloss: 'houses', romanization: 'buyūt', pronunciation: 'buyuut' },
]
/** A synthetic, speech-like signal for the recording face; no microphone is opened. */
function sampleWave(): WaveSource {
  const rate = 750
  let last = performance.now(), time = 0
  return { samplesPerSecond: rate, read: () => {
    const count = Math.floor((performance.now() - last) / 1000 * rate)
    if (count <= 0) return []
    last += count / rate * 1000
    return Array.from({ length: count }, () => {
      time += 1 / rate
      const syllables = Math.max(0, Math.sin(time * 2.4)) ** 2 * (0.6 + 0.4 * Math.sin(time * 7.3))
      return syllables * Math.sin(time * 1400) * (0.7 + 0.3 * Math.random())
    })
  } }
}
// A real native spectrogram from the shared fixture, fed in 50 ms slices the way
// the recorder's polling delivers live frames, through the same spectrum feed.
const sample = (spectra as unknown as AudioInspection[])[1].spectrogram
// The composer's AI status line, driven by recorded-turn fixtures instead of a
// workspace: each scene is one moment of a turn, in the order a turn runs.
type AiScene = 'idle' | 'transcribe' | 'schedule' | 'context' | 'request' | 'stream' | 'review' | 'gloss' | 'speech' | 'check' | 'offline' | 'failed'
const AI_SCENES: AiScene[] = ['idle', 'transcribe', 'schedule', 'context', 'request', 'stream', 'review', 'gloss', 'speech', 'check', 'offline', 'failed']
const AI_TURN_PLAY: [AiScene, number][] = [['transcribe', 1600], ['schedule', 500], ['context', 500], ['request', 1400], ['stream', 2200], ['review', 1600], ['gloss', 1800], ['speech', 1600], ['idle', 0]]
const previewAt = (seconds: number) => new Date(Date.UTC(2026, 8, 30, 10, 0, seconds)).toISOString()
function previewTurn(operations: [kind: string, state: string, started?: number][]): RecordedTurn {
  return { id: 'preview-turn', state: 'assisting', paused: false, hold: null, route: 'hosted', replacesTurnId: null, replacedBy: null,
    operations: operations.map(([kind, state]) => ({ id: kind, kind, state, dependencies: [], role: 'standard', contractVersion: 1, sourceMessageId: null })),
    attempts: operations.filter(([, state]) => !['ready', 'waiting_dependencies'].includes(state)).map(([kind, state, started = 0]) => ({
      id: `attempt-${kind}`, operationId: kind, state, requestedModel: kind === 'persona_speech' ? 'openai/gpt-audio-mini' : 'standard-model', actualModel: null, providerId: null,
      startedAt: previewAt(started), finishedAt: state === 'running' ? null : previewAt(started + 1), inputTokens: null, outputTokens: null, error: state === 'failed' ? 'Sample failure' : null, unpublishedText: null })) }
}
const replied: [string, string, number][] = [['persona_context', 'succeeded', 0], ['persona_reply', 'succeeded', 1]]
const AI_SCENE_TURNS: Partial<Record<AiScene, RecordedTurn>> = {
  context: previewTurn([['persona_context', 'running', 0], ['persona_reply', 'waiting_dependencies']]),
  request: previewTurn([['persona_context', 'succeeded', 0], ['persona_reply', 'running', 1]]),
  stream: previewTurn([['persona_context', 'succeeded', 0], ['persona_reply', 'running', 1]]),
  review: previewTurn([...replied, ['coach_feedback', 'running', 2], ['conversation_feedback', 'running', 3]]),
  gloss: previewTurn([...replied, ['reply_translation', 'running', 4], ['persona_word_gloss', 'running', 5]]),
  speech: previewTurn([...replied, ['persona_speech', 'running', 6]]),
  failed: previewTurn([...replied, ['persona_word_gloss', 'failed', 5]]),
}
function useAiScene(scene: AiScene) {
  useEffect(() => {
    useSessionStore.setState({ connection: { route: 'hosted', signedIn: true, email: '', revision: 1, configured: scene !== 'offline', assessmentAdapter: 'jev_choice', standardModel: 'standard', fastModel: 'fast',
      audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false } })
    useConnectionHealth.setState({ routes: scene === 'offline' ? {} : { hosted: { revision: 1, status: scene === 'check' ? 'checking' : 'connected', checkedAt: scene === 'check' ? null : Date.now(), error: null } } })
    useAttemptStreams.setState({ generation: 1, entries: scene !== 'stream' ? {} : { 'attempt-persona_reply': { generation: 1, attemptId: 'attempt-persona_reply', conversationId: 'preview',
      turnId: 'preview-turn', operationId: 'persona_reply', kind: 'persona_reply', seq: 1, text: 'Hola, ¿qué tal?', terminal: null } } })
  }, [scene])
  const turn = AI_SCENE_TURNS[scene]
  return { transcribing: scene === 'transcribe', scheduling: scene === 'schedule', synthesizing: false, turns: turn ? [turn] : [], latest: scene === 'failed' ? turn : undefined }
}
type MessageSide = 'user' | 'assistant'
/** One selected bubble at a time; choosing another moves the selection. */
function useSelectedMessage(): [{ id: number; side: MessageSide }, (id: number, side: MessageSide) => void] {
  const [selected, setSelected] = useState<{ id: number; side: MessageSide }>({ id: 0, side: 'assistant' })
  return [selected, (id, side) => setSelected({ id, side })]
}
function Preview() {
  const [input, setInput] = useState('')
  const [speechTime, setSpeechTime] = useState(0)
  // Message selection as the conversation page keeps it: one bubble at a time, the first reply to begin with.
  const [selected, select] = useSelectedMessage()
  const [opening, setOpening] = useState(false)
  const [startConfig, setStartConfig] = useState(initialStart)
  const [recording, setRecording] = useState(false)
  const [voiceMode, setVoiceMode] = useState<'tap' | 'hold'>('tap')
  const [autoSend, setAutoSend] = useState(true)
  // The recorder's microphone lamp: sound, sustained quiet or stopped samples
  // while recording, or the saved device gone. The level swells like speech.
  const [micScene, setMicScene] = useState<'sound' | 'quiet' | 'stalled' | 'missing'>('sound')
  const [micLevel, setMicLevel] = useState(0)
  useEffect(() => {
    if (!recording) { setMicLevel(0); return }
    const began = performance.now()
    const timer = setInterval(() => setMicLevel(0.35 + 0.45 * Math.abs(Math.sin((performance.now() - began) / 420))), 100)
    return () => clearInterval(timer)
  }, [recording])
  // A recording that never rose above the floor leaves the card over the face;
  // stopping in the quiet scene stands in for the recorder noticing it.
  const [silentTake, setSilentTake] = useState(false)
  const micDevice = micScene === 'missing' ? 'Unplugged USB microphone' : null
  const micHealth = recording ? { signal: micScene === 'missing' ? 'sound' as const : micScene, level: micScene === 'sound' || micScene === 'missing' ? micLevel : micScene === 'quiet' ? 0.03 : 0, detected: true } : null
  const wave = useMemo(() => recording ? sampleWave() : null, [recording])
  const [voiceHeight, setVoiceHeight] = useStoredSize('chat-voice')
  const [replyHelpHeight, setReplyHelpHeight] = useStoredSize('reply-help')
  const breakRef = useRef<HTMLElement>(null)
  const [feed] = useState(createSpectrumFeed)
  const recorder = useRecorderLayout('chat', document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')
  useEffect(() => {
    if (!recording) return
    feed.set(null)
    let end = 0, index = 0
    const timer = setInterval(() => {
      const count = Math.max(1, Math.round(0.05 / sample.frameSeconds))
      const frameStartSeconds: number[] = [], bins: typeof sample.bins = []
      for (let i = 0; i < count; i++) { frameStartSeconds.push(end + i * sample.frameSeconds); bins.push(sample.bins[index++ % sample.bins.length]) }
      end += count * sample.frameSeconds
      feed.set(mergeSpectrum(feed.get(), { endSeconds: end, data: { ...sample, frameStartSeconds, bins } }))
    }, 50)
    return () => clearInterval(timer)
  }, [recording, feed])
  const composer = useRef<HTMLDivElement>(null)
  const [coach, setCoach] = useState(true)
  const [dark, setDark] = useState(false)
  const [palette, setPalette] = useState<'cool' | 'warm'>('cool')
  const [notice, setNotice] = useState('')
  const [aiScene, setAiScene] = useState<AiScene>('idle')
  const ai = useAiScene(aiScene)
  const aiPlay = useRef<number[]>([])
  const playAiTurn = () => {
    aiPlay.current.forEach(clearTimeout)
    let elapsed = 0
    aiPlay.current = AI_TURN_PLAY.map(([scene, duration]) => { const timer = window.setTimeout(() => setAiScene(scene), elapsed); elapsed += duration; return timer })
  }
  useEffect(() => () => aiPlay.current.forEach(clearTimeout), [])
  const aiStatus = <div className="composer-activity"><AiStatus {...ai} onInspectLatest={() => setNotice('AI activity for the latest exchange')} /></div>
  const [tab, setTab] = useState<'coaching' | 'skills'>('coaching')
  const [configOpen, setConfigOpen] = useState(false)
  const [partnerMenu, setPartnerMenu] = useState(false)
  const [quick, setQuick] = useState(PREVIEW_SETTINGS)
  const workspace = useRef<HTMLDivElement>(null)
  const tier = useWidthTier()
  const mobile = tier !== 'full'
  const surface = useNavigationStore(state => state.mobileSurface)
  const overlay = useNavigationStore(state => state.overlay)
  const [surfaceSwitched, setSurfaceSwitched] = useState(false)
  const shownSurface = useRef(surface)
  useEffect(() => {
    if (shownSurface.current === surface) return
    shownSurface.current = surface
    setSurfaceSwitched(true)
  }, [surface])
  const settings = { ...quick, appearance: { ...DEFAULT_APPEARANCE, palette }, theme: dark ? 'dark' as const : 'light' as const }
  useAppearance(settings)
  // Stopping stands in for transcription: Auto-send reports a send, otherwise a sample transcript fills the draft.
  const stopRecording = () => {
    if (!recording) return
    setRecording(false)
    if (micScene === 'quiet') setSilentTake(true)
    if (autoSend) setNotice('Sample recording sent')
    else { setInput('Me gusta caminar.'); setNotice('Sample transcript inserted. Review it before sending.') }
  }
  const readingServices = useMemo<ReadingServices>(() => ({
    read: async () => { throw new Error('Reading requests are unavailable in this layout fixture.') },
    speak: async () => { setNotice('Playback control — sample only; no audio request'); return null },
    activity: async () => ({}),
  }), [])
  // Production phone structure: the composer follows the conversation; the coach
  // is a full-screen modal over both.
  const composerBlock = (
        <div className="composer" ref={composer} data-voice-sized={voiceHeight === null ? undefined : ''}
          style={voiceHeight === null ? undefined : { '--chat-voice-height': `${Math.round(voiceHeight)}px` } as React.CSSProperties}>
          {!mobile && aiStatus}
          {mobile && <div className="composer-assist" data-help-sized={replyHelpHeight === null ? undefined : ''}
            style={replyHelpHeight === null ? undefined : { '--reply-help-height': `${Math.round(replyHelpHeight)}px` } as React.CSSProperties}>
            <ResizeHandle className="reply-help-resize" label="Resize the reply help panel" axis="y" grow={-1} size={replyHelpHeight} min={120} max={Math.round(window.innerHeight * 0.8)}
              onResize={setReplyHelpHeight} measure={() => composer.current?.querySelector('.composer-assist .reply-help')?.getBoundingClientRect().height ?? 0} />
            {!opening &&<MessageReadingScope scope={{language:'mandarin',variety:'mandarin-mainland',explanation:'english',explanationVariety:'english-united-states'}}><ReplyHelp {...replyHelpFixture} busy={false} errors={[]} onUse={setInput} /></MessageReadingScope>}
            <div className="ai-tray-slot" ref={surface === 'panel' ? undefined : aiTraySlot} />{aiStatus}
            <button type="button" className="chat-coach" aria-expanded={surface === 'panel'} onClick={() => useNavigationStore.getState().openConversation('panel')}><ToolbarIcon name="idea" size={15} /><span>Coach</span></button></div>}
          <ResizeHandle className="composer-voice-resize" label="Resize the recording panel" axis="y" grow={-1} size={voiceHeight} min={150} max={640}
            measure={() => composer.current?.querySelector('.composer-voice')?.getBoundingClientRect().height ?? 0} onResize={setVoiceHeight} />
          <ComposerInput input={input} onInput={setInput} available sending={false} recording={recording} transcribing={false} autoSend={autoSend} onAutoSend={setAutoSend} layout={recorder}
            mode={voiceMode} onMode={setVoiceMode} onHoldStart={() => setRecording(true)} onHoldEnd={stopRecording}
            stream={wave && <LiveRecording source={wave} spectrum={feed} time={recorder.time} />}
            prompt={opening ? <>Say <b className="target-word" lang="es">hola</b> to start</> : undefined}
            microphoneSelector={<MicrophoneSelector value={micDevice} onChange={() => setNotice('Microphone choice — sample only')} />}
            microphoneCheck={<MicrophoneCheck device={micDevice} disabled={recording} />} device={micDevice}
            health={micHealth} deviceLabel={recording ? 'Sample microphone' : null}
            silentTake={silentTake} onDismissSilentTake={() => setSilentTake(false)}
            targetLanguageTag="es" targetLanguageName="Español" micShortcut="ctrl+m" onSend={() => {setNotice('Sample message submitted');setInput('')}} onToggleRecording={() => recording ? stopRecording() : setRecording(true)} onDiscardRecording={() => setRecording(false)} />
        </div>
  )
  const coachPanel = (
      <section className={`break ${coach || mobile ? '' : 'collapsed'}`} ref={breakRef}>
        {!coach && !mobile && <button className="break-head" onClick={() => setCoach(true)}><ToolbarIcon name="idea" size={16} /><span>Coach</span></button>}
        <CoachPanelTabs tab={tab} onTab={setTab} onCollapse={mobile ? () => useNavigationStore.getState().openConversation('chat') : () => setCoach(false)} />
        <CoachChatLayout hidden={tab !== 'coaching'} content={!opening && tab === 'coaching' && <>{!mobile && <MessageReadingScope scope={{language:'mandarin',variety:'mandarin-mainland',explanation:'english',explanationVariety:'english-united-states'}}><ReplyHelp {...replyHelpFixture} busy={false} errors={[]} onUse={setInput} /></MessageReadingScope>}<h3 className="coach-group-label">On your message</h3><ConversationFeedbackCard feedback={feedback} /></>} thread={<div className="coach-thread" aria-label="Coach conversation" />} composer={<form className="coach-input-row" onSubmit={event=>event.preventDefault()}><textarea className="coach-input" placeholder="Ask about a message…" aria-label="Message your coach" rows={2}/><button className="coach-send" disabled aria-label="Send to coach">↑</button></form>} />
      </section>
  )
  return <AskCoachContext value={setNotice}><ReadingProvider settings={null}><ReadingHelp services={readingServices} languages={[]}><ReadingPreferencesProvider settings={settings}><div className="app" data-place="chat">
    <div style={{display: 'flex', gap: 12, padding: 6, fontSize: 12, flexWrap: 'wrap'}}><strong>Layout fixture · feedback from existing test data · no microphone or AI</strong><button onClick={() => setOpening(!opening)}>Opening / conversation</button><button onClick={() => setDark(!dark)}>Light / dark</button><label>AI status<select value={aiScene} onChange={event => { aiPlay.current.forEach(clearTimeout); setAiScene(event.target.value as AiScene) }}>{AI_SCENES.map(scene => <option key={scene}>{scene}</option>)}</select></label><button onClick={playAiTurn}>Play a turn</button><label>Mic<select value={micScene} onChange={event => setMicScene(event.target.value as typeof micScene)}>{(['sound', 'quiet', 'stalled', 'missing'] as const).map(scene => <option key={scene}>{scene}</option>)}</select></label><label><input type="checkbox" checked={silentTake} onChange={event => setSilentTake(event.target.checked)} /> Silent take</label><label>Palette<select value={palette} onChange={event => setPalette(event.target.value as typeof palette)}><option>cool</option><option>warm</option></select></label><output>{notice}</output></div>
    <TopBar languagePicker={<select className="learning-picker" aria-label="Target language" onChange={event => setNotice(`Sample target: ${event.target.value}`)}><option>Español</option><option>Français</option><option>العربية</option></select>} />
    <div className={`split ${mobile ? 'mobile-conversation' : ''} ${mobile && surface === 'panel' ? 'mobile-coach' : ''} ${surfaceSwitched ? 'surface-switched' : ''}`} ref={workspace}>
      <section className="chat">
        <ConversationHeader error={null} leading={<button type="button" className="chat-conversations" aria-label="Conversations" title="Conversations" onClick={() => setNotice('Conversations')}><ToolbarIcon name="menu" size={17} /></button>} persona={<PersonaPicker choices={[{id:'uxia',name:'Uxía Castro',symbol:'🌺'}]} currentId="uxia" busy={false} open={partnerMenu} onOpenChange={setPartnerMenu} onSelect={() => {}} onEdit={() => setNotice('Partner profile')} onCreate={() => setNotice('New partner')} />}
          difficulty={<DifficultySelect value={startConfig.difficulty} saving={false} onChange={async difficulty => setStartConfig(current => ({ ...current, difficulty }))} />}>
          <div className="chat-heading-actions"><ConversationSettings summary={quick.auto_speak ? 'Reading aloud' : undefined} open={configOpen} onOpenChange={setConfigOpen} settings={quick} saving={false} showRomanization
            onToggle={async (key, value) => setQuick(current => ({ ...current, [key]: value ?? !current[key] }))}
            nativePicker={<label><span>Explanation language</span><select className="chat-language-picker"><option>English</option></select></label>}
            exportDisabled={false} onExport={() => setNotice('Conversation YAML')} /><button type="button" className="chat-new" aria-label="New conversation" title="New conversation" onClick={() => setOpening(true)}><ToolbarIcon name="plus" size={17} /></button></div>
        </ConversationHeader>
        <div className="stream">{opening ? <ConversationStart partnerName="Uxía Castro" partnerSymbol="🌺" busy={false} conversationId="preview-conversation" topics={topics} targetTag="es" targetDir="ltr" recording={recording} transcribing={false} canPartnerStart={!input.trim() && !recording} onAboutPartner={() => setNotice('Partner profile')} onChangePartner={() => setPartnerMenu(true)} value={startConfig} onChange={setStartConfig} onStart={async () => setOpening(false)} /> : <>
          {/* Existing TurnView.test.tsx reply fixture, without generated feedback. */}
          <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}><TurnView editing={false} turn={{ id: 0, user: null, pendingText: '', assistant: { reply: 'Hola', tokens: [{ text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }], user_tokens: [], translation: 'Persona translation', user_translation: null, mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [] } }} reviewing={false} onAskCoach={setNotice} focused={false} selectedSide={selected.id === 0 ? selected.side : undefined} onSelectMessage={select} ttsReady speaking={false} rtl={false} onBubbleTap={() => setNotice('Message analysis')} partnerSpeech={{ retained: { sessionId: 'preview', audio: { status: 'ready', messageId: 'reply', operationId: 'speech', attemptId: 'sample', mime: 'audio/wav', audioBase64: '', alignment: null } }, time: speechTime, playing: false, enabled: true, rate: 1, volume: 1, seek: setSpeechTime, stop: () => {}, toggle: () => setNotice('Playback control — sample only; no audio request') }} onSpeak={() => setNotice('Playback control — sample only; no audio request')} /></MessageReadingScope>
          <div style={{ '--script-scale': 1.5 } as React.CSSProperties}><ReadingPreferencesContext value={{ autoTranslate: quick.auto_translate, alwaysRomanize: quick.always_romanize, alwaysPronunciation: quick.always_pronunciation, supportsRomanization: true }}>
            <TurnView editing={false} turn={{ id: 2, user: arabicText, assistant: null, pendingText: '', userSavedGloss: {
              sourceMessageId: 'preview-arabic-user', targetLanguageId: 'arabic', explanationLanguageId: 'english',
              formatVersion: 'preview', templateVersion: 'preview', boundaryPolicy: 'preview', operationId: 'preview-arabic-gloss', attemptId: 'preview-arabic-attempt', coverage: 'complete', segments: arabicSegments,
            } }} reviewing={false} onAskCoach={setNotice} focused={false} selectedSide={selected.id === 2 ? selected.side : undefined} onSelectMessage={select} ttsReady={false} speaking={false} rtl onBubbleTap={() => setNotice('Message analysis')} />
          </ReadingPreferencesContext></div>
          <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}><TurnView editing={false} turn={{id:1,user:'Ayer go.',assistant:null,pendingText:'',fixes:2,conversationFeedback:feedback, coachDecision:{ exposedMove:'explicit',shown:{construct:'past',quote:'Ayer go.',move:'explicit',text:'Ayer fui al mercado.',explanation:'Use fui for a completed trip yesterday.'},retryInvited:false,alsoNoticed:[],keptGoing:false }}} reviewing={false} onEditUser={turn => { setInput(turn.user ?? ''); setNotice('Sample edit loaded into composer; no message sent') }} onAskCoach={setNotice} onAddContext={async note => { setNotice(note); setCoach(true); if(mobile) useNavigationStore.getState().openConversation('panel') }} focused={false} selectedSide={selected.id === 1 ? selected.side : undefined} onSelectMessage={select} ttsReady speaking={false} rtl={false} onBubbleTap={() => setNotice('Message analysis')} onSpeak={() => setNotice('Playback control — sample only')} /></MessageReadingScope>
        </>}</div>
        {!mobile && composerBlock}
      </section>
      {mobile && <div className="chat mobile-composer">{composerBlock}</div>}
      {coach && !mobile && <PracticeDivider workspace={workspace} />}
      {mobile && surface === 'panel' && <div className="coach-scrim" aria-hidden="true" onClick={() => useNavigationStore.getState().openConversation('chat')} />}
      {coachPanel}
    </div>
    {/* The production AI View, opened by the AI pill as the app shell opens it. */}
    <AiViewPanel open={overlay === 'activity'} onOpenChange={open => open ? useNavigationStore.getState().showOverlay('activity') : useNavigationStore.getState().closeOverlay()} />
  </div></ReadingPreferencesProvider></ReadingHelp></ReadingProvider></AskCoachContext>
}
createRoot(document.getElementById('root')!).render(<Preview />)
