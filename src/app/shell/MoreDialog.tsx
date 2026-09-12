import { DetailDialog } from '../../ui/DetailDialog'
import { useNavigationStore } from '../../state/navigation'

/// The narrow-window overflow menu: the destinations that do not fit in the
/// topbar as buttons.
export function MoreDialog() {
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const openSkills = useNavigationStore((state) => state.openSkills)
  const open = useNavigationStore((state) => state.overlay === 'more')
  if (!open) return null
  return (
    <DetailDialog title="More" onClose={closeOverlay}>
      <h2>More</h2>
      <div className="more-actions">
        <button className="btn" onClick={() => { closeOverlay(); openSkills() }}>Skill tree</button>
        <button className="btn" onClick={() => showOverlay('activity')}>AI activity &amp; tools</button>
        <button className="btn" onClick={() => window.location.reload()}>Reload app</button>
      </div>
    </DetailDialog>
  )
}
