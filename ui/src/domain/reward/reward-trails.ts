/** Time-shifted, empty outlines share the card's path and easing. */
export function animateRewardTrails(
  card: HTMLElement,
  frames: Keyframe[],
  timing: KeyframeAnimationOptions,
  cleanups: Set<() => void>,
): void {
  const bounds = card.getBoundingClientRect()
  const traces: { element: HTMLDivElement; animation: Animation }[] = []
  const stop = (): void => {
    for (const trace of traces) { trace.animation.cancel(); trace.element.remove() }
    cleanups.delete(stop)
  }
  cleanups.add(stop)
  let remaining = 8
  for (const direction of [-1, 1]) {
    for (let distance = 1; distance <= 4; distance++) {
      const trace = document.createElement('div')
      trace.className = 'reward-path-trace'
      trace.setAttribute('aria-hidden', 'true')
      Object.assign(trace.style, {
        left: card.style.left,
        top: card.style.top,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        zIndex: String(Number(card.style.zIndex) - 1),
      })
      const outline = document.createElement('div')
      outline.className = 'reward-path-outline'
      outline.style.transform = `scale(${1 - distance * .15})`
      trace.append(outline)
      document.body.append(trace)
      const opacity = .48 - distance * .075
      const path = frames.map((frame, index) => ({
        ...frame,
        opacity: index === 0 || index === frames.length - 1 ? 0 : Number(frame.opacity ?? 1) * opacity,
      }))
      const animation = trace.animate(path, { ...timing, delay: direction * distance * 55, fill: 'none' })
      traces.push({ element: trace, animation })
      animation.onfinish = () => {
        trace.remove()
        remaining--
        if (remaining === 0) cleanups.delete(stop)
      }
    }
  }
}
