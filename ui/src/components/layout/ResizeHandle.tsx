import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useI18n } from '../localization/i18n'

/** A pane size in CSS pixels, kept per browser profile. `null` means the pane's
 * own default. A stored value that is not a finite positive number is refused. */
export function useStoredSize(key: string): [number | null, (size: number | null) => void] {
  const storageKey = `skellyspeak_pane_${key}`
  const [size, setSize] = useState<number | null>(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) return null
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Stored pane size ${storageKey} is not a positive number: ${raw}`)
    return value
  })
  return [size, next => {
    setSize(next)
    if (next === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, String(Math.round(next)))
  }]
}

const STEP = 16

/** The divider between two panes. Drag it, or focus it and use the arrow keys;
 * Home and End go to the limits and a double click returns the default.
 *
 * `axis` is the direction the divider moves: `x` resizes widths, `y` heights.
 * `grow` says which way enlarges the controlled pane: +1 when it lies before
 * the divider (left, or above), -1 when it lies after it. Horizontal movement
 * follows the reading direction, so a right-to-left interface mirrors it. */
export function ResizeHandle({ label, axis, size, min, max, grow, measure, onResize }: {
  label: string
  axis: 'x' | 'y'
  size: number | null
  min: number
  max: number
  grow: 1 | -1
  /** The controlled pane's current rendered size, used when no size is stored yet. */
  measure: () => number
  onResize: (size: number | null) => void
}) {
  const tr = useI18n()
  const drag = useRef<{ pointer: number; start: number; sign: number } | null>(null)
  const clamp = (value: number) => Math.min(max, Math.max(min, value))
  const sign = (element: HTMLElement) => axis === 'x' && getComputedStyle(element).direction === 'rtl' ? -grow : grow

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointer: axis === 'x' ? event.clientX : event.clientY, start: size ?? measure(), sign: sign(event.currentTarget) }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const moved = (axis === 'x' ? event.clientX : event.clientY) - current.pointer
    onResize(clamp(current.start + moved * current.sign))
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = size ?? measure()
    const forward = sign(event.currentTarget)
    const keys: Record<string, number> = axis === 'x'
      ? { ArrowRight: base + STEP * forward, ArrowLeft: base - STEP * forward, Home: min, End: max }
      : { ArrowDown: base + STEP * forward, ArrowUp: base - STEP * forward, Home: min, End: max }
    const next = keys[event.key]
    if (next === undefined) return
    event.preventDefault()
    onResize(clamp(next))
  }

  return <div className="resize-handle" data-axis={axis} role="separator" tabIndex={0}
    aria-label={label} title={tr("Drag to resize; double-click to reset")}
    aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={size === null ? undefined : Math.round(size)}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    onDoubleClick={() => onResize(null)} onKeyDown={onKeyDown} />
}
