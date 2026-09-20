/** Inspection presentation fixture: no workspace reads, writes or AI requests. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { AiSplit } from '../src/features/activity/AiSplit'
import { InspectionContent, InspectionModeControl, type InspectionMode } from '../src/features/activity/InspectionContent'
import '../src/styles/index.css'
const prompt = 'Conversation support v4. Explain zero to two useful grammar or usage patterns in actualPartnerReply. Each card must quote actual partner wording verbatim and give a short title, explanation, target-language example and a useful contrast. Do not assess the learner here. Writing guidance for quoted target text only: {"assessment":["Use Spanish","Keep evidence character-for-character"],"reading":["Use Spanish"]}. The learner native language is English. All explanations must use English.'
function Preview() {
  const [mode, setMode] = useState<InspectionMode>('readable')
  return <div className="ai-view" style={{ height: '100dvh' }}><AiSplit inspector={<aside className="ai-inspector">
    <InspectionModeControl mode={mode} onChange={setMode} />
    <h3>Request</h3><div className="ai-message"><InspectionContent mode={mode} text={prompt} /></div>
    <h3>Response</h3><div className="ai-response"><InspectionContent mode={mode} text={JSON.stringify({ cards: [{ title: 'A simple observation', explanation: '**Veo** means “I see”.\n\n- It describes what the speaker sees.\n- The subject is understood from the verb.', example: 'Veo un delfín.' }], enabled: false, extra: null })} /></div>
  </aside>}><div className="ai-main"><p>Graph space — drag the divider or use its arrow keys.</p></div></AiSplit></div>
}
createRoot(document.getElementById('root')!).render(<Preview />)
