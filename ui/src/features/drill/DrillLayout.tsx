import { useOverlayLayer } from '../../components/dialogs/useOverlayLayer'
import { useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useModalDialog } from '../../components/dialogs/useModalDialog'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import type { DrillAttemptView, DrillItemView } from '../../generated/contracts'
import { ReadingScopeContext } from '../../components/reading/ReadingContext'
import { ReadingLanguageScope } from '../../components/reading/ReadingLanguageScope'
import { WordPairs } from './WordPairs'
import { facts, match } from './AttemptLog'

/** A responsive arrangement of the same practice/report components. Opening a
 * report does not suspend listening; phrase changes remain locked during capture. */
export function DrillLayout({ items, selectedId, locked, onSelect, attempt, rtl, rail, dock, report,
  children, queue, onAddPhrases, reportResize, dockResize }: {
  items: DrillItemView[]; selectedId: string | null; locked: boolean; onSelect: (id: string) => void
  attempt: DrillAttemptView | null; rtl: boolean; rail: ReactNode; dock: ReactNode; report: ReactNode
  children: ReactNode; queue?: ReactNode; onAddPhrases?: () => void; reportResize?: ReactNode; dockResize?: ReactNode
}) {
  const mobile = useIsMobile()
  const tr = useI18n()
  const [sheet, setSheet] = useState<'phrases' | 'report' | null>(null)
  useEffect(() => { setSheet(null) }, [selectedId, mobile])
  const index = items.findIndex(item => item.id === selectedId)
  const navigation = <nav className="drill-phrase-bar" aria-label={tr('Drill targets')}>
    <button className="btn" type="button" aria-haspopup="dialog" aria-expanded={sheet === 'phrases'}
      onClick={() => setSheet(sheet === 'phrases' ? null : 'phrases')}>{tr('Drill targets')} {index + 1} / {items.length}</button>
    <button className="btn" type="button" aria-label={tr('Previous drill target')} disabled={locked || index <= 0}
      onClick={() => onSelect(items[index - 1].id)}><span aria-hidden="true">‹</span></button>
    <button className="btn" type="button" aria-label={tr('Next drill target')} disabled={locked || index < 0 || index >= items.length - 1}
      onClick={() => onSelect(items[index + 1].id)}><span aria-hidden="true">›</span></button>
    <button className="btn" type="button" disabled={locked || items.length < 2} onClick={() => {
      const choices = items.filter(item => item.id !== selectedId)
      onSelect(choices[Math.floor(Math.random() * choices.length)].id)
    }}>{tr('Target')}</button>
    {onAddPhrases && <button type="button" className="btn" disabled={locked} aria-haspopup="dialog" onClick={() => { setSheet(null); onAddPhrases() }}>{tr("Add drill targets…")}</button>}
    {sheet === 'phrases' && <DrillDropdown title={tr('Drill targets')} onClose={() => setSheet(null)}>
      <div onClick={event => { if ((event.target as Element).closest('.drill-item:not(:disabled)')) setSheet(null) }}>{rail}</div>
    </DrillDropdown>}
  </nav>
  if (!mobile) return <><div className="drill-workspace">{navigation}{children}{dockResize}{dock}</div>{reportResize}{report}</>
  return <>
    {navigation}
    <div className="drill-mobile-content">
      {children}
      {queue}
      {attempt && <section className="drill-peek" aria-label={tr('Take {value0}', { value0: String(attempt.sequence) })}>
        <button type="button" className="drill-peek-open" aria-haspopup="dialog" onClick={() => setSheet('report')}>
          <strong>{tr('Take {value0}', { value0: String(attempt.sequence) })}</strong>
          <span className="drill-inspection-score">{match(attempt.comparison, tr)}</span>
          <span>{tr('Full report')}</span>
        </button>
        {facts(attempt.comparison, tr).map(fact => <span key={fact.label} className="drill-chip" data-tone={fact.tone}>{fact.label}</span>)}
        {attempt.comparison.reliability?.accepted === false ? <bdi>{attempt.transcript}</bdi> : <WordPairs words={attempt.comparison.words} rtl={rtl} />}
      </section>}
      {!attempt && report && <button className="btn" type="button" onClick={() => setSheet('report')}>{tr('Attempts')}</button>}
    </div>
    {dock}
    {sheet === 'report' && <DrillSheet title={tr('Full report')} onClose={() => setSheet(null)}>{report}</DrillSheet>}
  </>
}

function DrillSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const tr = useI18n()
  const modal = useModalDialog(onClose, 'preserve')
  const scope = useContext(ReadingScopeContext)
  return createPortal(<dialog className="drill-sheet" {...modal} aria-label={title}>
    <header className="drill-sheet-head"><h2>{title}</h2><button className="btn" type="button" autoFocus onClick={onClose} aria-label={tr('Close')}><ToolbarIcon name="close" size={18} /></button></header>
    <div className="drill-sheet-body">{scope ? <ReadingLanguageScope language={scope.language} variety={scope.variety}>{children}</ReadingLanguageScope> : children}</div>
  </dialog>, document.body)
}

function DrillDropdown({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const element = useRef<HTMLDivElement>(null)
  useOverlayLayer(element, onClose, true)
  useEffect(() => { element.current?.querySelector<HTMLElement>('input, button')?.focus() }, [])
  return <div ref={element} className="drill-dropdown" role="dialog" aria-label={title}>{children}</div>
}
