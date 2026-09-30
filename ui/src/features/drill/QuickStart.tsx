import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useI18n } from '../../components/localization/i18n'
import { messageKey } from '../../domain/localization'
import type { DrillGenerationPreview, ReadingScope } from '../../generated/contracts'
import { AddToPracticeHint } from './AddToPracticeHint'
import { PracticeSets } from './PracticeSets'

/** First-visit choices hand authored candidates to the regular phrase picker. */
export function QuickStart({ scope, showAgain, onShowAgain, onPreview, onClose }: {
  scope: ReadingScope
  showAgain: boolean
  onShowAgain: () => void
  onPreview: (preview: DrillGenerationPreview) => Promise<void>
  onClose: () => void
}) {
  const tr = useI18n()
  return (
    <DetailDialog title={tr("Add practice cards to get started")} size="wide" className="drill-starter" onClose={onClose}>
      <h2>{tr("Add practice cards to get started")}</h2>
      <PracticeSets key={JSON.stringify(scope)} scope={scope} layout="cards" onPreview={onPreview} />
      <AddToPracticeHint lead={<ToolbarIcon name="idea" size={16} />}
        message={messageKey("Tip: click {value0} on any phrase in the app to add it to your practice cards.")} />
      <div className="drill-starter-foot">
        <div className="check-row">
          <label className="check-label"><input type="checkbox" checked={!showAgain} onChange={onShowAgain} />{tr("Don’t show this again")}</label>
        </div>
        <button type="button" className="btn" onClick={onClose}>{tr("Close")}</button>
      </div>
    </DetailDialog>
  )
}
