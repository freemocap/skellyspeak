import { useLayoutEffect, useRef, useState } from 'react'

/** Fit tools to their container, including translated labels and touch targets. */
export function useToolOverflow(count: number, labels: string) {
  const root = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(count)
  useLayoutEffect(() => {
    const row = root.current, sizing = measure.current
    if (!row || !sizing) return
    const update = () => {
      const width = row.clientWidth
      if (!width) return
      const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
      const fixed = row.querySelector<HTMLElement>('.message-tools-primary')!
      const actions = row.querySelector<HTMLElement>('.message-tools-fixed')!
      const more = sizing.querySelector<HTMLElement>('.message-tools-more')!
      const tools = [...sizing.querySelectorAll<HTMLElement>('[data-measured-tool]')]
      const base = fixed.getBoundingClientRect().width + actions.getBoundingClientRect().width + gap * 2
      const widths = tools.map(tool => tool.getBoundingClientRect().width + gap)
      let n = count
      if (base + widths.reduce((sum, value) => sum + value, 0) > width) {
        let available = width - base - more.getBoundingClientRect().width - gap
        n = 0
        for (const needed of widths) { if (needed > available) break; available -= needed; n++ }
      }
      setVisible(n)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row); observer.observe(sizing)
    for (const child of sizing.children) observer.observe(child)
    let mounted = true
    void document.fonts?.ready.then(() => { if (mounted) update() })
    return () => { mounted = false; observer.disconnect() }
  }, [count, labels])
  return { root, measure, visible: Math.min(visible, count) }
}
