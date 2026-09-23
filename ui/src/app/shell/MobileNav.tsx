import { useI18n } from '../../components/localization/i18n'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { useNavigationStore } from '../../state/navigation/navigation'

/** Narrow windows show one workspace surface at a time. */
export function MobileNav() {
  const tr = useI18n()
  const drilling = useNavigationStore(state => state.practiceView === 'drill' && state.page === 'guided')
  const mode = useNavigationStore(state => state.mode)
  const surface = useNavigationStore(state => state.mobileSurface)
  const openPractice = useNavigationStore(state => state.openPractice)
  const isMobile = useIsMobile()
  if (!isMobile || drilling) return null
  return <nav className="mobile-nav" aria-label={tr("Main navigation")}>
    {(['chat', 'panel'] as const).map(item => <button key={item} type="button"
      className={`mobile-nav-item ${mode === 'practice' && surface === item ? 'active' : ''}`}
      aria-current={mode === 'practice' && surface === item ? 'page' : undefined}
      onClick={() => openPractice(item)}>{tr(item === 'chat' ? 'Chat' : 'Coach')}</button>)}
  </nav>
}
