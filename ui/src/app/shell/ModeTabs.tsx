import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useNavigationStore } from '../../state/navigation/navigation'

/** Chat and Practice, the two places to work: tabs at the top of the window at
 * full width, a tab bar at the bottom in the compact and narrow layouts. Each tab
 * carries its place's identity colour. Choosing Chat also closes the coach where
 * it covers the conversation. */
export function ModeTabs({ placement }: { placement: 'top' | 'bottom' }) {
  const tr = useI18n()
  const current = useNavigationStore(state => state.page === 'guided' ? state.practiceView : null)
  const setPracticeView = useNavigationStore(state => state.setPracticeView)
  const openPractice = useNavigationStore(state => state.openPractice)
  return <nav className={`mode-tabs mode-tabs-${placement}`} aria-label={tr('Main navigation')}>
    {(['chat', 'drill'] as const).map(view => <button key={view} type="button" className="mode-tab"
      data-place={view === 'chat' ? 'chat' : 'practice'} aria-current={current === view ? 'page' : undefined}
      onClick={() => { setPracticeView(view); if (view === 'chat') openPractice('chat') }}>
      <ToolbarIcon name={view === 'chat' ? 'chat' : 'cards'} size={placement === 'top' ? 18 : 20} />
      <span>{view === 'chat' ? tr('Chat') : tr('Practice')}</span>
    </button>)}
  </nav>
}
