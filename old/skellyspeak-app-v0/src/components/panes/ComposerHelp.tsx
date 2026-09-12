import { TargetText } from '../TargetText'
import { useReadingPreferences } from '../ReadingPreferences'
import type { CoachHelp } from '../../types'

export function ComposerHelp({ help, pending, busy, errors, onUse }: {
  help: CoachHelp | null; pending: boolean; busy: boolean; errors: string[]
  onUse: (text: string, source: 'suggestion') => void
}) {
  const { autoTranslate } = useReadingPreferences()
  return <section id="composer-help-content" className="composer-help-content" aria-label="Coach advice" aria-live="polite" aria-busy={!help && pending}>
    {help ? <>
      <div className="help-replies" aria-label="Suggested replies">
        {help.replies.map(phrase => <div className="help-reply" key={phrase.text}>
          <span className="help-reply-text" dir="auto"><TargetText text={phrase.text} /><button type="button" className="help-insert" aria-label={`Insert reply: ${phrase.text}`} title="Insert reply" disabled={busy} onClick={() => onUse(phrase.text, 'suggestion')}><span aria-hidden="true">↗</span></button></span>
          {autoTranslate && <span className="help-translation" dir="auto">{phrase.translation}</span>}
        </div>)}
      </div>
      <div className="help-footer">
        <details className="help-context" key={help.partner.text}>
          <summary>Understand the exchange</summary>
          <p className="help-explanation" dir="auto">{help.explanation}</p>
          {autoTranslate && <p className="help-translation" dir="auto">{help.partner.translation}</p>}
        </details>
      </div>
    </> : pending ? <p role="status">Finding reply ideas…</p> : <p role={errors.length ? 'alert' : undefined}>{errors.length ? errors.join(' · ') : 'No saved advice for this message.'}</p>}
  </section>
}
