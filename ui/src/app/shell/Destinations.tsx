import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useNavigationStore } from '../../state/navigation/navigation'

/** Practice and Skills: the two places to visit from the conversation, at the
 * end of the top bar. The conversation is home and has no button of its own —
 * the wordmark and each destination's return strip lead back to it. Each
 * destination's icon carries its identity colour; the open one reads as a
 * pressed control. Labels fold away only in the narrow layout. */
export function Destinations() {
  const tr = useI18n()
  const current = useNavigationStore(state => state.page === 'skills' ? 'skills' : state.practiceView === 'drill' ? 'practice' : null)
  const setPracticeView = useNavigationStore(state => state.setPracticeView)
  const openSkills = useNavigationStore(state => state.openSkills)
  return <nav className="destinations" aria-label={tr('Main navigation')}>
    <button type="button" className="destination" data-place="practice" aria-current={current === 'practice' ? 'page' : undefined} onClick={() => setPracticeView('drill')}>
      <ToolbarIcon name="practice" /><span>{tr('Practice')}</span>
    </button>
    <button type="button" className="destination" data-place="skills" aria-current={current === 'skills' ? 'page' : undefined} onClick={openSkills}>
      <ToolbarIcon name="skills" /><span>{tr('Skills')}</span>
    </button>
  </nav>
}
