import { useI18n } from '../../components/localization/i18n'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useNavigationStore } from '../../state/navigation/navigation'

/// Secondary destinations, available from the chrome at every window width.
export function MoreDialog() {
  const tr = useI18n()
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  const showOverlay = useNavigationStore((state) => state.showOverlay)
  const openSkills = useNavigationStore((state) => state.openSkills)
  const open = useNavigationStore((state) => state.overlay === 'more')
  if (!open) return null
  return (
    <DetailDialog title={tr("More")} onClose={closeOverlay}>
      <h2>{tr("More")}</h2>
      <div className="more-actions">
        <button className="btn" onClick={() => showOverlay('settings')}>{tr("Settings")}</button>
        <button className="btn" onClick={() => showOverlay('languages')}>{tr("Browse languages")}</button>
        <button className="btn" onClick={() => { closeOverlay(); openSkills() }}>{tr("Skill tree")}</button>
        <button className="btn" onClick={() => showOverlay('activity')}>{tr("AI activity & tools")}</button>
        <button className="btn" onClick={() => window.location.reload()}>{tr("Reload app")}</button>
      </div>
    </DetailDialog>
  )
}
