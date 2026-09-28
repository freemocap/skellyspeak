import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useEffect, useState, type ReactNode } from 'react'
import { useWidthTier } from '../../components/layout/useWidthTier'
import { usePersistentToggle } from '../../components/persistence/usePersistentToggle'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import type { DrillAttemptView, DrillItemView } from '../../generated/contracts'

/** The same practice and history surfaces: side by side on desktop, stacked on
 * narrow screens. The cards sit in a side panel: beside the stage at full width
 * (folding to an edge tab), a drawer in the compact layout, a sheet in the
 * narrow one. The recording panel can be dragged taller at every width. Card
 * changes remain locked during capture. */
export function DrillLayout({ items, selectedId, locked, onSelect, rail, dock, report,
  children, onAddPhrases, reportResize, dockResize }: {
  items: DrillItemView[]; selectedId: string | null; locked: boolean; onSelect: (id: string) => void
  attempt: DrillAttemptView | null; rtl: boolean; rail: ReactNode; dock: ReactNode; report: ReactNode
  children: ReactNode; queue?: ReactNode; onAddPhrases?: () => void; reportResize?: ReactNode; dockResize?: ReactNode
}) {
  const tier = useWidthTier()
  const mobile = tier !== 'full'
  const tr = useI18n()
  const [sheet, setSheet] = useState<'phrases' | 'actions' | null>(null)
  const { open: cardsOpen, toggle: toggleCards } = usePersistentToggle('skellyspeak_cards', true)
  useEffect(() => { setSheet(null) }, [selectedId, mobile])
  const index = items.findIndex(item => item.id === selectedId)
  const addTargets = onAddPhrases && <button type="button" className="btn" disabled={locked} aria-haspopup="dialog" onClick={() => { setSheet(null); onAddPhrases() }}>{tr("Add practice cards…")}</button>
  const random = <button className="btn" type="button" disabled={locked || items.length < 2} onClick={() => {
    const choices = items.filter(item => item.id !== selectedId)
    onSelect(choices[Math.floor(Math.random() * choices.length)].id)
  }}>{tr('Random card')}</button>
  const navigation = <nav className="drill-phrase-bar" aria-label={tr('Practice cards')}>
    {/* At full width this folds the cards panel; elsewhere it opens the cards as a drawer or sheet. */}
    <button className="btn" type="button" aria-haspopup={mobile ? 'dialog' : undefined} aria-expanded={mobile ? sheet === 'phrases' : cardsOpen}
      onClick={() => { if (mobile) setSheet(sheet === 'phrases' ? null : 'phrases'); else toggleCards() }} aria-label={mobile ? tr('Practice cards') : undefined}>{mobile ? tr('Card') : tr('Practice cards')} {index + 1} / {items.length}</button>
    <button className="btn" type="button" aria-label={tr('Previous card')} disabled={locked || index <= 0}
      onClick={() => onSelect(items[index - 1].id)}>{tr('Previous')}</button>
    <button className="btn" type="button" aria-label={tr('Next card')} disabled={locked || index < 0 || index >= items.length - 1}
      onClick={() => onSelect(items[index + 1].id)}>{tr('Next')}</button>
    {mobile ? <button type="button" className="btn" aria-label={tr('More')} aria-haspopup="dialog" aria-expanded={sheet === 'actions'} onClick={() => setSheet('actions')}><ToolbarIcon name="more" size={18} /></button> : random}
    {sheet === 'actions' && <DetailDialog title={tr('Practice cards')} capture="preserve" onClose={() => setSheet(null)}><div className="drill-actions" onClick={event => { if ((event.target as Element).closest('button:not(:disabled)')) setSheet(null) }}>{random}{addTargets}</div></DetailDialog>}
    {sheet === 'phrases' && <DetailDialog capture="preserve" title={tr('Practice cards')} placement={tier === 'narrow' ? 'bottom' : 'start'} className="drill-cards-dialog" onClose={() => setSheet(null)}>
      <div onClick={event => { if ((event.target as Element).closest('.drill-item:not(:disabled)')) setSheet(null) }}>{rail}</div>
      {addTargets && <div className="drill-dropdown-actions">{addTargets}</div>}
    </DetailDialog>}
  </nav>
  if (!mobile) {
    // Until there is a card, the stage's own empty state offers Add cards.
    const cards = items.length === 0 ? null : cardsOpen
      ? <section className="drill-cards" aria-label={tr('Practice cards')}>
        <header className="drill-cards-head">
          <h2><ToolbarIcon name="cards" size={16} />{tr('Practice cards')}</h2>
          <button type="button" className="drill-cards-fold" aria-label={tr('Close {value0}', { value0: tr('Practice cards') })} onClick={toggleCards}><ToolbarIcon name="chevron" size={16} /></button>
        </header>
        {rail}
        {addTargets}
      </section>
      : <button type="button" className="drill-cards-edge" aria-label={tr('Practice cards')} aria-expanded={false} onClick={toggleCards}>
        <ToolbarIcon name="cards" size={16} /><span>{tr('Practice cards')}</span><span className="drill-cards-count">{index + 1}/{items.length}</span>
      </button>
    return <>{cards}<div className="drill-workspace">{navigation}{children}{dock && dockResize}{dock}</div>{reportResize}{report}</>
  }
  return <>
    <div className="drill-mobile-content">
      <div className="drill-workspace drill-workspace-stacked">{navigation}{children}</div>
      {report}
    </div>
    {dock && dockResize}
    {dock}
  </>
}
