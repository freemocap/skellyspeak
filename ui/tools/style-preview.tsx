/** Real component/CSS review fixture. Local sample state; no native calls or saving. */
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import type { Settings } from '../src/types'
import { AppearanceSettings } from '../src/features/settings/appearance/AppearanceSettings'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { ReadingPreferencesProvider } from '../src/components/reading/ReadingPreferences'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import '../src/styles/index.css'
const SETTINGS: Settings = {
  provider_mode: 'hosted',
  hosted_token: '',
  hosted_email: 'me@example.com',
  install_id: '',
  openrouter_key: '',
  custom_base_url: '',
  custom_api_key: '',
  custom_model: '',
  groq_key: '',
  openrouter_model: 'google/gemini-2.5-flash',
  observer_model: null,
  target_language: 'es',
  target_variety: '',
  native_language: 'en', native_variety: 'en-US', interface_locale: 'en',
  microphone_device_id: null,
  auto_speak: false,
  auto_send: false,
  always_romanize: false,
  auto_translate: false,
  always_pronunciation: false,
  text_size: 100,
  text_spacing: 2,
  fast_mode: true, reward_sounds: 'follow_tts',
  master_volume: 100, voice_volume: 100, effects_volume: 100,
  tts_rate: 1,
  shortcuts: { mic: 'ctrl+m', speak: 'ctrl+l', panel: 'ctrl+b', settings: 'ctrl+,' },
}
function Preview() {
  const [settings, setSettings] = useState(SETTINGS)
  useAppearance(settings)
  useEffect(() => { document.documentElement.style.setProperty("--reading-scale", String(settings.text_size / 100)) }, [settings.text_size])
  return <ReadingPreferencesProvider settings={settings}><main className="modal">
    <h1>Application style review</h1>
    <p>Real components and styles. Sample state only; preferences are not saved.</p>
    <label>Theme<select value={settings.theme ?? 'light'} onChange={e => setSettings({...settings, theme:e.target.value as Settings['theme']})}><option>light</option><option>dark</option><option>system</option></select></label>
    <label>Reading size<input type="range" min="75" max="160" value={settings.text_size} onChange={e=>setSettings({...settings,text_size:Number(e.target.value)})}/></label>
    <AppearanceSettings settings={settings} onChange={setSettings}/>
    <hr/>
    <div className="panel-tabs"><button className="panel-tab active">Conversation</button><button className="panel-tab">Coach</button></div>
    <p><button className="btn primary">Primary action</button> <button className="btn" disabled>Disabled</button></p>
    <div className="form-row"><label>Example field<input placeholder="Enter text"/></label></div>
    <div className="chat">
      <header className="chat-head"><div className="conversation-title">Conversation fixture</div></header>
      <div className="learning-line"><select className="learning-picker" aria-label="Difficulty"><option>Beginner</option></select><select className="chat-language-picker" aria-label="Language"><option>Spanish</option></select><button className="persona-picker-toggle">Partner</button></div>
      <div className="stream"><div className="msg chat-message me plain with-edit">Learner message</div>
      <div className="msg chat-message bot"><SavedGlossText text="¿Hay una farmacia por aquí?" segments={[{start:9,end:17,kind:'gloss',gloss:'pharmacy',pronunciation:'far-MA-sya'}]}/></div>
      <div className="msg chat-message bot rtl"><SavedGlossText text="والكتاب" segments={[{start:0,end:1,kind:'gloss',gloss:'and',romanization:'wa'},{start:1,end:3,kind:'gloss',gloss:'the',romanization:'al'},{start:3,end:7,kind:'gloss',gloss:'book',romanization:'kitāb'}]}/></div>
    </div>
      <div className="composer"><div className="crow"><input className="field composer-input" aria-label="Message" placeholder="Write a message"/><button className="mic">Record</button><button className="send" aria-label="Send">↑</button></div></div>
    </div>
    <div className="reaction-excerpt"><div className="msg bot">Partner excerpt outside the chat</div></div>
    <p><button className="btn" onClick={()=>document.querySelector('dialog')!.showModal()}>Open dialog</button></p>
    <dialog className="detail-dialog"><h2>Dialog example</h2><p>Shared dialog surface and backdrop.</p><button className="detail-close" onClick={()=>document.querySelector('dialog')!.close()}>Close dialog</button></dialog>
  </main></ReadingPreferencesProvider>
}
createRoot(document.getElementById('root')!).render(<Preview/>)
