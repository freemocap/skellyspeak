import { useI18n } from '../../ui/i18n'
import { useIsMobile } from '../../ui/useIsMobile'
import { useNavigationStore } from '../../state/navigation'

/// Narrow-window navigation between the conversation and the learning panel.
export function MobileNav() {
  const tr = useI18n()
  const page = useNavigationStore((state) => state.page)
  const surface = useNavigationStore((state) => state.mobileSurface)
  const openPractice = useNavigationStore((state) => state.openPractice)
  const isMobile = useIsMobile()
  if (!isMobile) return null
  return (
    <nav className="mobile-nav" aria-label={tr("Main navigation")}>
      {(['chat', 'panel'] as const).map(item => <button key={item} type="button"
        className={`mobile-nav-item ${page === 'guided' && surface === item ? 'active' : ''}`}
        aria-current={page === 'guided' && surface === item ? 'page' : undefined}
        onClick={() => openPractice(item)}>{item === 'chat' ? tr("Chat") : tr("Coach")}</button>)}
    </nav>
  )
}
