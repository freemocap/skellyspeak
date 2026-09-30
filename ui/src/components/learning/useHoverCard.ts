import { useEffect, useRef, useState, type PointerEvent } from 'react'

const LEAVE_MS = 200

/** A card that a mouse opens by hovering and a touch opens by tapping. Pressing
 * the button while the card shows goes on to the full view, so a mouse click and
 * a second tap do the same thing. The short leave delay lets the pointer cross
 * the gap between the button and the card. */
export function useHoverCard(onExpand: () => void) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = () => clearTimeout(timer.current)
  useEffect(() => cancel, [])
  const mouse = (event: PointerEvent) => event.pointerType === 'mouse'
  return {
    open,
    close: () => { cancel(); setOpen(false) },
    anchor: {
      onPointerEnter: (event: PointerEvent) => { if (mouse(event)) { cancel(); setOpen(true) } },
      onPointerLeave: (event: PointerEvent) => { if (mouse(event)) { cancel(); timer.current = setTimeout(() => setOpen(false), LEAVE_MS) } },
    },
    press: () => { cancel(); if (open) { setOpen(false); onExpand() } else setOpen(true) },
  }
}
