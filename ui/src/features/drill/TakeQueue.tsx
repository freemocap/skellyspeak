import { useI18n } from '../../components/localization/i18n'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { errorMessage } from '../../platform/diagnostics/error-details'
import type { DrillAttemptView, ListeningTake } from '../../generated/contracts'
import type { PendingRecording } from '../../platform/audio/useMicRecorder'

/** Keep the recording identity (and its row) while native publishes the result. */
export function TakeQueue({ takes, attempts, onRecordAgain, recordingBusy, compact = false }: {
  takes: (ListeningTake | PendingRecording)[]
  attempts: DrillAttemptView[]
  onRecordAgain?: () => void
  compact?: boolean
  recordingBusy?: boolean
}) {
  const tr = useI18n()
  const pending = takes.filter(take => !attempts.some(item => item.transcriptionAttemptId === take.recordingId))
  if (!pending.length) return null
  if (compact) {
    const take = pending[pending.length - 1]
    return <div className="drill-take-compact" data-recording-id={take.recordingId} role="status">
      {take.state === 'processing' && <span className="activity-spinner" aria-hidden="true" />}{take.state === 'queued' ? tr('Queued') : take.state === 'processing' ? tr('Transcribing…') : take.state === 'failed' ? tr('Attempt failed') : tr('Loading result…')}
    </div>
  }
  return <ol className="drill-attempts" aria-label={tr('Attempts')}>
    {[...pending].reverse().map(take => {
      const busy = take.state === 'queued' || take.state === 'processing'
      return <li key={take.recordingId} className="drill-take-arrival" data-recording-id={take.recordingId}>
          <article className="drill-take-pending" data-state={take.state} aria-busy={busy}>
            <div className="drill-attempt-head"><strong>{'number' in take ? tr('Attempt {value0}', { value0: take.number }) : tr('Recording')}</strong>
              {'endSeconds' in take && <span className="drill-chip">{tr('{value0} seconds', { value0: tr.number(take.endSeconds - take.startSeconds, { maximumFractionDigits: 1 }) })}</span>}</div>
            <p role="status">{take.state === 'processing' && <span className="activity-spinner" aria-hidden="true" />}{take.state === 'queued' ? tr('Queued') : take.state === 'processing' ? tr('Transcribing…') : take.state === 'failed' ? tr('Attempt failed') : tr('Loading result…')}</p>
            <div className="drill-take-progress" aria-hidden="true">{busy && <span />}</div>
            {take.failure != null && <><p>{errorMessage(take.failure)}</p><ResponseDetails value={take.failure} />
              {onRecordAgain && <button type="button" className="btn" disabled={recordingBusy} onClick={onRecordAgain}>{tr('Record again')}</button>}</>}
          </article>
      </li>
    })}
  </ol>
}
