import { useCallback, useState } from 'react'

// A resizable boundary. Every place two things meet in the observability
// view uses this: the inspector's left edge, the split between pane columns,
// and each pane's bottom edge.
//
// Pointer events (not mouse) so trackpad, pen and touch behave identically.
// The value persists per key, so a layout you arranged survives a reload.

export type Axis = 'x' | 'y'

export function useDragSize(
  key: string,
  fallback: number,
  opts: { axis: Axis; min: number; max: number; invert?: boolean }
) {
  const { axis, min, max, invert } = opts

  const [size, setSize] = useState<number>(() => {
    const raw = Number(localStorage.getItem(key))
    return Number.isFinite(raw) && raw > 0 ? Math.min(max, Math.max(min, raw)) : fallback
  })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const start = axis === 'x' ? e.clientX : e.clientY
      const from = size
      let latest = from

      const move = (ev: PointerEvent) => {
        const now = axis === 'x' ? ev.clientX : ev.clientY
        const delta = invert ? start - now : now - start
        latest = Math.min(max, Math.max(min, from + delta))
        setSize(latest)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        try {
          localStorage.setItem(key, String(Math.round(latest)))
        } catch {
          /* non-fatal */
        }
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [axis, invert, key, max, min, size]
  )

  return { size, onPointerDown }
}
