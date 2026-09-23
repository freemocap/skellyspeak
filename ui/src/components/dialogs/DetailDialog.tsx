import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'
import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from './useModalDialog'

export function DetailDialog({ title, children, onClose, size = 'standard', capture = 'suspend' }: { capture?: 'preserve' | 'suspend'; size?: 'standard' | 'wide'; title: string; children: ReactNode; onClose: () => void }) {
  const tr = useI18n()
  const modal = useModalDialog(onClose, capture)
  return createPortal(<dialog {...modal} className={size === 'wide' ? 'detail-dialog dialog-wide' : 'detail-dialog'} aria-label={title} onDoubleClick={event => event.stopPropagation()}><button className="detail-close" aria-label={tr("Close {value0}", { value0: String(title) })} onClick={onClose}><ToolbarIcon name="close" size={18} /></button>{children}</dialog>, document.body)
}
