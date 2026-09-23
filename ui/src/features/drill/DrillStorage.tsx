import { useEffect, useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { DRILL_RECORDING_MAX_MB, type DrillStorageView } from '../../generated/contracts'
import { drillStorage, setDrillStorage } from '../../platform/ipc/drill'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { onRecordingPublished } from '../../platform/audio/recording-events'

/** How much of the learner's own recording audio is kept, in megabytes.
 *
 * The cap is a number the learner types. Zero keeps no recording audio. Pruning,
 * validation and accounting are native; this reads the totals and sends the cap. */
export function DrillStorage({ active, onChanged }: { active: boolean; onChanged: () => Promise<void> }) {
  const tr = useI18n()
  const [retry, setRetry] = useState(0)
  const [open, setOpen] = useState(false)
  const [storage, setStorage] = useState<DrillStorageView | null>(null)
  const [entered, setEntered] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  useEffect(() => {
    if (!active || !open) return
    let current = true
    const load = () => { void drillStorage().then(value => {
      if (current) { setStorage(value); setEntered(String(value.limitMb)); setFailure(null) }
    }).catch(error => { if (current) setFailure(error) }) }
    load()
    const unsubscribe = onRecordingPublished(owner => { if (owner.kind === 'drillItem') load() })
    return () => { current = false; unsubscribe() }
  }, [active, open, retry])

  // Only a whole number of megabytes in range can be sent; anything else keeps
  // Apply disabled rather than guessing what the learner meant.
  const limit = /^\d+$/.test(entered.trim()) ? Number(entered.trim()) : null
  const valid = limit !== null && limit <= DRILL_RECORDING_MAX_MB
  const save = async () => {
    if (!valid) return
    setBusy(true); setFailure(null)
    try { setStorage(await setDrillStorage(limit)) }
    catch (error) { setFailure(error) }
    finally {
      // A cleanup failure can follow a committed policy change. Refresh attempts
      // so their disabled replay state always reflects native ownership.
      try { await onChanged() } catch (error) { setFailure(error) }
      setBusy(false)
    }
  }

  const megabytes = (bytes: number) => tr.number(bytes / 1_000_000, { maximumFractionDigits: 1 })
  return <details className="drill-storage" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>
      {tr('Recording storage')}
      {storage && <span className="drill-storage-total">{storage.limitMb === 0
        ? tr('keeping none')
        : tr('{value0} of {value1} MB', { value0: megabytes(storage.recordingBytes), value1: tr.number(storage.limitMb) })}</span>}
    </summary>
    <div className="drill-storage-body">
      <div className="drill-storage-limit">
        <label htmlFor="drill-limit">{tr('Keep up to')}</label>
        <input id="drill-limit" className="field" type="number" inputMode="numeric" min={0} max={DRILL_RECORDING_MAX_MB}
          step={1} value={entered} disabled={busy || storage === null}
          onChange={event => setEntered(event.target.value)} />
        <span>{tr('MB')}</span>
        <button type="button" className="btn" disabled={busy || !valid} onClick={() => void save()}>{tr('Apply')}</button>
      </div>
      <p>{tr('Zero keeps no recording audio. Oldest recordings are removed first; transcripts and comparisons remain. Reference audio uses a separate bounded cache.')}</p>
      {!valid && entered.trim() !== '' && <p role="alert">{tr('Enter a whole number of megabytes, 0 to {value0}.', { value0: tr.number(DRILL_RECORDING_MAX_MB) })}</p>}
      {storage && <p role="status">{tr('Recordings {value0} MB · references {value1} MB', {
        value0: megabytes(storage.recordingBytes), value1: megabytes(storage.referenceBytes),
      })}</p>}
      {failure != null && <p role="alert">{errorMessage(failure)} <button type="button" className="btn" disabled={busy}
        onClick={() => storage === null ? setRetry(value => value + 1) : void save()}>{tr('Try again')}</button></p>}
    </div>
  </details>
}
