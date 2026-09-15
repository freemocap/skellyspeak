import { useI18n } from '../../../components/localization/i18n'
import { useState, type RefObject } from 'react'

/** Size the coach in pixels so resizing cannot overwhelm the reading surface. */
export function PracticeDivider({ workspace }: { workspace: RefObject<HTMLDivElement | null> }) {
  const tr = useI18n()
  const [dragging, setDragging] = useState(false)
  const [width, setWidth] = useState(() => Number(/- (\d+)px/.exec(workspace.current?.style.getPropertyValue('--chat-share') ?? '')?.[1] ?? 360))
  function resize(value: number) {
    const next = Math.min(520, Math.max(320, Math.round(value)))
    setWidth(next)
    workspace.current?.style.setProperty('--chat-share', `calc(100% - ${next}px)`)
  }
  return <div className={dragging ? 'practice-divider dragging' : 'practice-divider'} role="separator" tabIndex={0}
    aria-label={tr("Conversation and coach width")} aria-orientation="vertical"
    aria-valuemin={320} aria-valuemax={520} aria-valuenow={width}
    onDoubleClick={() => resize(360)}
    onKeyDown={event => {
      const next = { ArrowLeft: width + 20, ArrowRight: width - 20, Home: 320, End: 520 }[event.key]
      if (next !== undefined) { event.preventDefault(); resize(next) }
    }}
    onPointerDown={event => { if (event.button === 0) { setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() } }}
    onPointerMove={event => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      const box = workspace.current?.getBoundingClientRect()
      if (box?.width) resize(box.right - event.clientX)
    }}
    onPointerCancel={() => setDragging(false)}
    onLostPointerCapture={() => setDragging(false)}
    onPointerUp={event => { setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} />
}
