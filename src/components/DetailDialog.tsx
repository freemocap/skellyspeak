import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { openOverlay } from '../lib/back'

export function DetailDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current!
    element.showModal()
    const remove = openOverlay(() => close.current())
    return () => { remove(); element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return createPortal(<dialog ref={dialog} className="detail-dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose()
  }}><button className="detail-close" aria-label={`Close ${title}`} onClick={onClose}>Close ×</button>{children}</dialog>, document.body)
}
