import type { MobileLocation } from '../../features/guided/GuidedPage'

/// Narrow-window navigation between the conversation and the learning panel.
export function MobileNav({ active, surface, onSurface }: {
  active: boolean
  surface: MobileLocation
  onSurface: (surface: MobileLocation) => void
}) {
  return (
    <nav className="mobile-nav" aria-label="Main navigation">
      {(['chat', 'panel'] as const).map(item => <button key={item} type="button"
        className={`mobile-nav-item ${active && surface === item ? 'active' : ''}`}
        aria-current={active && surface === item ? 'page' : undefined}
        onClick={() => onSurface(item)}>{item === 'chat' ? 'Chat · Persona' : 'Coach'}</button>)}
    </nav>
  )
}
