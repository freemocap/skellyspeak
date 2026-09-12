import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** A top-layer popover escapes scroll clipping and remains usable by touch/keyboard. */
export function InfoTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const shown = useRef(false)
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
  return <span className="info-tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button ref={anchor} type="button" aria-label="Information" aria-describedby={open ? id : undefined} aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>ⓘ</button>
    <span ref={tip} id={id} className="info-tip-content" role="tooltip" popover="manual">{children}</span>
  </span>
}
