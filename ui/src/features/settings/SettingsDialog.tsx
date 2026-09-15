import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Native modality makes the background inert and contains keyboard focus. */
export function SettingsDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current!
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return createPortal(
    <dialog ref={ref} className="settings-dialog modal-backdrop" aria-label={title}
      onCancel={event => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        if (!(document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute('data-shortcut-capture'))) onClose()
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      {children}
    </dialog>, document.body,
  )
}
