import { useMemo } from 'react'
import { friendlyError, type FriendlyError } from '../../platform/diagnostics/friendly-error'
import { useI18n } from '../localization/i18n'

/** The plain-words reading of one failure. The clock is read once per error:
 * it only decides when daily credits are shown as returning. */
export function useFriendlyError(error: unknown): FriendlyError {
  return useMemo(() => friendlyError(error, Date.now()), [error])
}

/** What happened, then what to do. Every sentence is true of every failure in
 * its kind, so none promises a retry, a saved message or a cause it cannot know.
 * An unrecognised failure keeps the app's own sentence when it has one. */
export function useFriendlyCopy(friendly: FriendlyError): { title: string; body: string } {
  const tr = useI18n()
  switch (friendly.kind) {
    case 'credits': return { title: tr("You're out of credits for today"),
      body: tr('You get new credits at {time}.', { time: tr.date(friendly.resetAt, { hour: 'numeric', minute: '2-digit' }) }) }
    case 'shared-credits': return { title: tr('The free service is out of credits for today'),
      body: tr("It isn't your usage. New credits arrive at {time}.", { time: tr.date(friendly.resetAt, { hour: 'numeric', minute: '2-digit' }) }) }
    case 'service-paused': return { title: tr('The AI service is paused'), body: tr("It isn't something you did. Try again later.") }
    case 'signed-out': return { title: tr("You've been signed out"), body: tr('Sign in again to keep going.') }
    case 'busy': return { title: tr('The AI service is busy'), body: tr('Wait a few seconds, then try again.') }
    case 'silent-microphone': return { title: tr("The microphone didn't pick anything up"), body: tr("Check that it's allowed and not muted, then try again.") }
    case 'stopped': return { title: tr('Stopped before it finished'), body: tr('Start it again if you still want it.') }
    case 'offline': return { title: tr("Can't reach the AI service"), body: tr('Check your connection, then try again.') }
    case 'dropped': return { title: tr('The connection dropped'), body: tr("The answer didn't make it back. Try again.") }
    case 'unusable-answer': return { title: tr("The AI's answer wasn't usable"), body: tr('Try again.') }
    case 'unknown': return { title: tr('Something went wrong'), body: friendly.explanation ?? tr('Try again, and open the details if it keeps happening.') }
  }
}

/** The recorded text that belongs in the fold: all of it, unless the summary
 * already shows exactly that sentence. */
export function foldedText(friendly: FriendlyError, recorded: string): string {
  return friendly.kind === 'unknown' && friendly.explanation === recorded.trim() ? '' : recorded
}

/** The summary's two lines. `context` names what failed, where the owner has a name for it. */
export function FriendlySummary({ friendly, context }: { friendly: FriendlyError; context: string | null }) {
  const { title, body } = useFriendlyCopy(friendly)
  return <>
    <span className="error-title">{context !== null && <span className="error-context">{context}</span>}{title}</span>
    <span className="error-body">{body}</span>
  </>
}

/** Buying credits is not available yet; the control marks where it will be. */
export function AddCredits({ friendly }: { friendly: FriendlyError }) {
  const tr = useI18n()
  if (friendly.kind !== 'credits') return null
  return <button type="button" className="btn error-credits" disabled>{tr('Add credits')} · {tr('Coming soon')}</button>
}

/** A failure reason shown inside another surface, such as a reply that did not
 * arrive: plain words first, the recorded reason folded beneath. */
export function FriendlyReason({ error }: { error: string }) {
  const tr = useI18n()
  const friendly = useFriendlyError(error)
  const folded = foldedText(friendly, error)
  return <div className="error-reason" data-level={friendly.level}>
    <FriendlySummary friendly={friendly} context={null} />
    {folded && <details className="response-details"><summary>{tr('Technical details')}</summary><p className="error-raw">{folded}</p></details>}
    <AddCredits friendly={friendly} />
  </div>
}
