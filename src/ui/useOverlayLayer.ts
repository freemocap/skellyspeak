import { createContext, useContext, useEffect, useRef, type RefObject } from 'react'
import { openOverlay } from '../domain/input/back'

export const ActiveSurfaceContext = createContext(true)
const layers: symbol[] = []
export function useOverlayLayer(element: RefObject<HTMLElement | null>, onClose: () => void, outside: boolean) {
  const active = useContext(ActiveSurfaceContext)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => { if (!active) close.current() }, [active])
  useEffect(() => {
    const id = Symbol('overlay')
    const previous = document.activeElement
    layers.push(id)
    const top = () => layers.at(-1) === id
    const remove = openOverlay(() => close.current())
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && top()) { event.preventDefault(); event.stopImmediatePropagation(); close.current() }
    }
    const pointer = (event: PointerEvent) => {
      if (outside && top() && !element.current?.contains(event.target as Node) && !(event.target as Element).closest('[data-gloss-trigger]')) close.current()
    }
    document.addEventListener('keydown', key, true)
    document.addEventListener('pointerdown', pointer)
    return () => {
      const wasTop = top()
      layers.splice(layers.indexOf(id), 1)
      remove()
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('pointerdown', pointer)
      if (wasTop && previous instanceof HTMLElement && previous.isConnected && !previous.closest('[aria-hidden="true"]')) previous.focus()
    }
  }, [element, outside])
}
