import { suspendCapture } from '../../platform/audio/speech'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useOverlayLayer } from './useOverlayLayer'

export function DetailDialog({ title, children, onClose, size = 'standard' }: { size?: 'standard' | 'wide'; title: string; children: ReactNode; onClose: () => void }) {
  const tr = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  useOverlayLayer(dialog, onClose, false)
  useEffect(() => {
    suspendCapture()
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return createPortal(<dialog ref={dialog} className={size === 'wide' ? 'detail-dialog dialog-wide' : 'detail-dialog'} aria-label={title} onDoubleClick={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) onClose()
  }}><button className="detail-close" aria-label={tr("Close {value0}", { value0: String(title) })} onClick={onClose}><ToolbarIcon name="close" size={18} /></button>{children}</dialog>, document.body)
}
