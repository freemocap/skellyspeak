import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useState, type ReactNode } from 'react'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useI18n } from '../../components/localization/i18n'

/** Keep recent takes small on phones; the full report owns its modal space. */
export function MobileAttemptHistory({ preview, detail, children }: {
  preview: (openAttempt: (id: string) => void) => ReactNode
  detail: (id: string) => ReactNode
  children: ReactNode
}) {
  const mobile = useIsMobile()
  const tr = useI18n()
  const [open, setOpen] = useState<{ kind: 'history' } | { kind: 'attempt'; id: string } | null>(null)
  if (!mobile) return children
  return <section className="drill-history-preview" aria-label={tr('Attempts')}>
    <div className="drill-history-preview-rows">{preview(id => setOpen({ kind: 'attempt', id }))}</div>
    <button type="button" className="drill-history-expand" aria-label={tr('Attempts')} title={tr('Attempts')} aria-haspopup="dialog" onClick={() => setOpen({ kind: 'history' })}><ToolbarIcon name="expand" size={14} /></button>
    {open && <DetailDialog title={tr('Attempts')} size="wide" capture="preserve" onClose={() => setOpen(null)}>{open.kind === 'history' ? children : detail(open.id)}</DetailDialog>}
  </section>
}
