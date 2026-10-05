import { useId, useRef, useState } from 'react'
import { ShareLogsButton } from '../../components/feedback/ShareLogsButton'
import { foldedText, useFriendlyCopy, useFriendlyError } from '../../components/feedback/FriendlyError'
import { useI18n } from '../../components/localization/i18n'
import { useFaultStore, type Fault } from '../../platform/diagnostics/faults'

/// One failure in plain words: where it happened, what it means and what to do.
/// The recorded message and its diagnostics are the fold beneath.
function FaultRow({ fault, onDismiss }: { fault: Fault; onDismiss: () => void }) {
  const tr = useI18n()
  const friendly = useFriendlyError(fault)
  const { title, body } = useFriendlyCopy(friendly)
  const folded = foldedText(friendly, fault.message)
  return <div className="fault">
    <b>{fault.context}: {title}</b> {body}
    <button type="button" className="error-dismiss" aria-label={tr("Dismiss")} onClick={onDismiss}>✕</button>
    {(folded || fault.diagnostics != null) && <details className="response-details"><summary>{tr('Technical details')}</summary>
      {folded && <p className="error-raw">{folded}</p>}
      {fault.diagnostics != null && <pre>{JSON.stringify(fault.diagnostics, null, 2)}</pre>}
    </details>}
  </div>
}

/// Everything that has gone wrong anywhere in the app, shown at the very top of
/// the window until dismissed. This is the only destination for a failure.
export function FaultBar() {
  const tr = useI18n()
  const faults = useFaultStore((state) => state.faults)
  const dismiss = useFaultStore((state) => state.dismiss)
  const dismissAll = useFaultStore((state) => state.dismissAll)
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  const resize = (value: number) => setHeight(Math.min(window.innerHeight * 0.85, Math.max(80, value)))
  if (faults.length === 0) return null
  return (
    <div className="fault-panel" ref={panel} style={height === null ? undefined : { height }}>
    <button type="button" className="error-dismiss fault-dismiss-all" aria-label={tr("Dismiss all")} title={tr("Dismiss all")} onClick={dismissAll}>×</button>
    <div id={id} className="fault-bar" role="alert">
      <div className="fault-export"><ShareLogsButton compact /></div>
      {faults.map((f) => <FaultRow key={f.id} fault={f} onDismiss={() => dismiss(f.id)} />)}
    </div>
    <div className="fault-resize" role="separator" tabIndex={0} aria-label={tr('Resize panel')}
      title={tr('Drag to resize')} aria-orientation="horizontal" aria-controls={id}
      aria-valuemin={80} aria-valuemax={Math.round(window.innerHeight * 0.85)}
      aria-valuenow={Math.round(height ?? panel.current?.getBoundingClientRect().height ?? 120)}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId) && panel.current)
          resize(event.clientY - panel.current.getBoundingClientRect().top)
      }}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onKeyDown={event => {
        const current = panel.current?.getBoundingClientRect().height ?? 120
        const next = { ArrowUp: current - 40, ArrowDown: current + 40, Home: 80, End: window.innerHeight * 0.85 }[event.key]
        if (next !== undefined) { event.preventDefault(); resize(next) }
      }}><span aria-hidden="true" /></div>
    </div>
  )
}
