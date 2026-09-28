import { HistoryGrid } from './HistoryGrid'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { HistoryWordPreview, type HoveredHistoryWord } from './HistoryWordPreview'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useI18n } from '../../components/localization/i18n'
import type { DrillAttemptView } from '../../generated/contracts'

/** How long a take's arrival lasts. Mirrors --dur-slow, which is what the step
 * itself uses. A timer rather than the animation's own end event, because under
 * reduced motion no animation runs and so no end event fires, and the mark still
 * has to clear or the next arrival would not move anything. */
const ARRIVAL_MS = 320

/** Every loaded take as one line of its target words, on columns all of them
 * share — newest first, the open one marked.
 *
 * The cells divide the width they are given with no minimum, so a phrase too
 * long to hold a letter compresses towards a ribbon instead of scrolling
 * sideways. A row is opened by clicking it and the whole word lives in the pairs
 * of the take expanded in place, so the strip never needs to be wider or more
 * legible than this. Hovering a cell names its word. */
export function AttemptRows({ attempts, selectedId, onSelect, rtl = false, arrivedId, onArrivalEnd, footerControls, renderDetails, hydratingId, reservationKey = "" }: {
  reservationKey?: string
  hydratingId?: string | null
  attempts: DrillAttemptView[]; selectedId?: string; onSelect?: (id: string) => void; rtl?: boolean
  arrivedId?: string | null; onArrivalEnd?: () => void; footerControls?: ReactNode; renderDetails?: (take: DrillAttemptView) => ReactNode
}) {
  const tr = useI18n()
  const mobile = useIsMobile()
  const [openId, setOpenId] = useState<string | null>(null)
  const detailsPrefix = useId()
  const [hovered, setHovered] = useState<HoveredHistoryWord | null>(null)
  useEffect(() => {
    if (!arrivedId) return
    const timer = setTimeout(() => onArrivalEnd?.(), ARRIVAL_MS)
    return () => clearTimeout(timer)
  }, [arrivedId, onArrivalEnd])
  if (attempts.length === 0 && !footerControls) return null
  const percent = (ratio: number | null) => ratio === null ? tr("—") : tr("{value0}%", { value0: String(Math.round(ratio * 100)) })
  const outcome = { same: tr("Matched"), substituted: tr("Uncertain"), missing: tr("Not matched"), extra: tr("extra") }
  const selected = selectedId ?? attempts[0]?.id

  return <>
    {hovered && <HistoryWordPreview value={hovered} onClose={() => setHovered(null)} />}
    {/* A take arriving moves the takes it displaces rather than replacing them. */}
    <HistoryGrid motionKey={`${reservationKey}:${attempts.map(take => take.id).join("|")}`} expandedId={mobile ? null : selected ?? null} arriving={!!arrivedId && !hydratingId}>
      {attempts.map(take => {
        const words = take.comparison.words.filter(word => word.kind !== 'extra')
        const scored = take.comparison.reliability?.accepted !== false
        // Use the measured result, without inventing pass/fail score cutoffs.
        const result = !scored || take.comparison.matchRatio === null ? 'uncertain'
          : take.comparison.matchRatio === 1 ? 'matched'
          : take.comparison.matchRatio === 0 ? 'unmatched' : 'uncertain'
        const arriving = take.id === arrivedId && take.id !== hydratingId
        const expanded = mobile ? take.id === openId : take.id === selected
        const detailsId = `${detailsPrefix}-${take.id}`
        return <div key={take.id} className={`drill-history-entry${arriving ? ' drill-take-arrival' : ''}`}
          data-history-id={take.id} data-result={result} data-expanded={expanded ? '' : undefined} data-arrival={arriving ? '' : undefined}>
        <button type="button" className="drill-word-row" hidden={expanded && !!renderDetails}
          data-arrival={arriving ? '' : undefined}
          aria-expanded={renderDetails ? expanded : undefined} aria-controls={renderDetails && expanded ? detailsId : undefined}
          aria-pressed={expanded} onClick={() => { setOpenId(take.id); onSelect?.(take.id) }}
          aria-label={tr("Attempt {value0}", { value0: String(take.sequence) })}>
          <span className="drill-word-row-number">#{String(take.sequence)}</span>
          <span className="drill-word-row-cells" dir={rtl ? 'rtl' : 'ltr'}
            style={{ gridTemplateColumns: `repeat(${Math.max(1, words.length)}, minmax(0, 1fr))`, columnGap: `min(var(--space-1), ${25 / Math.max(1, words.length)}%)` }}>
            {words.map((word, index) => <span key={index} className="drill-word-cell"
              data-outcome={scored ? word.kind : undefined}
              onMouseEnter={event => setHovered({ anchor: event.currentTarget, word: word.target ?? '', attempt: word.transcript, outcome: scored ? word.kind : undefined })}
              onMouseLeave={() => setHovered(null)}
              title={`${word.target ?? ''}: ${scored ? outcome[word.kind] : tr("Not scored")}`}>
              <bdi>{word.target}</bdi>
            </span>)}
          </span>
          <span className="drill-word-row-score">{scored ? percent(take.comparison.matchRatio) : tr("Not scored")}</span>
        </button>
        {expanded && renderDetails && <div className="drill-history-details" id={detailsId}>{take.id === hydratingId ? <div className="drill-inspection" aria-busy="true"><p role="status">{tr("Loading result…")}</p></div> : renderDetails(take)}{mobile && <button type="button" className="btn drill-history-collapse" aria-label={tr("Close")} onClick={() => setOpenId(null)}>{tr("Close")}</button>}</div>}
        </div>
      })}
    </HistoryGrid>
    <div className="drill-history-footer">
    <p className="drill-word-legend">
      <span data-outcome="same">{outcome.same}</span>
      <span data-outcome="substituted">{outcome.substituted}</span>
      <span data-outcome="missing">{outcome.missing}</span>
    </p>
    {footerControls}
    </div>
  </>
}
