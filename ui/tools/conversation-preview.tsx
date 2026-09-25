import { CoachChatLayout } from '../src/features/conversation/coaching/CoachChatLayout'
import { CoachPanelTabs } from '../src/features/conversation/coaching/CoachPanelTabs'
/** Layout review using production components and sample data. No native or AI calls. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { TopBar } from '../src/app/shell/TopBar'
import { MobileNav } from '../src/app/shell/MobileNav'
import { ConversationHeader } from '../src/features/conversation/session/ConversationHeader'
import { ConversationSettings } from '../src/features/conversation/session/ConversationSettings'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { PersonaPicker } from '../src/features/conversation/partners/PersonaPicker'
import { ConversationStart } from '../src/features/conversation/session/ConversationStart'
import { ComposerInput } from '../src/features/conversation/composer/ComposerInput'
import { MessageReadingScope } from '../src/features/conversation/reading/MessageReadingScope'
import { replyHelpFixture } from '../src/features/conversation/composer/ReplyHelp.fixtures'
import { ReplyHelp } from '../src/features/conversation/composer/ReplyHelp'
import { TurnView } from '../src/features/conversation/messages/TurnView'
import { PracticeDivider } from '../src/features/conversation/messages/PracticeDivider'
import { ConversationFeedbackCard } from '../src/features/conversation/coaching/ConversationFeedbackCard'
import { ReadingProvider } from '../src/components/reading/TargetText'
import { ReadingPreferencesProvider } from '../src/components/reading/ReadingPreferences'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { useIsMobile } from '../src/components/layout/useIsMobile'
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
  if (command === 'create_drill_item') return { id: 'preview-drill-copy' }
  if (command === 'get_snapshot') return { languages: previewLanguages } as unknown
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
function Preview() {
  const [input, setInput] = useState('')
  const [opening, setOpening] = useState(false)
  const [startConfig, setStartConfig] = useState(initialStart)
  const [recording, setRecording] = useState(false)
  const [coach, setCoach] = useState(true)
  const [dark, setDark] = useState(false)
  const [palette, setPalette] = useState<'warm' | 'cool'>('warm')
  const [spacing, setSpacing] = useState<'roomy' | 'balanced' | 'tight' | 'extra_tight'>('tight')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'coaching' | 'evidence'>('coaching')
  const [configOpen, setConfigOpen] = useState(false)
  const [quick, setQuick] = useState(PREVIEW_SETTINGS)
  const workspace = useRef<HTMLDivElement>(null)
  const mobile = useIsMobile()
  const surface = useNavigationStore(state => state.mobileSurface)
  const [surfaceSwitched, setSurfaceSwitched] = useState(false)
  const shownSurface = useRef(surface)
  useEffect(() => {
    if (shownSurface.current === surface) return
    shownSurface.current = surface
    setSurfaceSwitched(true)
  }, [surface])
  const settings = { ...quick, appearance: { ...DEFAULT_APPEARANCE, palette, layoutSpacing: spacing }, theme: dark ? 'dark' as const : 'light' as const }
  useAppearance(settings)
  return <ReadingProvider settings={null}><ReadingPreferencesProvider settings={settings}><div className="app">
    <div style={{display: 'flex', gap: 12, padding: 6, fontSize: 12, flexWrap: 'wrap'}}><strong>Layout fixture · feedback from existing test data · no microphone or AI</strong><button onClick={() => setOpening(!opening)}>Opening / conversation</button><button onClick={() => setDark(!dark)}>Light / dark</button><label>Palette<select value={palette} onChange={event => setPalette(event.target.value as typeof palette)}><option>warm</option><option>cool</option></select></label><label>Spacing<select value={spacing} onChange={event => setSpacing(event.target.value as typeof spacing)}><option>roomy</option><option>balanced</option><option>tight</option><option>extra_tight</option></select></label><output>{notice}</output></div>
    <TopBar languagePicker={<select className="learning-picker" aria-label="Target language" onChange={event => setNotice(`Sample target: ${event.target.value}`)}><option>Español</option><option>Français</option><option>العربية</option></select>} />
    <div className={`split ${mobile ? 'mobile-conversation' : ''} ${mobile && surface === 'panel' ? 'mobile-coach' : ''} ${surfaceSwitched ? 'surface-switched' : ''}`} ref={workspace}>
      <section className="chat">
        <ConversationHeader error={null} persona={<PersonaPicker choices={[{id:'uxia',name:'Uxía Castro',symbol:'🌺'}]} currentId="uxia" busy={false} onSelect={() => {}} onEdit={() => setNotice('Partner profile')} onCreate={() => setNotice('New partner')} />}>
          <div className="chat-heading-actions"><ConversationSettings summary={['Beginner', quick.auto_speak ? 'Reading aloud' : null].filter(Boolean).join(' · ')} open={configOpen} onOpenChange={setConfigOpen} settings={quick} saving={false} showRomanization
            onToggle={async (key, value) => setQuick(current => ({ ...current, [key]: value ?? !current[key] }))}
            nativePicker={<label><span>Explanation language</span><select className="chat-language-picker"><option>English</option></select></label>}
            difficulty={<select className="chat-language-picker"><option>Beginner</option></select>} exportDisabled={false} onExport={() => setNotice('Conversation YAML')} /><button className="chat-new" onClick={() => setOpening(true)}>＋ <span>New</span></button></div>
        </ConversationHeader>
        <div className="stream">{opening ? <ConversationStart partnerName="Uxía Castro" partnerSymbol="🌺" busy={false} conversationId="preview-conversation" topics={topics} greeting={{ text: 'hola', romanized: null }} targetTag="es" targetDir="ltr" recording={recording} transcribing={false} canPartnerStart={!input.trim() && !recording} onRecord={() => setRecording(!recording)} value={startConfig} onChange={setStartConfig} onStart={async () => setOpening(false)} /> : <>
          {/* Existing TurnView.test.tsx reply fixture, without generated feedback. */}
          <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}><TurnView turn={{ id: 0, user: null, pendingText: '', assistant: { reply: 'Hola', tokens: [{ text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }], user_tokens: [], translation: 'Persona translation', user_translation: null, mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [] } }} reviewing={false} onAskCoach={setNotice} focused={false} ttsReady speaking={false} rtl={false} onBubbleTap={() => setNotice('Message analysis')} onSpeak={() => setNotice('Playback control — sample only; no audio request')} /></MessageReadingScope>
          <div style={{ '--script-scale': 1.5 } as React.CSSProperties}><ReadingPreferencesContext value={{ autoTranslate: quick.auto_translate, alwaysRomanize: quick.always_romanize, alwaysPronunciation: quick.always_pronunciation, supportsRomanization: true }}>
            <TurnView turn={{ id: 2, user: arabicText, assistant: null, pendingText: '', userSavedGloss: {
              sourceMessageId: 'preview-arabic-user', targetLanguageId: 'arabic', explanationLanguageId: 'english',
              formatVersion: 'preview', templateVersion: 'preview', boundaryPolicy: 'preview', operationId: 'preview-arabic-gloss', attemptId: 'preview-arabic-attempt', coverage: 'complete', segments: arabicSegments,
            } }} reviewing={false} onAskCoach={setNotice} focused={false} ttsReady={false} speaking={false} rtl onBubbleTap={() => setNotice('Message analysis')} />
          </ReadingPreferencesContext></div>
          <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}><TurnView turn={{id:1,user:'Ayer go.',assistant:null,pendingText:'',conversationFeedback:feedback}} reviewing={false} onEditUser={turn => { setInput(turn.user ?? ''); setNotice('Sample edit loaded into composer; no message sent') }} onAskCoach={setNotice} onAddContext={async note => { setNotice(note); setCoach(true); if(mobile) useNavigationStore.getState().openPractice('panel') }} focused={false} ttsReady speaking={false} rtl={false} onBubbleTap={() => setNotice('Message analysis')} onSpeak={() => setNotice('Playback control — sample only')} /></MessageReadingScope>
        </>}</div>
        <div className="composer">
          {mobile && !opening && <MessageReadingScope scope={{language:'mandarin',variety:'mandarin-mainland',explanation:'english',explanationVariety:'english-united-states'}}><ReplyHelp {...replyHelpFixture} busy={false} errors={[]} onUse={setInput} /></MessageReadingScope>}
          <ComposerInput input={input} onInput={setInput} available sending={false} recording={recording} transcribing={false} autoSend targetLanguageTag="es" targetLanguageName="Español" micShortcut="ctrl+m" onSend={() => {setNotice('Sample message submitted');setInput('')}} onToggleRecording={() => setRecording(!recording)} onDiscardRecording={() => setRecording(false)} />
        </div>
      </section>
      {coach && !mobile && <PracticeDivider workspace={workspace} />}
      <section className={`break ${coach || mobile ? '' : 'collapsed'}`}>
        {!coach && !mobile && <button className="break-head" onClick={() => setCoach(true)}>Coach</button>}
        <CoachPanelTabs tab={tab} onTab={setTab} onCollapse={() => setCoach(false)} />
        <CoachChatLayout hidden={tab !== 'coaching'} content={!opening && tab === 'coaching' && <>{!mobile && <MessageReadingScope scope={{language:'mandarin',variety:'mandarin-mainland',explanation:'english',explanationVariety:'english-united-states'}}><ReplyHelp {...replyHelpFixture} busy={false} errors={[]} onUse={setInput} /></MessageReadingScope>}<h3 className="coach-group-label">On your message</h3><ConversationFeedbackCard feedback={feedback} /></>} thread={<div className="coach-thread" aria-label="Coach conversation" />} composer={<form className="coach-input-row" onSubmit={event=>event.preventDefault()}><textarea className="coach-input" placeholder="Ask about a message…" aria-label="Message your coach" rows={2}/><button className="coach-send" disabled aria-label="Send to coach">↑</button></form>} />
      </section>
    </div><MobileNav />
  </div></ReadingPreferencesProvider></ReadingProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
