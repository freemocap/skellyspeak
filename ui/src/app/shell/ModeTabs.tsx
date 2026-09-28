import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useNavigationStore } from '../../state/navigation/navigation'

/** Chat and Practice, the two places to work, as tabs at the top of the window
 * at every width: beside the top bar's controls at full width, in their own row
 * along the bar's lower edge in the compact and narrow layouts. Each tab carries
 * its place's identity colour, and the active one opens into its page. Choosing
 * Chat also closes the coach where it covers the conversation. */
export function ModeTabs() {
  const tr = useI18n()
  const current = useNavigationStore(state => state.page === 'guided' ? state.practiceView : null)
  const setPracticeView = useNavigationStore(state => state.setPracticeView)
  const openPractice = useNavigationStore(state => state.openPractice)
  return <nav className="mode-tabs mode-tabs-top" aria-label={tr('Main navigation')}>
    {(['chat', 'drill'] as const).map(view => <button key={view} type="button" className="mode-tab"
      data-place={view === 'chat' ? 'chat' : 'practice'} aria-current={current === view ? 'page' : undefined}
      onClick={() => { setPracticeView(view); if (view === 'chat') openPractice('chat') }}>
      <ToolbarIcon name={view === 'chat' ? 'chat' : 'cards'} size={18} />
      <span>{view === 'chat' ? tr('Chat') : tr('Practice')}</span>
    </button>)}
  </nav>
}
