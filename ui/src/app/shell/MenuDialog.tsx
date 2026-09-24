import { useI18n } from '../../components/localization/i18n'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { LearningPicker } from '../../features/settings/language/LanguagePickers'
import { useNavigationStore } from '../../state/navigation/navigation'
import { PracticeSwitch } from './PracticeSwitch'

/// The phone menu: the language being learned and the practice mode, which the
/// phone top bar has no room for. Wider windows keep both in the top bar.
export function MenuDialog() {
  const tr = useI18n()
  const closeOverlay = useNavigationStore((state) => state.closeOverlay)
  const open = useNavigationStore((state) => state.overlay === 'menu')
  if (!open) return null
  return (
    <DetailDialog title={tr("Menu")} onClose={closeOverlay}>
      <h2>{tr("Menu")}</h2>
      <div className="menu-sections">
        <section className="menu-section" aria-label={tr("Target language")}>
          <h3>{tr("Target language")}</h3>
          <LearningPicker />
        </section>
        <section className="menu-section" aria-label={tr("Practice surface")}>
          <h3>{tr("Practice surface")}</h3>
          <PracticeSwitch />
        </section>
      </div>
    </DetailDialog>
  )
}
