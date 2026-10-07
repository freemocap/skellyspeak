/** Read-aloud status fixture: the real ReadingHelp with a stubbed speech service.
 *
 * The buttons start a read-aloud that plays for two and a half seconds, or fails
 * in the three ways the app tells apart; the Retry outcome select decides what
 * a Retry from the failure card does. The page is laid out like Chat on a
 * phone, with a recording panel that offers the tray slot: below 860px the
 * status rises above the recorder, wider it floats bottom-right. No speech
 * request is made and nothing is saved.
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { ReadingHelp } from '../src/components/reading/ReadingHelp'
import { ReadAloudSlotContext, ReadingScopeContext, useReadingActions, type ReadingServices } from '../src/components/reading/ReadingContext'
import { I18nProvider } from '../src/components/localization/i18n'
import { useIsMobile } from '../src/components/layout/useIsMobile'
import { aiTraySlot, useAiTrayStore } from '../src/state/navigation/ai-tray'
import '../src/styles/index.css'
import './audio-status-preview.css'

type Outcome = 'plays' | 'dropped' | 'offline' | 'unknown'
const OUTCOMES: Record<Outcome, string> = { plays: 'Plays', dropped: 'Fails: connection dropped', offline: 'Fails: offline', unknown: 'Fails: unnamed' }
const FAILURES: Record<Exclude<Outcome, 'plays'>, string> = {
  dropped: 'grouped_request: transport_failed. Provider processing may have occurred; no automatic retry was made.',
  offline: 'Could not reach the speech service: dns error: failed to lookup address information.',
  unknown: 'Offline preview: speech is available in the native app. No request was sent.',
}
let outcome: Outcome = 'plays'
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Speech was stopped', 'AbortError')) }, { once: true })
})
const services: ReadingServices = {
  read: async () => { throw new Error('No reading requests in this fixture.') },
  speak: async (_input, signal, onPlayback) => {
    await wait(900, signal)
    if (outcome !== 'plays') throw new Error(FAILURES[outcome])
    onPlayback()
    await wait(2500, signal)
    return { fixture: true }
  },
  activity: async () => [],
}
const scope = { language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }

function Controls() {
  const actions = useReadingActions()
  const [choice, setChoice] = useState<Outcome>(outcome)
  const choose = (next: Outcome) => { outcome = next; setChoice(next) }
  return <div className="asp-controls">
    {(Object.keys(OUTCOMES) as Outcome[]).map(key => <button key={key} type="button" className="btn" onClick={() => { choose(key); actions?.speak({ scope, text: 'Hola, mundo.', start: 0, end: 4 }) }}>{OUTCOMES[key]}</button>)}
    <label>Retry outcome <select className="field" value={choice} onChange={event => choose(event.target.value as Outcome)}>
      {(Object.keys(OUTCOMES) as Outcome[]).map(key => <option key={key} value={key}>{OUTCOMES[key]}</option>)}</select></label>
  </div>
}

function Page() {
  const [dark, setDark] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  return <div className="asp-app">
    <div className="asp-phone-top">Read-aloud status fixture<button className="btn" type="button" onClick={() => setDark(!dark)}>{dark ? 'Light theme' : 'Dark theme'}</button></div>
    <div className="asp-phone-thread">
      <p className="asp-note">Start a read-aloud. Below 860px wide the status rises above the recorder; wider, it floats bottom-right. No speech request is made.</p>
      <Controls />
      <p className="msg chat-message bot"><span className="w" dir="auto">مَسْكَنُك، هَل تُحِبُّ المَسالِكَ الجَدِيدَة؟</span></p>
      <p className="msg chat-message me"><span className="w" dir="auto">نعم، بحب المشي كل يوم.</span></p>
      <p className="msg chat-message bot"><span className="w" dir="auto">ممتاز! وين بتمشي عادةً؟</span></p>
    </div>
    <div className="composer"><div className="ai-tray-slot" ref={aiTraySlot} /><div className="asp-composer-row">
      <textarea className="field composer-input" aria-label="Message" rows={1} placeholder="Type or hold to talk" /><button className="btn primary" type="button">Hold to talk</button></div></div>
  </div>
}

/** The app's own placement rule, as ReadingTools applies it: a phone's recording panel hosts the status. */
function Fixture() {
  const slot = useAiTrayStore(state => state.slot)
  const mobile = useIsMobile()
  return <ReadAloudSlotContext value={mobile ? slot : null}><ReadingHelp services={services} languages={[]}><Page /></ReadingHelp></ReadAloudSlotContext>
}

createRoot(document.getElementById('root')!).render(<I18nProvider locale="english"><ReadingScopeContext value={scope}><Fixture /></ReadingScopeContext></I18nProvider>)
