import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '../../components/localization/i18n'

const WIDTH_KEY = 'skellyspeak_ai_inspector_width'
const MIN = 25
const MAX = 75
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value))

/** A local presentation preference, shared by live and definition inspectors. */
export function AiSplit({ children, inspector }: { children: ReactNode; inspector: ReactNode }) {
  const tr = useI18n()
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    return saved > 0 && Number.isFinite(saved) ? clamp(saved) : 40
  })
  const change = (value: number) => {
    const next = clamp(value)
    setWidth(next)
    localStorage.setItem(WIDTH_KEY, String(next))
  }
  return <div ref={root} className={`ai-view-body${inspector ? ' ai-view-split' : ''}`} style={{ '--ai-inspector-width': `${width}%` } as CSSProperties}>
    {children}
    {inspector && <>
      <div className="ai-inspector-resize" role="separator" tabIndex={0} aria-label={tr('Resize panel')}
        aria-orientation="vertical" aria-controls={id} aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={Math.round(width)}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId) || !root.current) return
          const bounds = root.current.getBoundingClientRect()
          if (!bounds.width) return
          const rtl = getComputedStyle(root.current).direction === 'rtl'
          change((rtl ? event.clientX - bounds.left : bounds.right - event.clientX) / bounds.width * 100)
        }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onKeyDown={event => {
          const rtl = root.current && getComputedStyle(root.current).direction === 'rtl'
          if (event.key === 'Home') change(MIN)
          else if (event.key === 'End') change(MAX)
          else if (event.key === 'ArrowLeft') change(width + (rtl ? -4 : 4))
          else if (event.key === 'ArrowRight') change(width + (rtl ? 4 : -4))
          else return
          event.preventDefault()
        }} />
      <div id={id} className="ai-inspector-slot">{inspector}</div>
    </>}
  </div>
}
