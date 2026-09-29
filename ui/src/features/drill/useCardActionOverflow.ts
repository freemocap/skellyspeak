import { useLayoutEffect, useRef, useState } from 'react'

/** Reserve card navigation, then expose as many optional actions as fit. */
export function useCardActionOverflow(count: number, labels: string) {
  const bar = useRef<HTMLElement>(null)
  const measure = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(count)
  useLayoutEffect(() => {
    const row = bar.current, sizing = measure.current
    if (!row || !sizing) return
    const update = () => {
      if (!row.clientWidth) return
      const style = getComputedStyle(row)
      const gap = Number.parseFloat(style.columnGap) || 0
      const available = row.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0)
      const fixed = sizing.querySelector<HTMLElement>('.drill-card-navigation')!.getBoundingClientRect().width
      const actions = [...sizing.querySelectorAll<HTMLElement>('[data-card-action]')].map(action => action.getBoundingClientRect().width + gap)
      if (fixed + actions.reduce((sum, width) => sum + width, 0) <= available) { setVisible(count); return }
      let remaining = available - fixed - sizing.querySelector<HTMLElement>('[data-card-more]')!.getBoundingClientRect().width - gap
      let fit = 0
      for (const width of actions) { if (width > remaining) break; remaining -= width; fit++ }
      setVisible(fit)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row)
    for (const child of sizing.children) observer.observe(child)
    let mounted = true
    void document.fonts?.ready.then(() => { if (mounted) update() })
    return () => { mounted = false; observer.disconnect() }
  }, [count, labels])
  return { bar, measure, visible: Math.min(visible, count) }
}
