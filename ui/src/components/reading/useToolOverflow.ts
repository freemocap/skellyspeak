import { useLayoutEffect, useRef, useState } from 'react'

/** Fit tools to their container: the icons are one size, but touch targets and
 * the set of tools change, so the row is measured rather than counted. */
export function useToolOverflow(count: number, keys: string) {
  const root = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(count)
  useLayoutEffect(() => {
    const row = root.current, sizing = measure.current
    if (!row || !sizing) return
    const update = () => {
      const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
      const fixed = row.querySelector<HTMLElement>('.message-tools-primary')!
      const actions = row.querySelector<HTMLElement>('.message-tools-fixed')!
      const more = sizing.querySelector<HTMLElement>('.message-tools-more')!
      const tools = [...sizing.querySelectorAll<HTMLElement>('[data-measured-tool]')]
      // Border-box layout widths retain fractions without the entrance transform.
      const layoutWidth = (element: HTMLElement) => Number.parseFloat(getComputedStyle(element).width) || element.offsetWidth
      const base = layoutWidth(fixed) + layoutWidth(actions) + gap
      const widths = tools.map(tool => layoutWidth(tool) + gap)
      // Let short bubbles grow to fit their tools before deciding what overflows.
      // The stylesheet caps this preferred width at the available content width.
      row.style.inlineSize = `${Math.ceil(base + widths.reduce((sum, value) => sum + value, 0))}px`
      const width = row.clientWidth
      if (!width) return
      let n = count
      if (base + widths.reduce((sum, value) => sum + value, 0) > width) {
        const actionGap = Number.parseFloat(getComputedStyle(actions.parentElement!).columnGap) || 0
        let available = width - base - layoutWidth(more) - actionGap
        n = 0
        for (const needed of widths) { if (needed > available) break; available -= needed; n++ }
      }
      setVisible(n)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row); observer.observe(sizing)
    observer.observe(row.querySelector('.message-tools-primary')!)
    observer.observe(row.querySelector('.message-tools-fixed')!)
    for (const child of sizing.children) observer.observe(child)
    let mounted = true
    void document.fonts?.ready.then(() => { if (mounted) update() })
    return () => { mounted = false; observer.disconnect() }
  }, [count, keys])
  return { root, measure, visible: Math.min(visible, count) }
}
