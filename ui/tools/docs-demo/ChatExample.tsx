import { useState } from 'react'
import { ComposerInput } from '../../src/features/conversation/composer/ComposerInput'
import { CoachPanelTabs } from '../../src/features/conversation/coaching/CoachPanelTabs'
import { ConversationFeedbackCard } from '../../src/features/conversation/coaching/ConversationFeedbackCard'
import { ToolbarIcon } from '../../src/components/controls/ToolbarIcon'
import type { ConversationFeedback } from '../../src/generated/contracts'

const feedback: ConversationFeedback = { grammar: 3, conversation: 5, answers: {} }

export function ChatExample() {
  const [input, setInput] = useState('Ayer fui al mercado.')
  const [sent, setSent] = useState(false)
  const [recording, setRecording] = useState(false)
  const [autoSend, setAutoSend] = useState(false)
  const [mode, setMode] = useState<'tap' | 'hold'>('tap')
  const [tab, setTab] = useState<'coaching' | 'progress'>('coaching')
  const [translation, setTranslation] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('Edit the draft and press Send, or try the microphone controls with a simulated recording.')
  function send() {
    setSent(true); setInput('')
    setNotice('The example used a fixed reply. In the app, Send starts an AI turn; partner replies and coaching can arrive separately.')
  }
  function finish() {
    setRecording(false)
    if (autoSend) send()
    else { setInput('Ayer fui al mercado.'); setNotice('This fixed transcript is ready to edit. With Auto-send off, you review the draft before sending.') }
  }
  return <>
    <h1>Send a message</h1><p className="docs-demo-explanation" role="status">{notice}</p>
    <div className="docs-demo-chat-grid">
      <div>
        <div className="docs-demo-message"><strong>Sample partner</strong><p lang="es">¿Qué hiciste el fin de semana?</p>
          <div className="docs-demo-actions"><button type="button" className="btn" aria-pressed={translation} onClick={() => setTranslation(value => !value)}><ToolbarIcon name="translate" />Translation</button><button type="button" className="btn" aria-pressed={saved} onClick={() => setSaved(value => !value)}><ToolbarIcon name={saved ? 'deck-added' : 'deck-add'} />{saved ? 'Added to Practice (sample)' : 'Add to Practice'}</button></div>
          {translation && <p>What did you do at the weekend?</p>}
        </div>
        {sent && <div className="docs-demo-message"><strong>Fixed example reply</strong><p lang="es">¡Qué bien! ¿Qué compraste?</p><p>The text you typed is not assessed in this example.</p></div>}
        <div className="docs-demo-composer"><ComposerInput input={input} onInput={setInput} available sending={false} recording={recording} transcribing={false}
          autoSend={autoSend} onAutoSend={setAutoSend} mode={mode} onMode={setMode} targetLanguageTag="es" targetLanguageName="Español"
          onSend={send} onToggleRecording={() => recording ? finish() : setRecording(true)} onHoldStart={() => setRecording(true)} onHoldEnd={finish}
          onDiscardRecording={() => { setRecording(false); setNotice('Simulated recording discarded.') }}
          stream={<p>Simulated recording — no microphone access</p>} prompt={<p>Try a simulated recording</p>} /></div>
      </div>
      <aside className="docs-demo-coach"><CoachPanelTabs tab={tab} onTab={setTab} />
        {tab === 'coaching' ? <><p>Fixed feedback for an earlier example message, “Ayer go al mercado.”</p><ConversationFeedbackCard feedback={feedback} /></>
          : <p>The chat’s Progress panel shows evidence and activity for that conversation. Language-wide progress is available from the profile and Progress page.</p>}
      </aside>
    </div>
  </>
}
