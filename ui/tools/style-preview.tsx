/** Real component/CSS review fixture. Local sample state; no native calls or saving. */
import { YamlExport } from '../src/components/persistence/YamlExport'
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { PREVIEW_SETTINGS } from './preview-settings'
import type { Settings } from '../src/types'
import { AppearanceSettings } from '../src/features/settings/appearance/AppearanceSettings'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { ReadingPreferencesProvider } from '../src/components/reading/ReadingPreferences'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import '../src/styles/index.css'

function Preview() {
  const [settings, setSettings] = useState(PREVIEW_SETTINGS)
  const [yamlOpen, setYamlOpen] = useState(false)
  useAppearance(settings)
  useEffect(() => { document.documentElement.style.setProperty("--reading-scale", String(settings.text_size / 100)) }, [settings.text_size])
  return <ReadingPreferencesProvider settings={settings}><main className="modal">
    <h1>Application style review</h1>
    <p><a href="/tools/detail-style-preview.html">Language and reward detail explorer →</a></p>
    <p>Real components and styles. Sample state only; preferences are not saved.</p>
    <label>Theme<select value={settings.theme ?? 'light'} onChange={e => setSettings({...settings, theme:e.target.value as Settings['theme']})}><option>light</option><option>dark</option><option>system</option></select></label>
    <label>Reading size<input type="range" min="75" max="160" value={settings.text_size} onChange={e=>setSettings({...settings,text_size:Number(e.target.value)})}/></label>
    <AppearanceSettings settings={settings} onChange={setSettings}/>
    <hr/>
    <label>Settings search fixture<input className="settings-search" aria-label="Settings search fixture" placeholder="Search settings"/></label>
    <section className="skills-page" style={{height:'auto'}}><div className="tree-toolbar"><button className="tree-refresh">Refresh skills fixture</button><label className="tree-jump">Jump to skill<select aria-label="Jump to skill fixture"><option>Descriptions</option></select></label></div></section>

    <section className="study-coaching">
      <div className="coach-entry"><section className="coach-card coach-card-help"><p className="coach-remark">Coaching suggestion fixture</p></section><section className="coach-card coach-card-explanation"><p className="coach-remark">Language explanation fixture</p></section></div>
      <div className="coach-input-row"><textarea className="coach-input" aria-label="Ask the coach" placeholder="Ask the coach"/><button className="coach-send" aria-label="Send to coach">↑</button></div>
    </section>
    <section className="learner-model"><h2>Evidence table fixture</h2><button className="inspection-action" onClick={()=>setYamlOpen(true)}>Review sample YAML</button><div className="learner-model-table"><table><thead><tr><th>Skill</th><th>Independent</th><th>Assisted</th><th>Estimate</th></tr></thead><tbody><tr><th><button className="inspection-action">Descriptions</button></th><td>12</td><td>4</td><td>0.75 ± 0.12</td></tr></tbody></table></div></section>
    {yamlOpen && <YamlExport scope="sample" title="Sample YAML" onClose={()=>setYamlOpen(false)} view={async()=> 'language: es\nrecords:\n  - skill: descriptions\n    observations: 12'} save={async()=> { throw new Error('Sample fixture does not save files.') }} />}

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
