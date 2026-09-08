import type { AssistedPhrase, CoachHelp } from '../../types'
import { useRef, useState } from 'react'

function Pronunciation({ phrase }: { phrase: AssistedPhrase }) {
  return <>
    {phrase.romanization && <p className="help-romanization" dir="ltr">{phrase.romanization}</p>}
    <details className="help-pronunciation"><summary>Pronunciation</summary><p dir="auto">{phrase.pronunciation}</p></details>
  </>
}

export function ComposerHelp({ help, pending, busy, errors, onUse, onRefresh }: {
  help: CoachHelp | null; pending: boolean; busy: boolean; errors: string[]
  onUse: (text: string, source: 'suggestion') => void
  onRefresh: () => Promise<void>
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const refresh = async (): Promise<void> => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true); setRefreshError(null)
    try { await onRefresh() }
    catch (error) { setRefreshError(String(error)) }
    finally { inFlight.current = false; setRefreshing(false) }
  }
  return <section id="composer-help-content" className="composer-help-content" aria-label="Coach advice" aria-live="polite" aria-busy={!help && pending}>
    <button type="button" className="advice-refresh" aria-label="Regenerate advice" title="Different advice" disabled={!help || pending || busy || refreshing} onClick={() => { void refresh() }}>{refreshing ? 'Refreshing…' : '↻'}</button>
    {refreshError && <p role="alert">{refreshError}</p>}
    {help ? <>
      <div className="help-meaning">
        <p dir="auto">{help.partner.translation}</p>
        <p className="help-explanation" dir="auto">{help.explanation}</p>
        <Pronunciation phrase={help.partner} />
      </div>
      <div className="help-replies">
        {help.replies.map(phrase => <div className="help-reply" key={phrase.text}>
          <button type="button" disabled={busy} dir="auto" onClick={() => onUse(phrase.text, 'suggestion')}>{phrase.text}<span aria-hidden="true"> ↗</span></button>
          <p className="help-translation" dir="auto">{phrase.translation}</p>
          <Pronunciation phrase={phrase} />
        </div>)}
      </div>
    </> : pending ? <p role="status">Loading…</p> : <p role={errors.length ? 'alert' : undefined}>{errors.length ? errors.join(' · ') : 'No saved advice for this message.'}</p>}
  </section>
}
