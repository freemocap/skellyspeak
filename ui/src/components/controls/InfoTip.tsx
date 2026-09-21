import { useI18n } from '../localization/i18n'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** A top-layer popover escapes scroll clipping and remains usable by touch/keyboard. */
export function InfoTip({ children }: { children: ReactNode }) {
  const tr = useI18n()
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const shown = useRef(false)
  const pinned = useRef(false)
  const close = () => { pinned.current = false; setOpen(false) }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node) && !tip.current?.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const id = useId()
  useLayoutEffect(() => {
    const element = tip.current!
    if (!open) { if (shown.current) element.hidePopover(); shown.current = false; return }
    const rect = anchor.current!.getBoundingClientRect()
    element.showPopover()
    shown.current = true
    const width = element.getBoundingClientRect().width
    element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`
    const height = element.getBoundingClientRect().height
    element.style.top = `${Math.max(8, rect.bottom + height + 8 > window.innerHeight ? rect.top - height - 4 : rect.bottom + 4)}px`
  }, [open])
  return <span className="info-tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned.current) setOpen(false) }}>
    <button ref={anchor} type="button" aria-label={tr("Information")} aria-describedby={open ? id : undefined} aria-expanded={open} onFocus={() => setOpen(true)} onBlur={event => { if (!tip.current?.contains(event.relatedTarget as Node)) close() }} onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current) }} onKeyDown={event => { if (event.key === 'Escape') close() }}>ⓘ</button>
    <span ref={tip} id={id} className="info-tip-content" role="tooltip" popover="manual">{children}</span>
  </span>
}
