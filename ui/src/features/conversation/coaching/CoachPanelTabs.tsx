import { useI18n } from '../../../components/localization/i18n'

export function CoachPanelTabs({ tab, onTab, onCollapse }: {
  tab: 'coaching' | 'evidence'
  onTab: (tab: 'coaching' | 'evidence') => void
  onCollapse?: () => void
}) {
  const tr = useI18n()
  return <div className="coach-heading">
    <div className="panel-tabs" role="tablist" aria-label={tr("Learning panel")}>
      <button type="button" role="tab" aria-selected={tab === 'coaching'} className={`panel-tab ${tab === 'coaching' ? 'active' : ''}`} onClick={() => onTab('coaching')}>{tr("Coach")}</button>
      <button type="button" role="tab" aria-selected={tab === 'evidence'} className={`panel-tab ${tab === 'evidence' ? 'active' : ''}`} onClick={() => onTab('evidence')}>{tr("Experience")}</button>
    </div>
    {onCollapse && <button type="button" className="coach-collapse" aria-label={tr("Close coach")} onClick={onCollapse}>›</button>}
  </div>
}
