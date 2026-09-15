/** Visible intersection accounts for each clipping ancestor, not just the viewport. */
export function visibleRewardRect(element: Element, scope: HTMLElement): DOMRect | null {
  if (!scope.contains(element) || !element.isConnected) return null
  let rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top)
  let right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom)
  for (let parent: Element | null = element; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    if (parent.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') return null
    if (parent !== element) {
      rect = parent.getBoundingClientRect()
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right) }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom) }
    }
  }
  return right > left && bottom > top ? new DOMRect(left, top, right - left, bottom - top) : null
}
export function rewardAnchor(scope: HTMLElement, kind: 'evidence' | 'message' | 'skill' | 'domain' | 'total', id: string): DOMRect | null {
  for (const element of scope.querySelectorAll(`[data-reward-${kind}]`)) {
    const identities: string[] = kind === 'evidence' ? JSON.parse(element.getAttribute(`data-reward-${kind}`)!) : [element.getAttribute(`data-reward-${kind}`)!]
    if (!identities.includes(id)) continue
    const rect = visibleRewardRect(element, scope)
    if (rect) return rect
  }
  return null
}
