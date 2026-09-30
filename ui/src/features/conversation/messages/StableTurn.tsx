import { useCallback, useLayoutEffect, useRef, type ComponentProps } from 'react'

/** Automatic hydration may grow a bubble, but must not collapse space already
 * allocated to it. Direct interaction and viewport resizing release this floor,
 * so the learner can still collapse aids and inspectors normally. */
export function StableTurn({ children, ...props }: ComponentProps<'div'>) {
  const root = useRef<HTMLDivElement>(null)
  const floors = useRef(new Map<string, { width: number; height: number }>())
  const measure = useCallback(() => {
    for (const bubble of root.current?.querySelectorAll<HTMLElement>('.learner-turn > .msg, .partner-turn > .msg') ?? []) {
      const side = bubble.classList.contains('me') ? 'me' : 'bot'
      const previous = floors.current.get(side)
      const width = bubble.getBoundingClientRect().width
      if (previous && previous.width !== width) bubble.style.minBlockSize = ''
      // Inspector geometry is explicitly controlled by the learner.
      if (bubble.classList.contains('inspecting')) {
        floors.current.delete(side); bubble.style.minBlockSize = ''; continue
      }
      const height = Math.max(bubble.getBoundingClientRect().height, previous?.width === width ? previous.height : 0)
      floors.current.set(side, { width, height })
      if (height && bubble.style.minBlockSize !== `${height}px`) bubble.style.minBlockSize = `${height}px`
    }
  }, [])
  useLayoutEffect(measure)
  useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    const resize = new ResizeObserver(measure)
    const observe = () => {
      resize.disconnect()
      resize.observe(node)
      for (const bubble of node.querySelectorAll('.msg.chat-message')) resize.observe(bubble)
      measure()
    }
    const mutations = new MutationObserver(observe)
    mutations.observe(node, { childList: true, subtree: true })
    observe()
    return () => { resize.disconnect(); mutations.disconnect() }
  }, [measure])
  const release = (event: { target: EventTarget | null }) => {
    const bubble = event.target instanceof Element ? event.target.closest<HTMLElement>('.msg.chat-message') : null
    if (!bubble) return
    floors.current.delete(bubble.classList.contains('me') ? 'me' : 'bot')
    bubble.style.minBlockSize = ''
  }
  return <div {...props} ref={root} onClickCapture={release} onKeyDownCapture={release}>{children}</div>
}
