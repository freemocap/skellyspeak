/** Design-system previews: real shared components rendered to static markup with
 *  sample data. build.ts bundles this file, calls render(), and writes each entry
 *  to docs/design-system/components/<name>/preview.html. No native calls or state. */
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { I18nProvider } from '../../src/components/localization/i18n'
import { ToolbarIcon, type ToolbarIconName } from '../../src/components/controls/ToolbarIcon'
import { InfoTip } from '../../src/components/controls/InfoTip'
import { ActivityIndicator } from '../../src/components/feedback/ActivityIndicator'
import { ErrorDetails } from '../../src/components/feedback/ErrorDetails'
import { SavedGlossText } from '../../src/components/reading/SavedGlossText'
import { ReadingPreferencesContext } from '../../src/components/reading/ReadingPreferences'
import { ComposerInput } from '../../src/features/conversation/composer/ComposerInput'
import { ConversationFeedbackCard } from '../../src/features/conversation/coaching/ConversationFeedbackCard'

export type Preview = { name: string; group: string; height: number; element: ReactElement }

const noop = () => {}

export const previews: Preview[] = [
  { name: 'Button', group: 'Actions', height: 72, element: <div className="ds-row">
    <button className="btn primary">Start a conversation</button>
    <button className="btn">Review</button>
    <button className="btn danger">Delete this conversation</button>
    <button className="btn tiny">Retry failed</button>
    <button className="btn" disabled>Saving…</button>
  </div> },
  { name: 'PanelTabs', group: 'Navigation', height: 72, element: <div className="panel-tabs" role="tablist">
    <button className="panel-tab active" role="tab" aria-selected="true">Conversation</button>
    <button className="panel-tab" role="tab" aria-selected="false">Coach</button>
    <button className="panel-tab" role="tab" aria-selected="false">Evidence</button>
  </div> },
  { name: 'Field', group: 'Forms', height: 180, element: <div className="ds-stack">
    <div className="form-row"><label htmlFor="ds-name">Native language</label><input id="ds-name" placeholder="English" /></div>
    <div className="form-row"><label htmlFor="ds-level">Difficulty</label><select id="ds-level"><option>Beginner</option></select></div>
    <p className="field-note">Saved credentials are kept when you discard unsaved edits.</p>
  </div> },
  { name: 'Composer', group: 'Conversation', height: 96, element: <div className="chat"><div className="composer">
    <ComposerInput input="" available sending={false} recording={false} transcribing={false} autoSend={false}
      targetLanguageTag="es" targetLanguageName="Spanish" onInput={noop} onSend={noop} onDiscardRecording={noop} onToggleRecording={noop} />
  </div></div> },
  { name: 'ChatMessage', group: 'Conversation', height: 280, element: <ReadingPreferencesContext value={{ autoTranslate: true, alwaysPronunciation: false, alwaysRomanize: true, supportsRomanization: true }}><div className="chat"><div className="stream">
    <div className="msg chat-message bot"><SavedGlossText text="¿Hay una farmacia por aquí?"
      segments={[{ start: 9, end: 17, kind: 'gloss', gloss: 'pharmacy', pronunciation: 'far-MA-sya' } as never]} /></div>
    <div className="msg chat-message me plain">Sí, hay una al lado del banco.</div>
    <div className="msg chat-message bot rtl" dir="rtl"><SavedGlossText text="والكتاب"
      segments={[{ start: 0, end: 1, kind: 'gloss', gloss: 'and', romanization: 'wa' }, { start: 1, end: 3, kind: 'gloss', gloss: 'the', romanization: 'al' }, { start: 3, end: 7, kind: 'gloss', gloss: 'book', romanization: 'kitāb' }] as never} /></div>
    <div className="msg chat-message me plain pending">Gracias, voy ahora…</div>
  </div></div></ReadingPreferencesContext> },
  { name: 'CoachFeedback', group: 'Conversation', height: 300, element: <div className="study-coaching">
    <ConversationFeedbackCard feedback={{
      remark: 'Clear and friendly. One small agreement slip.',
      corrections: [{ said: 'la problema', corrected: 'el problema', explanation: '*Problema* is masculine even though it ends in -a.', kind: 'grammar' }],
      grammar: 3, conversation: 5, usedTarget: ['¿Dónde está…?'], usedNative: [],
    }} />
  </div> },
  { name: 'InfoTip', group: 'Feedback', height: 56, element: <p className="ds-text">Estimate <InfoTip>Assessments are model judgments, not independent human validation.</InfoTip></p> },
  { name: 'ActivityIndicator', group: 'Feedback', height: 56, element: <div className="ds-row">
    <ActivityIndicator label="Generating a persona…" />
    <ActivityIndicator label="Saving…" compact />
  </div> },
  { name: 'ErrorDetails', group: 'Feedback', height: 64, element: <ErrorDetails label="Request failed" errorKey="sample">
    The hosted service did not answer within 30 seconds. Your message is saved; retry when you are back online.
  </ErrorDetails> },
  // DetailDialog portals into document.body and opens itself with showModal(),
  // which static rendering cannot do. This is the markup it produces, opened.
  { name: 'DetailDialog', group: 'Overlays', height: 180, element: <dialog className="detail-dialog ds-inline-dialog" open aria-label="How your message came across">
    <button className="detail-close" aria-label="Close How your message came across"><ToolbarIcon name="close" size={18} /></button>
    <h2>How your message came across</h2>
    <p>Shared dialog surface for detail views. Wide reports use <code>size="wide"</code>.</p>
  </dialog> },
]

export const iconNames: ToolbarIconName[] = ['menu', 'more', 'plus', 'close', 'chevron', 'expand', 'collapse', 'popout', 'popin',
  'reload', 'update', 'settings', 'cog', 'profile', 'key', 'models', 'data', 'globe', 'voice', 'keyboard', 'reading',
  'appearance', 'sun', 'moon', 'star', 'idea']

export function render() {
  return {
    previews: previews.map(({ element, ...rest }) => ({ ...rest, html: renderToStaticMarkup(<I18nProvider locale="english">{element}</I18nProvider>) })),
    icons: iconNames.map(name => ({ name, svg: renderToStaticMarkup(<ToolbarIcon name={name} size={24} />) })),
  }
}
