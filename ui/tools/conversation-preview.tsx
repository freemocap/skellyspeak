/** Layout review using production components and sample data. No native or AI calls. */
import { createRoot } from 'react-dom/client'
import { useRef, useState } from 'react'
import { TopBar } from '../src/app/shell/TopBar'
import { MobileNav } from '../src/app/shell/MobileNav'
import { ConversationHeader } from '../src/features/conversation/session/ConversationHeader'
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
import type { CoachDecision } from '../src/generated/contracts'
import type { GuidedTurnResult } from '../src/types'
import '../src/styles/index.css'

const decision: CoachDecision = { exposedMove: 'hint', repairStatus: null, shown: { construct: 'past', quote: 'he ido a la playa', move: 'hint', text: 'Which past tense fits an event from last summer?' }, retryInvited: true, fixed: null, alsoNoticed: [], keptGoing: false }
const assistant = { reply: '¡Qué bien! ¿Fuiste con tu familia o con amigos?', translation: 'How nice! Did you go with your family or friends?', tokens: [], user_tokens: [], errors: [], mechanics: [], scaffolds: { replies: [] } } as unknown as GuidedTurnResult
function Preview() {
  const [input, setInput] = useState('')
  const [opening, setOpening] = useState(false)
  const [recording, setRecording] = useState(false)
  const [coach, setCoach] = useState(true)
  const [dark, setDark] = useState(false)
  const [palette, setPalette] = useState<'warm' | 'cool'>('warm')
  const [spacing, setSpacing] = useState<'roomy' | 'balanced' | 'tight' | 'extra_tight'>('roomy')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('Coaching')
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
        <ConversationHeader error={null} persona={<PersonaPicker status={recording ? 'Español · Beginner · Listening' : 'Español · Beginner · Reading aloud'} choices={[{id:'uxia',name:'Uxía Castro',symbol:'🌺'}]} currentId="uxia" busy={false} onSelect={() => {}} onEdit={() => setNotice('Partner profile')} onCreate={() => setNotice('New partner')} />}>
          <div className="chat-heading-actions"><button className="chat-config-toggle" onClick={() => setNotice('Conversation settings')}>⚙ <span>Conversation</span></button><button className="chat-new" onClick={() => setOpening(true)}>＋ <span>New</span></button></div>
        </ConversationHeader>
        <div className="stream">{opening ? <ConversationStart partnerName="Uxía Castro" partnerSymbol="🌺" busy={false} starters={[{id:'weekend',label:'Your weekend',reason:'Recent activities',preview:null,translation:null},{id:'food',label:'Food',reason:'Ordering at a café',preview:null,translation:null},{id:'travel',label:'Travel',reason:'Places to visit',preview:null,translation:null}]} onStart={async () => setOpening(false)} /> : <>
          <div className="turn-stack"><div className="msg chat-message bot"><span className="target-text">Me gusta mucho caminar por la costa cuando el tiempo está agradable.</span></div></div>
          <TurnView turn={{id:1,user:'Sí, he ido a la playa de Samil el verano pasado.',assistant, pendingText:'',coachDecision:decision}} reviewing={false} onAskCoach={setNotice} onOpenCoach={() => { setCoach(true); if(mobile) useNavigationStore.getState().openPractice('panel') }} focused={false} ttsReady speaking={false} revealed={new Set()} showRomanization={false} alwaysRomanize={false} alwaysPronunciation={false} autoTranslate={false} rtl={false} onReveal={() => {}} onBubbleTap={() => setNotice('Message analysis')} onSpeak={() => setNotice('Playback control — sample only')} onPopup={() => {}} onInspect={() => {}} onToggleReveal={() => {}} />
        </>}</div>
        <div className="composer">
          {!opening && <ComposerHelp replies={[{text:'Con mi familia.',segments:[]},{text:'Con unos amigos.',segments:[]}]} busy={false} pending={false} errors={[]} onUse={setInput} />}
          <ComposerInput input={input} onInput={setInput} available sending={false} recording={recording} transcribing={false} autoSend targetLanguage="es" targetLanguageName="Español" micShortcut="ctrl+m" onSend={() => {setNotice('Sample message submitted');setInput('')}} onToggleRecording={() => setRecording(!recording)} onDiscardRecording={() => setRecording(false)} />
        </div>
      </section>
      {coach && !mobile && <PracticeDivider workspace={workspace} />}
      <section className={`break ${coach || mobile ? '' : 'collapsed'}`}>
        {!coach && !mobile && <button className="break-head" onClick={() => setCoach(true)}>Coach</button>}
        <div className="coach-heading"><strong>Coach</strong><button onClick={() => setNotice('Lesson entry')}>Take a lesson</button><button aria-label="Close coach" onClick={() => setCoach(false)}>›</button></div>
        <div className="panel-tabs">{['Coaching','Evidence'].map(label => <button key={label} className={`panel-tab ${tab === label ? 'active' : ''}`} onClick={() => setTab(label)}>{label}</button>)}</div>
        <div className="study-coaching"><div className="study-coaching-scroll">{!opening && tab === 'Coaching' && <><h3 className="coach-group-label">On your message</h3><CoachEntry decision={decision} source={null} /><h3 className="coach-group-label">You asked</h3><div className="coach-thread"><div className="coach-msg user">When do I use “haya” instead of “ha”?</div><div className="coach-msg coach">“Haya” is a subjunctive form. It can follow expressions of uncertainty.</div></div></>}</div><form className="coach-input-row" onSubmit={event=>event.preventDefault()}><textarea className="coach-input" placeholder="Ask about a message…" aria-label="Message your coach" rows={2}/><button className="coach-send" disabled aria-label="Send to coach">↑</button></form></div>
      </section>
    </div><MobileNav />
  </div></ReadingPreferencesProvider></ReadingProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
