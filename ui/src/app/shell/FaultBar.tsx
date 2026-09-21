import { useId, useRef, useState } from 'react'
import { ShareLogsButton } from '../../components/feedback/ShareLogsButton'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { useI18n } from '../../components/localization/i18n'
import { useFaultStore } from '../../platform/diagnostics/faults'

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
    <div id={id} className="fault-bar" role="alert">
      <ShareLogsButton />
      <button type="button" className="btn tiny" onClick={dismissAll}>{tr("Dismiss all")}</button>
      {faults.map((f) => (
        <div key={f.id} className="fault">
          <b>{f.context}:</b> {f.message}
          <button
            type="button"
            className="fault-dismiss"
            aria-label={tr("Dismiss")}
            onClick={() => dismiss(f.id)}
          >
            ✕
          </button>
          <ResponseDetails value={f.diagnostics} />
        </div>
      ))}
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
