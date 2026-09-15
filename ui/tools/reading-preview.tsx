/** Manual visual fixture. Sample text only; no IPC, generation or saved app data. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import '../src/styles/index.css'

function Preview() {
  const [automatic, setAutomatic] = useState(false)
  return <main className="practice-statistics">
    <h1>Reading component fixture · sample text</h1>
    <p>Uses the application’s SavedGlossText component. No AI or workspace data.</p>
    <div><button onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }}>Toggle theme</button><label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />Always show saved fields</label></div>
    <ReadingPreferencesContext value={{autoTranslate: automatic, alwaysRomanize: automatic, alwaysPronunciation: automatic}}>
      <div className="msg bot"><div className="line"><SavedGlossText text="¿Hay una farmacia por aquí?" segments={[{start:9,end:17,kind:'gloss',gloss:'pharmacy',pronunciation:'far-MA-sya'}]} /></div></div>
      <div className="msg bot"><div className="line"><SavedGlossText text="والكتاب" segments={[{start:0,end:1,kind:'gloss',gloss:'and',romanization:'wa'},{start:1,end:3,kind:'gloss',gloss:'the',romanization:'al'},{start:3,end:7,kind:'gloss',gloss:'book',romanization:'kitāb'}]} /></div></div>
      <div className="msg bot"><div className="line"><SavedGlossText text="你好" segments={[{start:0,end:1,kind:'gloss',gloss:'you',romanization:'nǐ'},{start:1,end:2,kind:'gloss',gloss:'good',romanization:'hǎo'}]} /></div></div>
    </ReadingPreferencesContext>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
