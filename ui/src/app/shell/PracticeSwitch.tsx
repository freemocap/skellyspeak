import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useNavigationStore } from '../../state/navigation/navigation'

/** Chat and Drill are separate practice modes; this switch changes the whole surface. */
export function PracticeSwitch() {
  const tr = useI18n()
  const page = useNavigationStore((state) => state.page)
  const practiceSurface = useNavigationStore((state) => state.practiceView)
  const setPracticeView = useNavigationStore((state) => state.setPracticeView)
  return <div className="practice-switch" role="group" aria-label={tr("Practice surface")}>
    {(['chat', 'drill'] as const).map(view => (
      <button key={view} type="button" aria-pressed={practiceSurface === view && page === 'guided'}
        onClick={() => setPracticeView(view)}>
        <ToolbarIcon name={view === 'chat' ? 'chat' : 'cards'} size={18} /><span className="practice-switch-label">{view === 'chat' ? tr("Chat") : tr("Drill")}</span>
      </button>
    ))}
  </div>
}
