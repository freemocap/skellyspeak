import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { positionWordHelp, wordHelpLayer } from './word-help-layer'

/** Share word help's viewport placement and touch-safe layer, outside bubbles. */
export function MessageToolMenu({ anchor, id, direction, onClose, children }: {
  anchor: RefObject<HTMLButtonElement | null>
  id: string
  direction: 'ltr' | 'rtl'
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const layer = wordHelpLayer(anchor.current)
  useLayoutEffect(() => {
    const node = panel.current!, trigger = anchor.current!
    if (layer.popover) node.showPopover()
    const position = () => positionWordHelp(node, trigger)
    position()
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const observer = new ResizeObserver(position)
    observer.observe(node); observer.observe(trigger)
    const outside = (event: PointerEvent) => {
      if (!node.contains(event.target as Node) && !trigger.contains(event.target as Node)) onClose()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); trigger.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('scroll', position, true)
    window.addEventListener('resize', position)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('scroll', position, true)
      window.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      if (node.isConnected && layer.popover) node.hidePopover()
    }
  }, [anchor, layer.popover, onClose])
  return createPortal(<div ref={panel} id={id} dir={direction} className="message-tools-panel"
    popover={layer.popover ? 'manual' : undefined}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== anchor.current) onClose() }}>
    {children}
  </div>, layer.host)
}
