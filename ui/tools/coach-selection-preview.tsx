/** Configuration-only preview: production controls, no native calls or saved data. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../src/components/localization/i18n'
import { StartOptions } from '../src/features/conversation/session/StartChoices'
import type { ConversationStartConfig } from '../src/generated/contracts'
import '../src/styles/index.css'
function Preview() {
  const [configuration, setConfiguration] = useState<ConversationStartConfig>({ difficulty: 'beginner', varietyId: 'spanish-spain', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } })
  return <I18nProvider locale="english"><main className="conversation-start">
    <header className="invitation-header">
      <h2>Coach selection · preview</h2>
    </header>
    {/* The skill focus is one of the start card's options; this shows them unfolded. */}
    <StartOptions value={configuration} disabled={false} skillFocus onChange={setConfiguration} />
    <details className="practice-skill prompt-creator">
      <summary>Selected direction</summary>
      <pre aria-live="polite">{JSON.stringify(configuration.direction, null, 2)}</pre>
    </details>
  </main></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
