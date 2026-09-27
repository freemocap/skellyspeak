import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useEffect, useState, type ReactNode } from 'react'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import type { DrillAttemptView, DrillItemView } from '../../generated/contracts'

/** The same practice and history surfaces: side by side on desktop, stacked on
 * narrow screens. Target changes remain locked during capture. */
export function DrillLayout({ items, selectedId, locked, onSelect, rail, dock, report,
  children, onAddPhrases, reportResize, dockResize }: {
  items: DrillItemView[]; selectedId: string | null; locked: boolean; onSelect: (id: string) => void
  attempt: DrillAttemptView | null; rtl: boolean; rail: ReactNode; dock: ReactNode; report: ReactNode
  children: ReactNode; queue?: ReactNode; onAddPhrases?: () => void; reportResize?: ReactNode; dockResize?: ReactNode
}) {
  const mobile = useIsMobile()
  const tr = useI18n()
  const [sheet, setSheet] = useState<'phrases' | 'actions' | null>(null)
  useEffect(() => { setSheet(null) }, [selectedId, mobile])
  const index = items.findIndex(item => item.id === selectedId)
  const addTargets = onAddPhrases && <button type="button" className="btn" disabled={locked} aria-haspopup="dialog" onClick={() => { setSheet(null); onAddPhrases() }}>{tr("Add drill targets…")}</button>
  const actions = <>
    <button className="btn" type="button" disabled={locked || items.length < 2} onClick={() => {
      const choices = items.filter(item => item.id !== selectedId)
      onSelect(choices[Math.floor(Math.random() * choices.length)].id)
    }}>{tr('Random target')}</button>
    {addTargets}
  </>
  const navigation = <nav className="drill-phrase-bar" aria-label={tr('Drill targets')}>
    <button className="btn" type="button" aria-haspopup="dialog" aria-expanded={sheet === 'phrases'}
      onClick={() => setSheet(sheet === 'phrases' ? null : 'phrases')} aria-label={mobile ? tr('Drill targets') : undefined}>{mobile ? tr('Target') : tr('Drill targets')} {index + 1} / {items.length}</button>
    <button className="btn" type="button" aria-label={tr('Previous drill target')} disabled={locked || index <= 0}
      onClick={() => onSelect(items[index - 1].id)}>{tr('Previous')}</button>
    <button className="btn" type="button" aria-label={tr('Next drill target')} disabled={locked || index < 0 || index >= items.length - 1}
      onClick={() => onSelect(items[index + 1].id)}>{tr('Next')}</button>
    {mobile ? <button type="button" className="btn" aria-label={tr('More')} aria-haspopup="dialog" aria-expanded={sheet === 'actions'} onClick={() => setSheet('actions')}><ToolbarIcon name="more" size={18} /></button> : actions}
    {sheet === 'actions' && <DetailDialog title={tr('Drill targets')} capture="preserve" onClose={() => setSheet(null)}><div className="drill-actions" onClick={event => { if ((event.target as Element).closest('button:not(:disabled)')) setSheet(null) }}>{actions}</div></DetailDialog>}
    {sheet === 'phrases' && <DetailDialog capture="preserve" title={tr('Drill targets')} onClose={() => setSheet(null)}>
      <div onClick={event => { if ((event.target as Element).closest('.drill-item:not(:disabled)')) setSheet(null) }}>{rail}</div>
      {addTargets && <div className="drill-dropdown-actions">{addTargets}</div>}
    </DetailDialog>}
  </nav>
  if (!mobile) return <><div className="drill-workspace">{navigation}{children}{dockResize}{dock}</div>{reportResize}{report}</>
  return <>
    <div className="drill-mobile-content">
      <div className="drill-workspace drill-workspace-stacked">{navigation}{children}</div>
      {report}
    </div>
    {dock}
  </>
}
