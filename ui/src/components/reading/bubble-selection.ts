import type { HTMLAttributes } from 'react'

/** Bubble selection leaves embedded reading and toolbar controls independent. */
export function bubbleSelection(onSelect: (() => void) | undefined, selected: boolean, label: string): HTMLAttributes<HTMLDivElement> {
  if (!onSelect) return {}
  return {
    role: 'group', tabIndex: 0, 'aria-label': label, 'aria-current': selected ? 'true' : undefined,
    onClick: event => {
      const target = event.target as Element
      if (target.closest('button, a, input, select, textarea, [role="button"], [data-reading-tools], .message-tools, .saved-word-help')) return
      if (window.getSelection()?.toString()) return
      onSelect()
    },
    onKeyDown: event => {
      if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
      event.preventDefault(); onSelect()
    },
  }
}
