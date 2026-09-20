/** Production language details; disposable sample data, no native calls. */
import { createRoot } from 'react-dom/client'
import { LanguageDetails } from '../src/features/languages/LanguageDetails'
import { I18nProvider } from '../src/components/localization/i18n'
import { useSettingsStore } from '../src/state/settings/settings'
import { PREVIEW_SETTINGS } from './preview-settings'
import type { LanguageInspection } from '../src/generated/contracts'
import '../src/styles/index.css'

useSettingsStore.setState({ settings: PREVIEW_SETTINGS, saveScriptScale: async (language, scale) => {
  const settings = useSettingsStore.getState().settings!
  const script_scales = {...settings.script_scales}
  if (scale === null) delete script_scales[language]
  else script_scales[language] = scale
  useSettingsStore.setState({settings:{...settings,script_scales}})
} })
const report = {
  language:{id:'arabic',fontScale:1.5,languageTag:'ar',direction:'rtl'},
  review:'needs_review',family:'Sample data',
  values:Object.entries({script:'arabic',direction:'rtl',font_scale:'1.5',word_spacing:'true',romanization:'arabic:ala-lc-arabic'}).map(([field,value])=>({field,value,source:'Sample data'})),
  schemes:[{id:'arabic:ala-lc-arabic',label:'ALA-LC Arabic',selected:true,examples:[['كتاب','kitāb'],['صورة','ṣūrah'],['على','‘alá'],['مسألة','mas’alah'],['إيمان','īmān'],['الشمس','al-shams'],['وزارة التربية','Wizārat al-Tarbiyah'],['فجأةً','faj’atan'],['قاضٍ','qāḍin'],['أدهم','Adʹham']],instructions:'Sample romanization instructions.',sources:[],review:'needs_review'}],
  rules:[],partner:{name:'نور'},sources:[],resolvedJson:'{}',schemaJson:'{}',learningJson:'{}',conversationJson:'{}',fingerprint:'preview',
} as unknown as LanguageInspection
createRoot(document.getElementById('root')!).render(<I18nProvider locale="english"><main className="language-browser-detail" style={{padding:16,maxWidth:1100,margin:'auto',height:'100vh',overflow:'auto'}}><LanguageDetails report={report} /></main></I18nProvider>)
