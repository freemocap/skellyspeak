import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useModalDialog } from '../../components/dialogs/useModalDialog'
import { useOnboardingStore } from '../../state/settings/onboarding'
import { nativeError } from '../../platform/ipc/workspace'
import { TOUR_VIEWS, tourView, type TourViewId } from './tourStops'
import { TourMap } from './TourMap'
import { TourSpotlight } from './TourSpotlight'

type Screen = 'map' | TourViewId

/// Shown once after setup, and again from Settings: a map of the app, and a
/// walk through it stop by stop. Every screen is a demo page built from the
/// app's real components — never the learner's own, possibly empty, app, and
/// never a redrawing of it.
export function Tour() {
  const tr = useI18n()
  const busy = useOnboardingStore(state => state.busy)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<Screen>('map')
  const [stopIndex, setStopIndex] = useState(0)
  const close = () => {
    setError('')
    void useOnboardingStore.getState().showHelp(false).catch(reason => setError(nativeError(reason)))
  }
  const modal = useModalDialog(close, 'preserve')

  const showView = (view: TourViewId) => { setScreen(view); setStopIndex(0) }
  const stopCount = screen === 'map' ? 0 : tourView(screen).stops.length

  return createPortal(<dialog {...modal} className="tour-overlay" data-mode={screen === 'map' ? 'map' : 'spotlight'} aria-label={tr('App tour')}>
    <header className="tour-head">
      <nav className="panel-tabs" role="tablist" aria-label={tr('App tour')}>
        <button type="button" role="tab" aria-selected={screen === 'map'} className={`panel-tab ${screen === 'map' ? 'active' : ''}`} onClick={() => setScreen('map')}>{tr('Map')}</button>
        {TOUR_VIEWS.map(view => <button key={view.id} type="button" role="tab" aria-selected={screen === view.id} className={`panel-tab ${screen === view.id ? 'active' : ''}`} onClick={() => showView(view.id)}>{view.label(tr)}</button>)}
      </nav>
      <span className="tour-head-spacer" />
      <button type="button" className="tour-close" aria-label={tr('Close tour')} disabled={busy} onClick={close}><ToolbarIcon name="close" size={16} /></button>
    </header>
    {screen === 'map'
      ? <TourMap onSelectStop={(view, index) => { setScreen(view); setStopIndex(index) }} />
      : <TourSpotlight view={screen} stopIndex={Math.min(stopIndex, stopCount - 1)}
          onBack={() => stopIndex === 0 ? setScreen('map') : setStopIndex(stopIndex - 1)}
          onNext={() => setStopIndex(stopIndex + 1)}
          onFinish={close}
          onShowView={showView} />}
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
  </dialog>, document.body)
}
