import { useI18n } from '../../../components/localization/i18n'

export function CoachPanelTabs({ tab, onTab, onCollapse }: {
  tab: 'coaching' | 'skills'
  onTab: (tab: 'coaching' | 'skills') => void
  onCollapse?: () => void
}) {
  const tr = useI18n()
  return <div className="coach-heading">
    <div className="panel-tabs" role="tablist" aria-label={tr("Learning panel")}>
      <button type="button" role="tab" aria-selected={tab === 'coaching'} className={`panel-tab ${tab === 'coaching' ? 'active' : ''}`} onClick={() => onTab('coaching')}>{tr("Coach")}</button>
      <button type="button" role="tab" aria-selected={tab === 'skills'} className={`panel-tab ${tab === 'skills' ? 'active' : ''}`} onClick={() => onTab('skills')}>{tr("Skills")}</button>
    </div>
    {onCollapse && <button type="button" className="coach-collapse" aria-label={tr("Close coach")} onClick={onCollapse}>›</button>}
  </div>
}
