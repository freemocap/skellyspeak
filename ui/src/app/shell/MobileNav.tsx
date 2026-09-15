import { useI18n } from '../../components/localization/i18n'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useNavigationStore } from '../../state/navigation/navigation'

/// Narrow-window navigation between the conversation and the learning panel.
export function MobileNav() {
  const tr = useI18n()
  const mode = useNavigationStore(state => state.mode)
  const setMode = useNavigationStore(state => state.setMode)
  const isMobile = useIsMobile()
  if (!isMobile) return null
  return (
    <nav className="mobile-nav" aria-label={tr("Main navigation")}>
      {(['practice', 'learn', 'review'] as const).map(item => <button key={item} data-mode={item} type="button"
        className={`mobile-nav-item ${mode === item ? 'active' : ''}`}
        aria-current={mode === item ? 'page' : undefined}
        onClick={() => setMode(item)}>{tr(item === 'practice' ? 'Practice' : item === 'learn' ? 'Learn' : 'Review')}</button>)}
    </nav>
  )
}
