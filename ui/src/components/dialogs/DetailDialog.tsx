import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'
import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from './useModalDialog'

/** A modal dialog with its own close control. `placement` shows a side panel
 * in the compact and narrow layouts: a drawer from the inline start, or a sheet
 * from the bottom. `className` names a content-specific variant. */
export function DetailDialog({ title, children, onClose, size = 'standard', capture = 'suspend', placement = 'center', className }: {
  capture?: 'preserve' | 'suspend'; size?: 'standard' | 'wide'; placement?: 'center' | 'start' | 'bottom'; className?: string
  title: string; children: ReactNode; onClose: () => void
}) {
  const tr = useI18n()
  const modal = useModalDialog(onClose, capture)
  const classes = ['detail-dialog', size === 'wide' && 'dialog-wide', placement === 'start' && 'dialog-drawer', placement === 'bottom' && 'dialog-sheet', className]
    .filter(Boolean).join(' ')
  return createPortal(<dialog {...modal} className={classes} aria-label={title} onDoubleClick={event => event.stopPropagation()}><button className="detail-close" aria-label={tr("Close {value0}", { value0: String(title) })} onClick={onClose}><ToolbarIcon name="close" size={18} /></button>{children}</dialog>, document.body)
}
