import { useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { useI18n } from '../../../components/localization/i18n'

/** Independent coaching and private-chat scroll areas; the composer stays mounted. */
export type CoachChatLayoutHandle = { expand: () => void }

export function CoachChatLayout({ ref, content, thread, composer, notices, onExpand, hidden = false }: {
  ref?: Ref<CoachChatLayoutHandle>
  content: ReactNode; thread: ReactNode; composer: ReactNode; notices?: ReactNode; onExpand?: () => void; hidden?: boolean
}) {
  const tr = useI18n()
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const divider = useRef<HTMLDivElement>(null)
  const footer = useRef<HTMLDivElement>(null)
  // Start compact, including before the first saved snapshot arrives. A learner's
  // chosen height survives new messages and Coach / Experience tab switches.
  const [share, setShare] = useState(0)
  const previousShare = useRef(30)
  const [dragging, setDragging] = useState(false)
  const resize = (value: number) => {
    const next = Math.min(70, Math.max(0, Math.round(value)))
    if (next > 0) previousShare.current = next
    setShare(next)
    if (share === 0 && next > 0) requestAnimationFrame(() => onExpand?.())
  }
  useImperativeHandle(ref, () => ({ expand: () => { if (share === 0) resize(previousShare.current) } }))
  return <div ref={container} className="study-coaching" hidden={hidden}>
    <div className="study-coaching-scroll" style={{ flex: `${100 - share} 1 0px` }}>{content}</div>
    <div ref={divider} className="coach-chat-divider">
      <div className={`coach-chat-resize${dragging ? ' dragging' : ''}`} role="separator" tabIndex={0}
        aria-label={tr('Coach chat height')} aria-orientation="horizontal" aria-controls={id}
        aria-valuemin={0} aria-valuemax={70} aria-valuenow={share}
        onKeyDown={event => {
          const next = { ArrowUp: share + 5, ArrowDown: share - 5, Home: 0, End: 70 }[event.key]
          if (next !== undefined) { event.preventDefault(); resize(next) }
          if (event.key === 'Enter') { event.preventDefault(); resize(share === 0 ? previousShare.current : 0) }
        }}
        onPointerDown={event => {
          if (event.button !== 0) return
          event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true); event.preventDefault()
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
          const box = container.current?.getBoundingClientRect()
          const footerHeight = footer.current?.getBoundingClientRect().height ?? 0
          const dividerHeight = divider.current?.getBoundingClientRect().height ?? 0
          const available = (box?.height ?? 0) - footerHeight - dividerHeight
          if (box && available > 0) resize((box.bottom - footerHeight - event.clientY - dividerHeight / 2) / available * 100)
        }}
        onPointerUp={event => {
          setDragging(false)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => setDragging(false)} onLostPointerCapture={() => setDragging(false)}><span aria-hidden="true" /></div>
      <button type="button" className="coach-chat-toggle" aria-controls={id} aria-expanded={share > 0}
        aria-label={tr(share === 0 ? 'Expand coach chat' : 'Minimize coach chat')}
        title={tr(share === 0 ? 'Expand coach chat' : 'Minimize coach chat')}
        onClick={() => resize(share === 0 ? previousShare.current : 0)}>{share === 0 ? '▴' : '▾'}</button>
    </div>
    <div id={id} className="coach-chat-history" hidden={share === 0} style={{ flex: `${share} 1 0px` }}>{thread}</div>
    <div ref={footer} className="coach-chat-footer">{notices}{composer}</div>
  </div>
}
