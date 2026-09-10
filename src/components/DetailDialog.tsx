import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayLayer } from '../hooks/useOverlayLayer'

export function DetailDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useOverlayLayer(dialog, onClose, false)
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return createPortal(<dialog ref={dialog} className="detail-dialog" aria-label={title} onDoubleClick={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose()
  }}><button className="detail-close" aria-label={`Close ${title}`} onClick={onClose}>Close ×</button>{children}</dialog>, document.body)
}
