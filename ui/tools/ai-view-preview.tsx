/** AI View and live-status review using production components and sample data.
 * No native or AI calls: the fixture's operations are shaped like a real
 * snapshot of turn_plan.rs PLAN, advanced by a timer. The phone's tray and full
 * screen are reviewed in context, in the conversation preview. */
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useState } from 'react'
import type { AttemptStreamUpdate } from '../src/generated/contracts'
import { turnActivity } from '../src/domain/conversation/activity-summary'
import { ActivityGraph } from '../src/features/activity/ActivityGraph'
import { OperationInspector } from '../src/features/activity/OperationInspector'
import { ExchangeTimeline } from '../src/features/activity/ExchangeTimeline'
import { ReplyStatus } from '../src/features/conversation/messages/ReplyStatus'
import { TranslationStatus } from '../src/components/reading/TranslationStatus'
import { TurnActivityLine } from '../src/features/conversation/messages/TurnActivityLine'
import { ActivitySummary } from '../src/components/feedback/ActivitySummary'
import { REPLY, origin, snapshotAt } from './ai-view-fixture'
import '../src/styles/index.css'

function Preview() {
  const [tick, setTick] = useState(4)
  const [kind, setKind] = useState<string | null>('persona_reply')
  useEffect(() => { const timer = setInterval(() => setTick(value => value >= 22 ? 0 : value + 1), 450); return () => clearInterval(timer) }, [])
  const turn = useMemo(() => snapshotAt(tick, 'live'), [tick])
  const older = useMemo(() => snapshotAt(99, 'older'), [])
  const words = REPLY.split(' ')
  const streamed = tick < 1 ? '' : words.slice(0, Math.max(1, Math.floor((Math.min(tick, 10) - 1) / 9 * words.length))).join(' ')
  const stream: AttemptStreamUpdate | null = tick >= 1 && tick < 10 ? { generation: 1, attemptId: 'live-persona_reply-attempt', conversationId: 'c', turnId: 'live', operationId: 'live-persona_reply', kind: 'persona_reply', seq: tick, text: streamed, terminal: null } : null
  const activity = turnActivity(turn, stream?.text ?? null)
  const operation = turn.operations.find(item => item.kind === kind) ?? turn.operations[1]
  const now = origin + tick * 450
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-8)', padding: 'var(--space-8)', background: 'var(--bg)', minHeight: '100dvh' }}>
    <section aria-label="Chat" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h2>Chat: live status and hydration</h2>
      <ReplyStatus reply={{ state: tick < 10 ? 'pending' : 'unavailable', error: null, control: null }} stream={stream} />
      {tick >= 10 && <div className="msg chat-message bot"><p>{REPLY}</p><TranslationStatus shown state={turn.operations.find(item => item.kind === 'reply_translation')!.state} /></div>}
      {tick >= 10 && <TurnActivityLine activity={activity} />}
      <h3>Failed mid-stream: the text stays</h3>
      <ReplyStatus reply={{ state: 'failed', error: 'Provider did not finish the reply normally. The reply was not saved to the conversation; the text that arrived is shown above.', control: 'retry' }} retainedText="¡Qué bien! Entonces fuiste al merc" onControl={async () => {}} />
      <h3>Held and waiting (still)</h3>
      <div className="msg chat-message bot"><p>Translation</p><TranslationStatus shown state="held" /><TranslationStatus shown state="waiting_dependencies" /></div>
      <ActivitySummary activity={turnActivity(older)} />
    </section>
    <section aria-label="AI View" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minHeight: 0 }}>
      <h2>AI View</h2>
      <div className="logs-panel" style={{ height: '70dvh' }}>
        <div className="ai-view" data-mode="expanded">
          <header className="ai-view-head"><h2 className="ai-view-title">AI activity</h2><ActivitySummary activity={activity} showLast={false} /></header>
          <div className="ai-view-body">
            <div className="ai-view-main">
              <ActivityGraph turn={turn} selectedKind={operation.kind} onSelect={setKind} now={now} />
              <ExchangeTimeline turn={turn} now={now} />
            </div>
            <OperationInspector turn={turn} operation={operation} turns={[turn, older]} now={now} onPickTurn={() => {}} onExpand={() => {}} />
          </div>
        </div>
      </div>
    </section>
  </div>
}

createRoot(document.getElementById('root')!).render(<Preview />)
