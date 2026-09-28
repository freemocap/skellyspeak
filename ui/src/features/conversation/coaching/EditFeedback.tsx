import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { useState } from 'react'
import { nativeError } from '../../../platform/ipc/workspace'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'
import { CoachEntry } from './CoachEntry'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'

/** What the coach said about the message being fixed, above the composer. */
export function EditFeedback({ decision, feedback, error, reviewing, onControl }: {
  onControl?: (control: CoachControl) => Promise<void>
  feedback?: CoachObservationView; decision: CoachDecision | undefined; error: string | undefined; reviewing: boolean
}) {
  const tr = useI18n()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  async function help(control: CoachControl) {
    if (!onControl || busy) return
    setBusy(true); setFailure(null)
    try { await onControl(control) } catch (error) { setFailure(nativeError(error)) } finally { setBusy(false) }
  }
  return <section className="edit-feedback">
    <p><ToolbarIcon name="idea" size={14} />{tr("Coach suggests")}</p>
    <div className="edit-feedback-body" role="region" aria-label={tr("Coach feedback while editing")} tabIndex={0}>
      {decision?.shown && decision.exposedMove !== decision.shown.move && <button type="button" disabled={busy || !onControl} onClick={() => void help('open_card')}>{tr("Show help")}</button>}
      {decision || error ? <CoachEntry feedback={feedback} decision={decision} source={null} error={error} /> : <p>{reviewing ? tr("The coach is still reviewing this message.") : tr("No feedback was saved for this message.")}</p>}
      {decision?.shown && decision.exposedMove === decision.shown.move && decision.shown.move !== 'explicit' && <button type="button" disabled={busy || !onControl} onClick={() => void help('show_answer')}>{tr("Show answer")}</button>}
      {failure && <ErrorNotice as="p" error={failure}>{failure}</ErrorNotice>}
    </div>
  </section>
}
