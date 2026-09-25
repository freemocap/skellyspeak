import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { TOUR_VIEWS, type TourViewId } from './tourStops'
import { useTourTarget } from './tourTarget'

const CALLOUT_WIDTH_PX = 340
const CALLOUT_MARGIN_PX = 12
// The callout's tallest real content (a stop with the chat cross-link button)
// is close to this; used only to keep it inside the visible area without a
// second render pass, the same way its width is assumed rather than measured.
const CALLOUT_MAX_HEIGHT_PX = 380

function ringStyle(rect: DOMRect): React.CSSProperties {
  return { left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }
}

/// Below the target when there is more room there than above it, otherwise
/// above; both axes are clamped to the visible demo area (`bounds`, which
/// excludes the fixed header) from an assumed maximum size rather than
/// measured, so positioning needs no second render pass. Without this a tall
/// target - one with little room on either side, such as a full-height rail -
/// could push the callout above the header and off-screen.
function calloutStyle(rect: DOMRect, bounds: DOMRect): React.CSSProperties {
  const left = Math.min(Math.max(rect.left, CALLOUT_MARGIN_PX), window.innerWidth - CALLOUT_WIDTH_PX - CALLOUT_MARGIN_PX)
  const roomBelow = bounds.bottom - rect.bottom, roomAbove = rect.top - bounds.top
  const top = roomBelow >= roomAbove
    ? Math.min(rect.bottom + CALLOUT_MARGIN_PX, bounds.bottom - CALLOUT_MARGIN_PX - CALLOUT_MAX_HEIGHT_PX)
    : rect.top - CALLOUT_MARGIN_PX - CALLOUT_MAX_HEIGHT_PX
  return { left, top: Math.max(top, bounds.top + CALLOUT_MARGIN_PX) }
}

export function TourSpotlight({ view, stopIndex, onBack, onNext, onFinish, onShowView }: {
  view: TourViewId
  stopIndex: number
  onBack: () => void
  onNext: () => void
  onFinish: () => void
  onShowView: (view: TourViewId) => void
}) {
  const tr = useI18n()
  const isMobile = useIsMobile()
  const spec = TOUR_VIEWS.find(item => item.id === view)
  if (!spec) throw new Error(`Unknown tour view: ${view}`)
  const stop = spec.stops[stopIndex]
  if (!stop) throw new Error(`Unknown tour stop: ${view}.${stopIndex}`)
  const [page, setPage] = useState<HTMLDivElement | null>(null)
  const target = useTourTarget([stop.selector], page)
  const first = stopIndex === 0
  const last = stopIndex === spec.stops.length - 1
  const nextView = TOUR_VIEWS[(TOUR_VIEWS.findIndex(item => item.id === view) + 1) % TOUR_VIEWS.length]
  const Demo = spec.Demo

  const body = <>
    <span className="tour-stepper">{spec.label(tr)} · {tr('{value0} of {value1}', { value0: stopIndex + 1, value1: spec.stops.length })}</span>
    <h2>{stop.title(tr)}</h2>
    <p>{stop.text(tr)}</p>
    {view === 'chat' && stop.key === 'progress' && <button type="button" className="md-term" onClick={() => onShowView('progress')}>{tr('Show the Progress view →')}</button>}
    {view === 'chat' && stop.key === 'ai' && <button type="button" className="md-term" onClick={() => onShowView('ai')}>{tr('Show the AI panel →')}</button>}
    <div className="tour-callout-actions">
      <button type="button" className="btn" onClick={onBack}>{first ? tr('Map') : tr('Back')}</button>
      <span className="tour-callout-spacer" />
      {last ? <>
        <button type="button" className="btn" onClick={() => onShowView(nextView.id)}>{tr('Next: {value0}', { value0: nextView.label(tr) })}</button>
        <button type="button" className="btn primary" onClick={onFinish}>{tr('Finish')}</button>
      </> : <button type="button" className="btn primary" onClick={onNext}>{tr('Continue')}</button>}
    </div>
  </>

  return <>
    <div className="tour-demo" aria-hidden="true" inert ref={setPage}><Demo /></div>
    {target && <span className="tour-ring" style={ringStyle(target.rect)} aria-hidden="true" />}
    <div className={isMobile ? 'tour-callout tour-callout-sheet' : 'tour-callout'}
      style={!isMobile && target && page ? calloutStyle(target.rect, page.getBoundingClientRect()) : undefined} role="group" aria-label={stop.title(tr)}>
      {body}
    </div>
  </>
}
