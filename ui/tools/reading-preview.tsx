import { ReadingAnalysisFixture } from './reading-analysis-fixture'
import { ReadingPassage } from '../src/features/conversation/reading/ReadingPassage'
import { SavedReadingProvider } from '../src/components/reading/SavedReadingProvider'
/** Offline fixture: production reading controls, deterministic glosses, no AI/audio. */
import { createRoot } from 'react-dom/client'
import { mockIPC } from '@tauri-apps/api/mocks'
import { loadLanguages, languages } from '../src/platform/ipc/tauri'
import { ReadingProvider, TargetText } from '../src/components/reading/TargetText'
import { ReadingHelp } from '../src/components/reading/ReadingHelp'
import { ReadingLanguageScope } from '../src/components/reading/ReadingLanguageScope'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import { ComposerHelp } from '../src/features/conversation/composer/ComposerHelp'
import { ConversationFeedbackCard } from '../src/features/conversation/coaching/ConversationFeedbackCard'
import { CoachEntry } from '../src/features/conversation/coaching/CoachEntry'
import { I18nProvider } from '../src/components/localization/i18n'
import { PREVIEW_SETTINGS } from './preview-settings'
import type { ReadingServices } from '../src/components/reading/ReadingContext'
import type { ReadingResult } from '../src/generated/contracts'
import '../src/styles/index.css'
const registry = [
  {id:'mandarin',name:'Mandarin',nativeName:'中文',languageTag:'zh-CN',direction:'ltr',romanization:'pinyin',defaultVariety:'mandarin-mainland',fontScale:1,varieties:[{id:'mandarin-mainland',name:'Mainland',direction:'ltr',fontScale:1,romanization:'pinyin'}]},
  {id:'spanish',name:'Spanish',nativeName:'Español',languageTag:'es',direction:'ltr',romanization:null,defaultVariety:'spanish-spain',fontScale:1,varieties:[{id:'spanish-spain',name:'Spain',direction:'ltr',fontScale:1,romanization:null}]},
  {id:'arabic',name:'Arabic',nativeName:'العربية',languageTag:'ar',direction:'rtl',romanization:'ala',defaultVariety:'arabic-levantine',fontScale:1.5,varieties:[{id:'arabic-levantine',name:'Levantine',direction:'rtl',fontScale:1.5,romanization:'ala'}]},
  {id:'english',name:'English',nativeName:'English',languageTag:'en',direction:'ltr',romanization:null,defaultVariety:'english-united-states',fontScale:1,varieties:[{id:'english-united-states',name:'United States',direction:'ltr',fontScale:1,romanization:null}]},
]
mockIPC(command=> { if(command==='get_snapshot') return {languages:registry}; throw new Error('No native requests in this fixture.') })
await loadLanguages()
const segments = [{start:0,end:4,kind:'gloss' as const,gloss:'hello',pronunciation:'oh-la'},{start:6,end:11,kind:'gloss' as const,gloss:'world'}]
const services: ReadingServices = {
  read: async input => ({gloss:{segments: input.text==='Hola, mundo.'?segments:[...input.text.matchAll(/[\p{L}\p{M}]+/gu)].map(match => ({start:match.index,end:match.index+match[0].length,kind:'gloss',gloss:match[0].includes('قديم')?'old':match[0].includes('بيوت')?'houses':'fixture meaning',romanization:match[0].includes('قديم')?'qadīme':undefined})),coverage:'complete'},audioBase64:null,receipt:{fixture:true}} as ReadingResult),
  speak: async () => { throw new Error('Offline preview: no speech request was sent.') },
  activity: async () => [{fixture:true}],
}
createRoot(document.getElementById('root')!).render(<I18nProvider locale="english"><ReadingProvider settings={{...PREVIEW_SETTINGS,target_language:'spanish',target_variety:'spanish-spain',native_language:'english',native_variety:'english-united-states'}}><ReadingHelp services={services} languages={languages()}>
  <SavedReadingProvider sources={[
    {scope:{language:'spanish',variety:'spanish-spain',explanation:'english',explanationVariety:'english-united-states'},text:'La playa.',segments:[{start:3,end:8,kind:'gloss',gloss:'beach',pronunciation:'pla-ya'}]},
    {scope:{language:'arabic',variety:'arabic-levantine',explanation:'english',explanationVariety:'english-united-states'},text:'القديمة',segments:[{start:0,end:7,kind:'gloss',gloss:'old',romanization:'qadīme'}]},
  ]}><main style={{padding:24,maxWidth:1100,margin:'auto',height:'100vh',overflow:'auto'}}>
    <h1>Reading controls — offline fixture</h1><p>Click a word, then its help or speaker control. Select text in the editor or source block. Speech reports a fixture error; no provider is called.</p>
    <ReadingLanguageScope language="arabic" variety="arabic-levantine"><section style={{'--script-scale':1.5} as React.CSSProperties}>
      <p className="msg chat-message bot"><SavedGlossText text="مَسْكَنُك، هَل تُحِبُّ المَسالِكَ الجَدِيدَة؟" segments={[{start:11,end:14,kind:'gloss',gloss:'question'},{start:15,end:22,kind:'gloss',gloss:'like',romanization:'tuḥibbu'}]} /></p>
      <ReadingAnalysisFixture />
      <ReadingPassage text="بَدّي أزور مَسْكَنَك بَكّير." romanization="Baddī azūr maskanak bakīr." translation="I want to visit your place early." />
      <ReadingLanguageScope language="mandarin" variety="mandarin-mainland"><ReadingPassage text="你喜欢科幻小说吗？" romanization="Nǐ xǐhuān kēhuàn xiǎoshuō ma?" translation="Do you like science fiction?" /></ReadingLanguageScope>
      <p className="msg chat-message bot"><SavedGlossText text="أَنَا بِحِبّ أَمْشِي نَفْس التَلّة كُلّ جُمْعَة. أَنْتَ بِتْمَشّى كُلّ يَوْم؟" segments={[{start:0,end:5,kind:'gloss',gloss:'I'},{start:6,end:12,kind:'gloss',gloss:'like'},{start:13,end:20,kind:'gloss',gloss:'walk'}]} /></p>
      <p className="msg chat-message bot"><span className="w" dir="auto">أَنَا بِحِبّ أَمْشِي نَفْس التَلّة كُلّ جُمْعَة. أَنْتَ بِتْمَشّى كُلّ يَوْم؟</span></p>
      <h2>Arabic regression: final-word hover, click and selection</h2>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        <div><p className="msg chat-message bot"><SavedGlossText text="هٰذا بَيْتٌ قَدِيمٌ في عَمّان. كَيْف حالُك؟" segments={[{start:0,end:4,kind:'gloss',gloss:'this'},{start:5,end:11,kind:'gloss',gloss:'house'},{start:12,end:19,kind:'gloss',gloss:'old',romanization:'qadīm',pronunciation:'qa-deem'}]} /></p>
          <ComposerHelp assistance={{explanation:'Reply ideas',replies:[{text:'أَنا بِحِبّ الْبُيُوت الْقَدِيمَة كَمان.',translation:'I like old houses too.',romanization:'',pronunciation:''},{text:'أَنا بَفَضّل الْبُيُوت الْجَدِيدَة.',translation:'I prefer new houses.',romanization:'',pronunciation:''}],frames:[],starters:[]}} replies={[]} pending={false} busy={false} errors={[]} onUse={()=>{}} />
        </div>
        <ConversationFeedbackCard feedback={{remark:'Use the correct verb form when asking a male if he likes something.',usedTarget:['بتحب البيوت القديمة'],usedNative:[],corrections:[{kind:'grammar',said:'بتحب البيوت القديمة',corrected:'بتحب البيوت القديمة',explanation:'To ask “Do you like…?” use this form.'}],grammar:3,conversation:3}} />
      </div>
    </section></ReadingLanguageScope>
    <h2>Same saved word in another surface</h2><p><TargetText text="Otra playa." /></p>
    <h2>Saved message and suggestions</h2><p><SavedGlossText text="Hola, mundo." segments={segments} /></p>
    <ComposerHelp replies={[{text:'Hola, mundo.',segments}]} pending={false} busy={false} errors={[]} onUse={()=>{}} />
    <h2>Unannotated coaching correction</h2><CoachEntry source="Hola, mundo." decision={{exposedMove:'explicit',shown:{move:'explicit',construct:'greeting',quote:'Hola mundo',text:'Hola, mundo.'},repairStatus:null,retryInvited:false,fixed:null,alsoNoticed:[],keptGoing:false}} />
    <h2>Arabic word with parts</h2><ReadingLanguageScope language="arabic" variety="arabic-levantine"><p><SavedGlossText text="الكتاب" segments={[{start:0,end:2,kind:'gloss',gloss:'the',romanization:'al-'},{start:2,end:6,kind:'gloss',gloss:'book',romanization:'kitāb'}]} /></p></ReadingLanguageScope>
    <h2>New text</h2><p><TargetText text="Hola, mundo." /></p>
    <h2>Editor and raw configuration</h2><textarea className="field" aria-label="Draft" defaultValue="Hola, mundo." /><pre>{'greeting: Hola, mundo.\nname: Lucía'}</pre>
  </main></SavedReadingProvider>
</ReadingHelp></ReadingProvider></I18nProvider>)
