import { useI18n } from '../../../components/localization/i18n'
import { ActivityGraph } from '../../../features/activity/ActivityGraph'
import { OperationInspector } from '../../../features/activity/OperationInspector'
import { ActivitySummary } from '../../../components/feedback/ActivitySummary'
import { turnActivity } from '../../../domain/conversation/activity-summary'
import { AI_NOW, AI_TURN } from './fixtures'

const noop = () => {}
const activity = turnActivity(AI_TURN, null)
const operation = AI_TURN.operations.find(item => item.kind === 'persona_reply')!

/// The AI panel's own shape: the activity graph and the request inspector,
/// filled with one finished, fixed turn. No AI request is ever made.
export function AiDemo() {
  const tr = useI18n()
  return <div className="demo-page">
    <section className="ai-view" data-mode="expanded" aria-label={tr('AI activity')}>
      <header className="ai-view-head"><h2 className="ai-view-title">{tr('AI activity')}</h2><ActivitySummary activity={activity} showLast={false} /></header>
      <div className="ai-view-body">
        <div className="ai-view-main">
          <ActivityGraph turn={AI_TURN} selectedKind={operation.kind} onSelect={noop} now={AI_NOW} />
        </div>
        <OperationInspector turn={AI_TURN} operation={operation} turns={[AI_TURN]} now={AI_NOW} onPickTurn={noop} onExpand={noop} />
      </div>
    </section>
  </div>
}
