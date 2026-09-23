import { useEffect, useRef } from 'react'
import { suspendCapture } from '../../platform/audio/speech'
import { useOverlayLayer } from './useOverlayLayer'

/** Shared native modality. Capture policy is explicit and independent of layout. */
export function useModalDialog(onClose: () => void, capture: 'preserve' | 'suspend') {
  const dialog = useRef<HTMLDialogElement>(null)
  useOverlayLayer(dialog, onClose, false)
  useEffect(() => {
    if (capture === 'suspend') suspendCapture()
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [capture])
  return {
    ref: dialog,
    onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => { event.preventDefault(); onClose() },
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    },
  }
}
