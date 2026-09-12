import { DetailDialog } from '../../ui/DetailDialog'

/// The narrow-window overflow menu: the destinations that do not fit in the
/// topbar as buttons.
export function MoreDialog({ onClose, onSkillTree, onActivity, onReload }: {
  onClose: () => void
  onSkillTree: () => void
  onActivity: () => void
  onReload: () => void
}) {
  return (
    <DetailDialog title="More" onClose={onClose}>
      <h2>More</h2>
      <div className="more-actions">
        <button className="btn" onClick={onSkillTree}>Skill tree</button>
        <button className="btn" onClick={onActivity}>AI activity &amp; tools</button>
        <button className="btn" onClick={onReload}>Reload app</button>
      </div>
    </DetailDialog>
  )
}
