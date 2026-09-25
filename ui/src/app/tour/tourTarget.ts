import { useEffect, useState } from 'react'

export interface TourTarget {
  element: Element
  rect: DOMRect
}

function visible(rect: DOMRect): boolean {
  return rect.width > 0 && rect.height > 0
}

/// The first selector with a currently visible match, searched under `root`
/// (a whole document for the full-size walk-through, or one demo page's own
/// container on the map, where several demos are mounted side by side).
export function findTourTarget(selectors: readonly string[], root: ParentNode): Element | null {
  for (const selector of selectors) {
    const candidate = root.querySelector(selector)
    if (candidate && visible(candidate.getBoundingClientRect())) return candidate
  }
  return null
}

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function sameTarget(current: TourTarget | null, element: Element | null): boolean {
  if (!element) return current === null
  if (!current || current.element !== element) return false
  return sameRect(current.rect, element.getBoundingClientRect())
}

/// Tracks a tour stop's target position under `root`. Polled rather than
/// observed: the demo pages are static once mounted, but polling needs no
/// per-selector observer wiring and the tour is only ever open briefly.
export function useTourTarget(selectors: readonly string[], root: ParentNode | null): TourTarget | null {
  const [target, setTarget] = useState<TourTarget | null>(null)
  useEffect(() => {
    if (!root) { setTarget(null); return }
    let frame = 0
    const tick = () => {
      const element = findTourTarget(selectors, root)
      setTarget(current => sameTarget(current, element) ? current : element ? { element, rect: element.getBoundingClientRect() } : null)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [selectors, root])
  return target
}

/// The same tracking, batched for every stop of one view at once — the map
/// shows all of a view's numbers over one mounted demo, which one hook per
/// stop cannot do without calling hooks in a loop.
export function useTourTargets(selectors: readonly string[], root: ParentNode | null): (TourTarget | null)[] {
  const [targets, setTargets] = useState<(TourTarget | null)[]>(() => selectors.map(() => null))
  useEffect(() => {
    if (!root) { setTargets(selectors.map(() => null)); return }
    let frame = 0
    const tick = () => {
      setTargets(current => {
        const next = selectors.map((selector, index) => {
          const element = findTourTarget([selector], root)
          return sameTarget(current[index] ?? null, element) ? current[index] : element ? { element, rect: element.getBoundingClientRect() } : null
        })
        return next.every((item, index) => item === current[index]) ? current : next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [selectors, root])
  return targets
}
