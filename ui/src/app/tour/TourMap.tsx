import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon, type ToolbarIconName } from '../../components/controls/ToolbarIcon'
import { TOUR_VIEWS, type TourView, type TourViewId } from './tourStops'
import { useTourTargets } from './tourTarget'
import { declutterPins } from './tourPinLayout'

const VIEW_ICONS: Record<TourViewId, ToolbarIconName> = { chat: 'chat', drill: 'cards', progress: 'star', ai: 'idea' }
// The size each demo is laid out at before the thumbnail scales it down, and
// the thumbnail's own on-screen size. Both are pixel geometry for a runtime
// CSS transform, not design tokens.
const NATURAL_WIDTH = 1180, NATURAL_HEIGHT = 760, THUMB_WIDTH = 320
// Stops whose targets sit closer together than this on the thumbnail get
// nudged apart, so a dense cluster of small controls (icons in a topbar or a
// message's action strip) never leaves one numbered pin hidden behind another.
const PIN_MIN_GAP = 20

function TourMapView({ view, onSelectStop }: { view: TourView; onSelectStop: (stopIndex: number) => void }) {
  const tr = useI18n()
  const [inner, setInner] = useState<HTMLDivElement | null>(null)
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null)
  const targets = useTourTargets(view.stops.map(stop => stop.selector), inner)
  const scale = THUMB_WIDTH / NATURAL_WIDTH
  const thumbHeight = NATURAL_HEIGHT * scale
  const wrapperRect = wrapper?.getBoundingClientRect()
  const Demo = view.Demo
  const pins = wrapperRect
    ? view.stops
      .map((stop, index) => { const target = targets[index]; return target ? { stop, index, left: target.rect.right - wrapperRect.left, top: target.rect.top - wrapperRect.top } : null })
      .filter(pin => pin !== null)
    : []
  const positions = declutterPins(pins, PIN_MIN_GAP)
  return <section className="tour-map-view" role="group" aria-label={view.label(tr)}>
    <h2><ToolbarIcon name={VIEW_ICONS[view.id]} size={18} />{view.label(tr)}</h2>
    <div className="tour-map-thumb" style={{ width: THUMB_WIDTH, height: thumbHeight }} ref={setWrapper}>
      <div className="tour-map-thumb-inner" aria-hidden="true" inert style={{ width: NATURAL_WIDTH, height: NATURAL_HEIGHT, transform: `scale(${scale})` }} ref={setInner}>
        <Demo />
      </div>
      {pins.map((pin, position) => <button key={pin.stop.key} type="button" className="tour-map-pin" style={{ left: positions[position].left, top: positions[position].top }}
        aria-label={tr('Stop {value0}: {value1}', { value0: pin.index + 1, value1: pin.stop.title(tr) })} title={pin.stop.title(tr)}
        onClick={() => onSelectStop(pin.index)}>{pin.index + 1}</button>)}
    </div>
  </section>
}

/// The whole tour at once: every view, as a small live render of its demo
/// page with each stop's real control marked. A number jumps straight to
/// that stop; Continue instead walks through every view in order.
export function TourMap({ onSelectStop }: { onSelectStop: (view: TourViewId, stopIndex: number) => void }) {
  const tr = useI18n()
  return <div className="tour-map">
    <p className="tour-map-intro">{tr('Select a number to go to that part, or Continue to go through in order.')}</p>
    <div className="tour-map-grid">
      {TOUR_VIEWS.map(view => <TourMapView key={view.id} view={view} onSelectStop={stopIndex => onSelectStop(view.id, stopIndex)} />)}
    </div>
    <div className="tour-map-actions">
      <button type="button" className="btn primary" onClick={() => onSelectStop('chat', 0)}>{tr('Continue')}</button>
    </div>
  </div>
}
