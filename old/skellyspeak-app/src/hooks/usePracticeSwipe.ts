import { useRef, type MouseEvent, type TouchEvent } from 'react'

export function usePracticeSwipe(onSwipe: (direction: 'next' | 'previous') => void, enabled: boolean) {
  const suppressClickUntil = useRef(0)
  const start = useRef<{ x: number; y: number; at: number } | null>(null)
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      start.current = null
      suppressClickUntil.current = 0
      if (!enabled || event.touches.length !== 1) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [role="slider"], [contenteditable="true"], [data-no-swipe], dialog, [role="dialog"]')) return
      const touch = event.touches[0]
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return
      for (let node: HTMLElement | null = target; node && node !== event.currentTarget; node = node.parentElement) {
        if (node.scrollWidth > node.clientWidth && /auto|scroll/.test(getComputedStyle(node).overflowX)) return
      }
      start.current = { x: touch.clientX, y: touch.clientY, at: Date.now() }
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (event.detail !== 0 && Date.now() < suppressClickUntil.current) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    onTouchCancel() { start.current = null },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const origin = start.current
      start.current = null
      if (!enabled || !origin || event.changedTouches.length !== 1) return
      const dx = event.changedTouches[0].clientX - origin.x
      const dy = event.changedTouches[0].clientY - origin.y
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - origin.at > 700) return
      suppressClickUntil.current = Date.now() + 700
      onSwipe(dx < 0 ? 'next' : 'previous')
    },
  }
}
