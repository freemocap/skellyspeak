import { AskCoachContext } from '../src/components/learning/AskCoachButton'
import { CoachChatLayout } from '../src/features/conversation/coaching/CoachChatLayout'
import { CoachPanelTabs } from '../src/features/conversation/coaching/CoachPanelTabs'
/** Layout review using production components and sample data. No native or AI calls. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { TopBar } from '../src/app/shell/TopBar'
import { ToolbarIcon } from '../src/components/controls/ToolbarIcon'
import { ConversationHeader } from '../src/features/conversation/session/ConversationHeader'
import { ConversationSettings } from '../src/features/conversation/session/ConversationSettings'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { PersonaPicker } from '../src/features/conversation/partners/PersonaPicker'
import { ConversationStart } from '../src/features/conversation/session/ConversationStart'
import { ComposerInput } from '../src/features/conversation/composer/ComposerInput'
import { MicrophoneSelector } from '../src/components/media/MicrophoneSelector'
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
import { PREVIEW_SETTINGS } from './preview-settings'
import { DEFAULT_APPEARANCE } from '../src/generated/contracts'
import type { ConversationFeedback, ConversationStartConfig, TopicCard } from '../src/generated/contracts'
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
mockIPC((command) => {
  if (command === 'inspect_message_speech') return spectra[0]
  if (command === 'create_drill_item') return { id: 'preview-drill-copy' }
  if (command === 'get_snapshot') return { languages: previewLanguages, savedTopics: [{ id: 'preview-saved', text: 'Mi barrio' }] } as unknown
  if (command === 'list_microphones') return { source: 'native', devices: [{ id: 'sample-microphone', label: 'Sample microphone', isDefault: true, channels: 1, sampleRate: 48000, unavailable: null }] }
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
function Preview() {
  const [input, setInput] = useState('')
  const [speechTime, setSpeechTime] = useState(0)
  const [opening, setOpening] = useState(false)
  const [startConfig, setStartConfig] = useState(initialStart)
  const [recording, setRecording] = useState(false)
  const [voiceMode, setVoiceMode] = useState<'tap' | 'hold'>('tap')
  const [autoSend, setAutoSend] = useState(true)
  const wave = useMemo(() => recording ? sampleWave() : null, [recording])
  const [voiceHeight, setVoiceHeight] = useStoredSize('chat-voice')
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
  const [tab, setTab] = useState<'coaching' | 'evidence'>('coaching')
  const [configOpen, setConfigOpen] = useState(false)
  const [partnerMenu, setPartnerMenu] = useState(false)
  const [quick, setQuick] = useState(PREVIEW_SETTINGS)
  const workspace = useRef<HTMLDivElement>(null)
  const tier = useWidthTier()
  const mobile = tier !== 'full'
  const surface = useNavigationStore(state => state.mobileSurface)
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
    if (autoSend) setNotice('Sample recording sent')
    else { setInput('Me gusta caminar.'); setNotice('Sample transcript inserted. Review it before sending.') }
  }
  const readingServices = useMemo<ReadingServices>(() => ({
    read: async () => { throw new Error('Reading requests are unavailable in this layout fixture.') },
    speak: async () => { setNotice('Playback control — sample only; no audio request'); return null },
    activity: async () => ({}),
  }), [])
  return <AskCoachContext value={setNotice}><ReadingProvider settings={null}><ReadingHelp services={readingServices} languages={[]}><ReadingPreferencesProvider settings={settings}><div className="app" data-place="chat">
    <div style={{display: 'flex', gap: 12, padding: 6, fontSize: 12, flexWrap: 'wrap'}}><strong>Layout fixture · feedback from existing test data · no microphone or AI</strong><button onClick={() => setOpening(!opening)}>Opening / conversation</button><button onClick={() => setDark(!dark)}>Light / dark</button><label>Palette<select value={palette} onChange={event => setPalette(event.target.value as typeof palette)}><option>cool</option><option>warm</option></select></label><output>{notice}</output></div>
    <TopBar languagePicker={<select className="learning-picker" aria-label="Target language" onChange={event => setNotice(`Sample target: ${event.target.value}`)}><option>Español</option><option>Français</option><option>العربية</option></select>} />
    <div className={`split ${mobile ? 'mobile-conversation' : ''} ${mobile && surface === 'panel' ? 'mobile-coach' : ''} ${surfaceSwitched ? 'surface-switched' : ''}`} ref={workspace}>
      <section className="chat">
        <ConversationHeader error={null} leading={<button type="button" className="chat-conversations" aria-label="Conversations" title="Conversations" onClick={() => setNotice('Conversations')}><ToolbarIcon name="menu" size={17} /></button>} persona={<PersonaPicker choices={[{id:'uxia',name:'Uxía Castro',symbol:'🌺'}]} currentId="uxia" busy={false} open={partnerMenu} onOpenChange={setPartnerMenu} onSelect={() => {}} onEdit={() => setNotice('Partner profile')} onCreate={() => setNotice('New partner')} />}>
          <div className="chat-heading-actions"><ConversationSettings summary={['Beginner', quick.auto_speak ? 'Reading aloud' : null].filter(Boolean).join(' · ')} open={configOpen} onOpenChange={setConfigOpen} settings={quick} saving={false} showRomanization
            onToggle={async (key, value) => setQuick(current => ({ ...current, [key]: value ?? !current[key] }))}
            nativePicker={<label><span>Explanation language</span><select className="chat-language-picker"><option>English</option></select></label>}
            difficulty={<select className="chat-language-picker"><option>Beginner</option></select>} exportDisabled={false} onExport={() => setNotice('Conversation YAML')} /><button type="button" className="chat-new" aria-label="New conversation" title="New conversation" onClick={() => setOpening(true)}><ToolbarIcon name="plus" size={17} /></button></div>
        </ConversationHeader>
        <div className="stream">{opening ? <ConversationStart partnerName="Uxía Castro" partnerSymbol="🌺" busy={false} conversationId="preview-conversation" topics={topics} targetTag="es" targetDir="ltr" recording={recording} transcribing={false} canPartnerStart={!input.trim() && !recording} onAboutPartner={() => setNotice('Partner profile')} onChangePartner={() => setPartnerMenu(true)} value={startConfig} onChange={setStartConfig} onStart={async () => setOpening(false)} /> : <>
          {/* Existing TurnView.test.tsx reply fixture, without generated feedback. */}
          <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}><TurnView editing={false} turn={{ id: 0, user: null, pendingText: '', assistant: { reply: 'Hola', tokens: [{ text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }], user_tokens: [], translation: 'Persona translation', user_translation: null, mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [] } }} reviewing={false} onAskCoach={setNotice} focused={false} ttsReady speaking={false} rtl={false} onBubbleTap={() => setNotice('Message analysis')} partnerSpeech={{ retained: { sessionId: 'preview', audio: { status: 'ready', messageId: 'reply', operationId: 'speech', attemptId: 'sample', mime: 'audio/wav', audioBase64: '', alignment: null } }, time: speechTime, playing: false, enabled: true, rate: 1, volume: 1, seek: setSpeechTime, stop: () => {}, toggle: () => setNotice('Playback control — sample only; no audio request') }} onSpeak={() => setNotice('Playback control — sample only; no audio request')} /></MessageReadingScope>
          <div style={{ '--script-scale': 1.5 } as React.CSSProperties}><ReadingPreferencesContext value={{ autoTranslate: quick.auto_translate, alwaysRomanize: quick.always_romanize, alwaysPronunciation: quick.always_pronunciation, supportsRomanization: true }}>
            <TurnView editing={false} turn={{ id: 2, user: arabicText, assistant: null, pendingText: '', userSavedGloss: {
              sourceMessageId: 'preview-arabic-user', targetLanguageId: 'arabic', explanationLanguageId: 'english',
              formatVersion: 'preview', templateVersion: 'preview', boundaryPolicy: 'preview', operationId: 'preview-arabic-gloss', attemptId: 'preview-arabic-attempt', coverage: 'complete', segments: arabicSegments,
            } }} reviewing={false} onAskCoach={setNotice} focused={false} ttsReady={false} speaking={false} rtl onBubbleTap={() => setNotice('Message analysis')} />
          </ReadingPreferencesContext></div>
          <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}><TurnView editing={false} turn={{id:1,user:'Ayer go.',assistant:null,pendingText:'',conversationFeedback:feedback, coachDecision:{ exposedMove:'explicit',repairStatus:null,shown:{construct:'past',quote:'Ayer go.',move:'explicit',text:'Ayer fui al mercado.',explanation:'Use fui for a completed trip yesterday.'},retryInvited:false,fixed:null,alsoNoticed:[],keptGoing:false }}} reviewing={false} onEditUser={turn => { setInput(turn.user ?? ''); setNotice('Sample edit loaded into composer; no message sent') }} onAskCoach={setNotice} onAddContext={async note => { setNotice(note); setCoach(true); if(mobile) useNavigationStore.getState().openPractice('panel') }} focused={false} ttsReady speaking={false} rtl={false} onBubbleTap={() => setNotice('Message analysis')} onSpeak={() => setNotice('Playback control — sample only')} /></MessageReadingScope>
        </>}</div>
        <div className="composer" ref={composer} data-voice-sized={voiceHeight === null ? undefined : ''}
          style={voiceHeight === null ? undefined : { '--chat-voice-height': `${Math.round(voiceHeight)}px` } as React.CSSProperties}>
          <ResizeHandle label="Resize the recording panel" axis="y" grow={-1} size={voiceHeight} min={150} max={640}
            measure={() => composer.current?.querySelector('.composer-voice')?.getBoundingClientRect().height ?? 0} onResize={setVoiceHeight} />
          {mobile && <div className="composer-assist">{!opening && <MessageReadingScope scope={{language:'mandarin',variety:'mandarin-mainland',explanation:'english',explanationVariety:'english-united-states'}}><ReplyHelp {...replyHelpFixture} busy={false} errors={[]} onUse={setInput} /></MessageReadingScope>}
            <div className="composer-activity" aria-live="polite" />
            {tier === 'narrow' && <button type="button" className="chat-coach" aria-expanded={surface === 'panel'} onClick={() => useNavigationStore.getState().openPractice('panel')}><ToolbarIcon name="idea" size={15} /><span>Coach</span></button>}</div>}
          <ComposerInput input={input} onInput={setInput} available sending={false} recording={recording} transcribing={false} autoSend={autoSend} onAutoSend={setAutoSend} layout={recorder}
            mode={voiceMode} onMode={setVoiceMode} onHoldStart={() => setRecording(true)} onHoldEnd={stopRecording}
            stream={wave && <LiveRecording source={wave} spectrum={feed} time={recorder.time} />}
            prompt={opening ? <>Say <b className="target-word" lang="es">hola</b> to start</> : undefined}
            microphoneSelector={<MicrophoneSelector value={null} onChange={() => setNotice('Microphone choice — sample only')} />}
            targetLanguageTag="es" targetLanguageName="Español" micShortcut="ctrl+m" onSend={() => {setNotice('Sample message submitted');setInput('')}} onToggleRecording={() => recording ? stopRecording() : setRecording(true)} onDiscardRecording={() => setRecording(false)} />
        </div>
        {tier === 'compact' && <button type="button" className="chat-coach-edge" aria-expanded={surface === 'panel'} onClick={() => useNavigationStore.getState().openPractice('panel')}><ToolbarIcon name="idea" size={16} /><span>Coach</span></button>}
      </section>
      {coach && !mobile && <PracticeDivider workspace={workspace} />}
      {mobile && surface === 'panel' && <div className="coach-scrim" aria-hidden="true" onClick={() => useNavigationStore.getState().openPractice('chat')} />}
      <section className={`break ${coach || mobile ? '' : 'collapsed'}`}>
        {!coach && !mobile && <button className="break-head" onClick={() => setCoach(true)}><ToolbarIcon name="idea" size={16} /><span>Coach</span></button>}
        <CoachPanelTabs tab={tab} onTab={setTab} onCollapse={mobile ? () => useNavigationStore.getState().openPractice('chat') : () => setCoach(false)} />
        <CoachChatLayout hidden={tab !== 'coaching'} content={!opening && tab === 'coaching' && <>{!mobile && <MessageReadingScope scope={{language:'mandarin',variety:'mandarin-mainland',explanation:'english',explanationVariety:'english-united-states'}}><ReplyHelp {...replyHelpFixture} busy={false} errors={[]} onUse={setInput} /></MessageReadingScope>}<h3 className="coach-group-label">On your message</h3><ConversationFeedbackCard feedback={feedback} /></>} thread={<div className="coach-thread" aria-label="Coach conversation" />} composer={<form className="coach-input-row" onSubmit={event=>event.preventDefault()}><textarea className="coach-input" placeholder="Ask about a message…" aria-label="Message your coach" rows={2}/><button className="coach-send" disabled aria-label="Send to coach">↑</button></form>} />
      </section>
    </div>
  </div></ReadingPreferencesProvider></ReadingHelp></ReadingProvider></AskCoachContext>
}
createRoot(document.getElementById('root')!).render(<Preview />)
