import { useI18n } from '../../../components/localization/i18n'
import { useState, type RefObject } from 'react'

/** Presentation-only split; never changes conversation or coaching state. */
export function PracticeDivider({ workspace }: { workspace: RefObject<HTMLDivElement | null> }) {
  const tr = useI18n()
  const [dragging, setDragging] = useState(false)
  const [share, setShare] = useState(() => Number.parseFloat(workspace.current?.style.getPropertyValue('--chat-share') || '50'))
  function resize(value: number) {
    const next = Math.min(70, Math.max(30, Math.round(value)))
    setShare(next)
    workspace.current?.style.setProperty('--chat-share', `${next}%`)
  }
  return <div className={dragging ? 'practice-divider dragging' : 'practice-divider'} role="separator" tabIndex={0}
    aria-label={tr("Conversation and coach width")} aria-orientation="vertical"
    aria-valuemin={30} aria-valuemax={70} aria-valuenow={share}
    onDoubleClick={() => resize(50)}
    onKeyDown={event => {
      const next = { ArrowLeft: share - 2, ArrowRight: share + 2, Home: 30, End: 70 }[event.key]
      if (next !== undefined) { event.preventDefault(); resize(next) }
    }}
    onPointerDown={event => { if (event.button === 0) { setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() } }}
    onPointerMove={event => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      const box = workspace.current?.getBoundingClientRect()
      if (box?.width) resize((event.clientX - box.left) / box.width * 100)
    }}
    onPointerCancel={() => setDragging(false)}
    onLostPointerCapture={() => setDragging(false)}
    onPointerUp={event => { setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} />
}
