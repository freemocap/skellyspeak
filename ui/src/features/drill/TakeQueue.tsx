import { useI18n } from '../../components/localization/i18n'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { errorMessage } from '../../platform/diagnostics/error-details'
import type { DrillAttemptView, ListeningTake } from '../../generated/contracts'
import type { PendingRecording } from '../../platform/audio/useMicRecorder'
import { AttemptResult } from './AttemptLog'

/** Keep the recording identity (and its row) while native publishes the result. */
export function TakeQueue({ takes, attempts, rtl, onSelect, onDelete, deleting, onRecordAgain, recordingBusy }: {
  takes: (ListeningTake | PendingRecording)[]
  attempts: DrillAttemptView[]
  rtl: boolean
  onSelect: (id: string) => void
  onDelete: (attempt: DrillAttemptView) => void
  deleting: boolean
  onRecordAgain?: () => void
  recordingBusy?: boolean
}) {
  const tr = useI18n()
  // The first row is always there: an idle take slot until a recording starts,
  // so a new take fills a reserved row instead of pushing the report down.
  if (!takes.length) return <ol className="drill-attempts" aria-label={tr('Attempts')}>
    <li className="drill-take-idle"><article className="drill-take-pending" data-state="idle">
      <div className="drill-attempt-head"><strong>{tr('Next take')}</strong></div>
      <p>{tr('No take in progress')}</p>
      <div className="drill-take-progress" aria-hidden="true" />
    </article></li>
  </ol>
  return <ol className="drill-attempts" aria-label={tr('Attempts')}>
    {[...takes].reverse().map(take => {
      const attempt = attempts.find(item => item.transcriptionAttemptId === take.recordingId)
      const busy = take.state === 'queued' || take.state === 'processing'
      return <li key={take.recordingId} className="drill-take-arrival" data-recording-id={take.recordingId}>
        {attempt ? <AttemptResult attempt={attempt} rtl={rtl} onSelect={onSelect} onDelete={onDelete} deleting={deleting} /> :
          <article className="drill-take-pending" data-state={take.state} aria-busy={busy}>
            <div className="drill-attempt-head"><strong>{'number' in take ? tr('Take {value0}', { value0: take.number }) : tr('Recording')}</strong>
              {'endSeconds' in take && <span className="drill-chip">{tr('{value0} seconds', { value0: tr.number(take.endSeconds - take.startSeconds, { maximumFractionDigits: 1 }) })}</span>}</div>
            <p role="status">{take.state === 'queued' ? tr('Queued') : take.state === 'processing' ? tr('Transcribing…') : take.state === 'failed' ? tr('Take failed') : tr('Loading result…')}</p>
            <div className="drill-take-progress" aria-hidden="true">{busy && <span />}</div>
            {take.failure != null && <><p>{errorMessage(take.failure)}</p><ResponseDetails value={take.failure} />
              {onRecordAgain && <button type="button" className="btn" disabled={recordingBusy} onClick={onRecordAgain}>{tr('Record again')}</button>}</>}
          </article>}
      </li>
    })}
  </ol>
}
