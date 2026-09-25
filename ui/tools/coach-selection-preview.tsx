/** Configuration-only preview: production controls, no native calls or saved data. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../src/components/localization/i18n'
import { CoachChoices } from '../src/features/conversation/session/CoachChoices'
import type { RecommendationMode } from '../src/generated/contracts'
import '../src/styles/index.css'
function Preview() {
  const [mode, setMode] = useState<RecommendationMode | null>(null)
  return <I18nProvider locale="english"><main className="conversation-start">
    <header className="invitation-header">
      <h2>Coach selection · preview</h2>
    </header>
    <CoachChoices selected={mode} disabled={false} onChoose={setMode} />
    <details className="practice-skill prompt-creator">
      <summary>Selected direction</summary>
      <pre aria-live="polite">{JSON.stringify({topic:mode?{kind:'coach',mode}:null},null,2)}</pre>
    </details>
  </main></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
