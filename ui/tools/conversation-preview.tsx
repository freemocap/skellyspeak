/** Layout review using production components and sample data. No native or AI calls. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { createRoot } from 'react-dom/client'
import { useRef, useState } from 'react'
import { TopBar } from '../src/app/shell/TopBar'
import { MobileNav } from '../src/app/shell/MobileNav'
import { ConversationHeader } from '../src/features/conversation/session/ConversationHeader'
import { ConversationSettings } from '../src/features/conversation/session/ConversationSettings'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { PersonaPicker } from '../src/features/conversation/partners/PersonaPicker'
import { ConversationStart } from '../src/features/conversation/session/ConversationStart'
import { ComposerInput } from '../src/features/conversation/composer/ComposerInput'
import { ComposerHelp } from '../src/features/conversation/composer/ComposerHelp'
import { TurnView } from '../src/features/conversation/messages/TurnView'
import { PracticeDivider } from '../src/features/conversation/messages/PracticeDivider'
import { CoachEntry } from '../src/features/conversation/coaching/CoachEntry'
import { ReadingProvider } from '../src/components/reading/TargetText'
import { ReadingPreferencesProvider } from '../src/components/reading/ReadingPreferences'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { useIsMobile } from '../src/components/layout/useIsMobile'
import { useNavigationStore } from '../src/state/navigation/navigation'
import { PREVIEW_SETTINGS } from './preview-settings'
import { DEFAULT_APPEARANCE } from '../src/generated/contracts'
import type { CoachDecision, ConversationStartConfig, TopicCard } from '../src/generated/contracts'
import type { GuidedTurnResult } from '../src/types'
import '../src/styles/index.css'

// Production controls may expose native-only actions (for example Customize).
// Keep those explicit and isolated instead of reaching a workspace from a fixture.
// The language registry is read through IPC before the first render, so the
// preview answers that one read with sample languages and refuses every other
// native action. Without it the whole surface throws and renders blank.
const previewLanguages = [
  { transcriptionLanguage: 'es', languageTag: 'es', fontScale: 1, id: 'spanish', name: 'Spanish', nativeName: 'Español', direction: 'ltr', romanization: null, defaultVariety: 'spanish-spain',
    varieties: [{ transcriptionLanguage: 'es', id: 'spanish-spain', name: 'Spain', description: 'Spain', direction: 'ltr', fontScale: 1, romanization: null }] },
  { transcriptionLanguage: 'en', languageTag: 'en', fontScale: 1, id: 'english', name: 'English', nativeName: 'English', direction: 'ltr', romanization: null, defaultVariety: 'english-united-states',
    varieties: [{ transcriptionLanguage: 'en', id: 'english-united-states', name: 'United States', description: 'United States', direction: 'ltr', fontScale: 1, romanization: null }] },
]
mockIPC((command) => {
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
const decision: CoachDecision = { exposedMove: 'hint', repairStatus: null, shown: { construct: 'past', quote: 'he ido a la playa', move: 'hint', text: 'Which past tense fits an event from last summer?' }, retryInvited: true, fixed: null, alsoNoticed: [], keptGoing: false }
// "What's your favorite dish?" with clitic-split glosses, as saved word help arrives.
const arabicText = 'شو الأكلة المفضلة عندك؟'
const arabicSegments = [
  { start: 0, end: 2, kind: 'gloss' as const, gloss: 'what', romanization: 'shū' },
  { start: 3, end: 5, kind: 'gloss' as const, gloss: 'the', romanization: 'al-' },
  { start: 5, end: 9, kind: 'gloss' as const, gloss: 'dish', romanization: 'aklah' },
  { start: 10, end: 12, kind: 'gloss' as const, gloss: 'the', romanization: 'al-' },
  { start: 12, end: 17, kind: 'gloss' as const, gloss: 'favorite', romanization: 'mufaḍḍalah' },
  { start: 18, end: 21, kind: 'gloss' as const, gloss: 'with', romanization: 'ʿind' },
  { start: 21, end: 22, kind: 'gloss' as const, gloss: 'you', romanization: 'ak' },
]
const assistant = { reply: '¡Qué bien! ¿Fuiste con tu familia o con amigos?', translation: 'How nice! Did you go with your family or friends?', tokens: [], user_tokens: [], errors: [], mechanics: [], scaffolds: { replies: [] } } as unknown as GuidedTurnResult
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
  const [tab, setTab] = useState('Coaching')
  const [configOpen, setConfigOpen] = useState(false)
  const [quick, setQuick] = useState(PREVIEW_SETTINGS)
  const workspace = useRef<HTMLDivElement>(null)
  const mobile = useIsMobile()
  const surface = useNavigationStore(state => state.mobileSurface)
  const settings = { ...PREVIEW_SETTINGS, appearance: { ...DEFAULT_APPEARANCE, palette, layoutSpacing: spacing }, theme: dark ? 'dark' as const : 'light' as const }
  useAppearance(settings)
  return <ReadingProvider settings={null}><ReadingPreferencesProvider settings={settings}><div className="app">
    <div style={{display: 'flex', gap: 12, padding: 6, fontSize: 12, flexWrap: 'wrap'}}><strong>Layout fixture · sample data · no microphone or AI</strong><button onClick={() => setOpening(!opening)}>Opening / conversation</button><button onClick={() => setDark(!dark)}>Light / dark</button><label>Palette<select value={palette} onChange={event => setPalette(event.target.value as typeof palette)}><option>warm</option><option>cool</option></select></label><label>Spacing<select value={spacing} onChange={event => setSpacing(event.target.value as typeof spacing)}><option>roomy</option><option>balanced</option><option>tight</option><option>extra_tight</option></select></label><output>{notice}</output></div>
    <TopBar languagePicker={<select className="learning-picker" aria-label="Target language" onChange={event => setNotice(`Sample target: ${event.target.value}`)}><option>Español</option><option>Français</option><option>العربية</option></select>} />
    <div className={`split ${mobile ? 'mobile-conversation' : ''} ${mobile && surface === 'panel' ? 'mobile-lesson' : ''}`} ref={workspace}>
      <section className="chat">
        <ConversationHeader error={null} persona={<PersonaPicker choices={[{id:'uxia',name:'Uxía Castro',symbol:'🌺'}]} currentId="uxia" busy={false} onSelect={() => {}} onEdit={() => setNotice('Partner profile')} onCreate={() => setNotice('New partner')} />}>
          <div className="chat-heading-actions"><ConversationSettings summary={['Beginner', quick.auto_speak ? 'Reading aloud' : null].filter(Boolean).join(' · ')} open={configOpen} onOpenChange={setConfigOpen} settings={quick} saving={false} showRomanization
            onToggle={async (key, value) => setQuick(current => ({ ...current, [key]: value ?? !current[key] }))}
            nativePicker={<label><span>Explanation language</span><select className="chat-language-picker"><option>English</option></select></label>}
            difficulty={<select className="chat-language-picker"><option>Beginner</option></select>} exportDisabled={false} onExport={() => setNotice('Conversation YAML')} /><button className="chat-new" onClick={() => setOpening(true)}>＋ <span>New</span></button></div>
        </ConversationHeader>
        <div className="stream">{opening ? <ConversationStart partnerName="Uxía Castro" partnerSymbol="🌺" busy={false} conversationId="preview-conversation" topics={topics} greeting={{ text: 'hola', romanized: null }} targetTag="es" targetDir="ltr" recording={recording} transcribing={false} canPartnerStart={!input.trim() && !recording} onRecord={() => setRecording(!recording)} value={startConfig} onChange={setStartConfig} onStart={async () => setOpening(false)} /> : <>
          <div className="turn-stack"><div className="msg chat-message bot"><span className="target-text">Me gusta mucho caminar por la costa cuando el tiempo está agradable.</span></div></div>
          <div className="turn-stack" style={{ '--script-scale': 1.5 } as React.CSSProperties}><div className="msg chat-message bot rtl"><ReadingPreferencesContext value={{ autoTranslate: false, alwaysRomanize: quick.always_romanize, alwaysPronunciation: false }}><SavedGlossText text={arabicText} segments={arabicSegments} /></ReadingPreferencesContext></div></div>
          <TurnView turn={{id:1,user:'Sí, he ido a la playa de Samil el verano pasado.',assistant, pendingText:'',coachDecision:decision}} reviewing={false} onAskCoach={setNotice} onOpenCoach={() => { setCoach(true); if(mobile) useNavigationStore.getState().openPractice('panel') }} focused={false} ttsReady speaking={false} revealed={new Set()} showRomanization={false} alwaysRomanize={false} alwaysPronunciation={false} autoTranslate={false} rtl={false} onReveal={() => {}} onBubbleTap={() => setNotice('Message analysis')} onSpeak={() => setNotice('Playback control — sample only')} onPopup={() => {}} onInspect={() => {}} onToggleReveal={() => {}} />
        </>}</div>
        <div className="composer">
          {!opening && <ComposerHelp replies={[{text:'Con mi familia.',segments:[]},{text:'Con unos amigos.',segments:[]}]} busy={false} pending={false} errors={[]} onUse={setInput} />}
          <ComposerInput input={input} onInput={setInput} available sending={false} recording={recording} transcribing={false} autoSend targetLanguageTag="es" targetLanguageName="Español" micShortcut="ctrl+m" onSend={() => {setNotice('Sample message submitted');setInput('')}} onToggleRecording={() => setRecording(!recording)} onDiscardRecording={() => setRecording(false)} />
        </div>
      </section>
      {coach && !mobile && <PracticeDivider workspace={workspace} />}
      <section className={`break ${coach || mobile ? '' : 'collapsed'}`}>
        {!coach && !mobile && <button className="break-head" onClick={() => setCoach(true)}>Coach</button>}
        <div className="coach-heading"><strong>Coach</strong><button aria-label="Close coach" onClick={() => setCoach(false)}>›</button></div>
        <div className="panel-tabs">{['Coaching','Evidence'].map(label => <button key={label} className={`panel-tab ${tab === label ? 'active' : ''}`} onClick={() => setTab(label)}>{label}</button>)}</div>
        <div className="study-coaching"><div className="study-coaching-scroll">{!opening && tab === 'Coaching' && <><h3 className="coach-group-label">On your message</h3><CoachEntry decision={decision} source={null} /><h3 className="coach-group-label">You asked</h3><div className="coach-thread"><div className="coach-msg user">When do I use “haya” instead of “ha”?</div><div className="coach-msg coach">“Haya” is a subjunctive form. It can follow expressions of uncertainty.</div></div></>}</div><form className="coach-input-row" onSubmit={event=>event.preventDefault()}><textarea className="coach-input" placeholder="Ask about a message…" aria-label="Message your coach" rows={2}/><button className="coach-send" disabled aria-label="Send to coach">↑</button></form></div>
      </section>
    </div><MobileNav />
  </div></ReadingPreferencesProvider></ReadingProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
