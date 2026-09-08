import type { CoachHelp } from '../../types'
import { Pronunciation } from '../Pronunciation'
import { useRef, useState } from 'react'

export function ComposerHelp({ alwaysPronunciation, help, pending, busy, errors, onUse, onRefresh }: {
  alwaysPronunciation: boolean
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
        <p className="help-original" dir="auto">{help.partner.text}</p>
        <p dir="auto">{help.partner.translation}</p>
        {help.partner.romanization && <p className="help-romanization" dir="ltr">{help.partner.romanization}</p>}
        <Pronunciation key={help.partner.pronunciation} text={help.partner.pronunciation} alwaysShow={alwaysPronunciation} />
      </div>
      <p className="help-explanation" dir="auto">{help.explanation}</p>
      <div className="help-replies">
        {help.replies.map(phrase => <div className="help-reply" key={phrase.text}>
          <button type="button" disabled={busy} dir="auto" onClick={() => onUse(phrase.text, 'suggestion')}>{phrase.text}<span aria-hidden="true"> ↗</span></button>
          <p className="help-translation" dir="auto">{phrase.translation}</p>
          {phrase.romanization && <p className="help-romanization" dir="ltr">{phrase.romanization}</p>}
          <Pronunciation key={phrase.pronunciation} text={phrase.pronunciation} alwaysShow={alwaysPronunciation} />
        </div>)}
      </div>
    </> : pending ? <p role="status">Loading…</p> : <p role={errors.length ? 'alert' : undefined}>{errors.length ? errors.join(' · ') : 'No saved advice for this message.'}</p>}
  </section>
}
