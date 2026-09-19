/** Production controls with in-memory sample state. No native writes or AI calls. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { LanguageBrowser } from '../src/features/languages/LanguageBrowser'
import { LearningPicker } from '../src/features/settings/language/LanguagePickers'
import { I18nProvider } from '../src/components/localization/i18n'
import { useSettingsStore } from '../src/state/settings/settings'
import { useNavigationStore } from '../src/state/navigation/navigation'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { PREVIEW_SETTINGS } from './preview-settings'
import type { LanguageInspection } from '../src/generated/contracts'
import '../src/styles/index.css'

const examples = [
  ['spanish','Spanish','Español','es','spanish-mexico','Mexico'],
  ['french','French','Français','fr','french-france','France'],
  ['arabic','Arabic','العربية','ar','arabic-levantine','Levantine Arabic'],
  ['hindi','Hindi','हिन्दी','hi','hindi-india','India'],
  ['malayalam','Malayalam','മലയാളം','ml','malayalam-kerala','Kerala'],
  ['mandarin','Mandarin','普通话','zh','mandarin-mainland','Mainland China'],
  ['english','English','English','en','english-united-states','United States'],
]
const catalog = examples.map(([id,name,nativeName,languageTag,variety,label]) => ({
  id,name,nativeName,languageTag,defaultVariety:variety,direction:id === 'arabic' ? 'rtl' : 'ltr',
  fontScale:1,romanization:null,transcriptionLanguage:languageTag,
  varieties:[{id:variety,name:label,direction:id === 'arabic' ? 'rtl' : 'ltr',fontScale:1,romanization:null,transcriptionLanguage:languageTag}],
}))
mockIPC((command, args) => {
  if (command === 'get_snapshot') return {languages:catalog}
  if (command === 'inspect_language') {
    const language = catalog.find(item => item.id === (args as {language:string}).language)!
    return {language,varietyId:language.defaultVariety,review:'needs_review',family:'Sample data',values:[],rules:[],schemes:[],partner:{name:'Sample partner'},sources:[],schemaJson:'{}',resolvedJson:'{}',learningJson:'{}',conversationJson:'{}',fingerprint:'preview'} as unknown as LanguageInspection
  }
  throw new Error(`Unexpected preview command: ${command}`)
})
await loadLanguages()
useSettingsStore.setState({
  settings:{...PREVIEW_SETTINGS,target_variety:'spanish-mexico',my_languages:['spanish'],target_varieties:{}},
  saveMyLanguage:async (language,variety) => {
    const current=useSettingsStore.getState().settings!
    useSettingsStore.setState({settings:{...current,my_languages:variety === null ? current.my_languages.filter(item => item !== language) : [...new Set([...current.my_languages,language])],target_varieties:variety === null ? current.target_varieties : {...current.target_varieties,[language]:variety}}})
  },
  selectLanguageVariety:async (language,variety) => {
    const current=useSettingsStore.getState().settings!
    useSettingsStore.setState({settings:{...current,target_language:language,target_variety:variety}})
  },
  setLanguage:async (_field,language) => {
    const current=useSettingsStore.getState().settings!
    useSettingsStore.setState({settings:{...current,target_language:language,target_variety:current.target_varieties[language] ?? catalog.find(item => item.id === language)!.defaultVariety}})
  },
})
function Preview() {
  const [locale,setLocale]=useState('english')
  const [dark,setDark]=useState(false)
  const settings=useSettingsStore(state => state.settings)!
  const overlay=useNavigationStore(state => state.overlay)
  useAppearance({...settings,theme:dark ? 'dark' : 'light'})
  return <I18nProvider locale={locale}><main className="language-browser">
    <h2>Language picker review · Sample data</h2>
    <div className="language-browser-actions"><button className="btn" onClick={() => setDark(!dark)}>Light / dark</button><button className="btn" onClick={() => {setLocale(locale === 'english' ? 'arabic' : 'english');document.documentElement.dir=locale === 'english' ? 'rtl' : 'ltr'}}>English / العربية</button></div>
    <LearningPicker />
    {overlay === 'languages' && <LanguageBrowser onClose={() => useNavigationStore.getState().closeOverlay()} />}
  </main></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
