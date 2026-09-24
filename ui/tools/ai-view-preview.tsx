/** AI View and live-status review using production components and sample data.
 * No native or AI calls: the operations below are shaped like a real snapshot
 * of turn_plan.rs PLAN, advanced by a timer. */
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useState } from 'react'
import type { AttemptStreamUpdate, TurnView } from '../src/generated/contracts'
import { turnActivity } from '../src/domain/conversation/activity-summary'
import { ActivityGraph } from '../src/features/activity/ActivityGraph'
import { OperationInspector } from '../src/features/activity/OperationInspector'
import { ExchangeTimeline } from '../src/features/activity/ExchangeTimeline'
import { ReplyStatus } from '../src/features/conversation/messages/ReplyStatus'
import { TranslationStatus } from '../src/components/reading/TranslationStatus'
import { TurnActivityLine } from '../src/features/conversation/messages/TurnActivityLine'
import { ActivitySummary } from '../src/components/feedback/ActivitySummary'
import '../src/styles/index.css'

const PLAN: [string, string[], string][] = [
  ['persona_context', [], 'local'], ['persona_reply', ['persona_context'], 'standard'], ['skill_assessment', ['persona_context'], 'fast'],
  ['coach_retry_check', ['persona_context'], 'standard'], ['user_word_gloss', ['persona_context'], 'standard'], ['user_translation', ['persona_context'], 'standard'],
  ['persona_word_gloss', ['persona_reply'], 'standard'], ['persona_speech', ['persona_reply'], 'speech'], ['reply_translation', ['persona_reply'], 'standard'],
  ['reply_explanations', ['persona_reply'], 'standard'], ['reply_assistance', ['persona_reply'], 'standard'], ['conversation_feedback', ['persona_reply'], 'standard'],
]
const TIMING: Record<string, [number, number]> = { persona_context: [0, 1], persona_reply: [1, 10], skill_assessment: [1, 5], coach_retry_check: [1, 3], user_word_gloss: [2, 6], user_translation: [2, 5], persona_word_gloss: [10, 14], persona_speech: [10, 16], reply_translation: [10, 13], reply_explanations: [10, 15], reply_assistance: [11, 14], conversation_feedback: [11, 16] }
const REPLY = '¡Qué bien! Entonces fuiste al mercado el sábado. ¿Qué compraste allí? Me encantan los mercados de fruta por la mañana.'
const origin = Date.parse('2026-09-18T10:00:00.000Z')

function snapshotAt(tick: number, id: string): TurnView {
  const at = (ticks: number) => new Date(origin + ticks * 450).toISOString()
  const operations = PLAN.map(([kind, dependencies, role]) => {
    const [start, end] = TIMING[kind]
    const state = tick < start ? (dependencies.length ? 'waiting_dependencies' : 'ready') : tick < end ? 'running' : 'succeeded'
    return { sourceMessageId: null, id: `${id}-${kind}`, kind, contractVersion: 1, dependencies: dependencies.map(dep => `${id}-${dep}`), role, state: kind === 'skill_assessment' && tick >= 1 && tick < 3 ? 'held' : state }
  })
  const attempts = PLAN.filter(([kind]) => tick >= TIMING[kind][0]).map(([kind]) => ({
    id: `${id}-${kind}-attempt`, operationId: `${id}-${kind}`, state: tick < TIMING[kind][1] ? 'running' : 'succeeded',
    requestedModel: 'google/gemini-2.5-flash', actualModel: tick < TIMING[kind][1] ? null : 'google/gemini-2.5-flash', providerId: null,
    startedAt: at(TIMING[kind][0]), finishedAt: tick < TIMING[kind][1] ? null : at(TIMING[kind][1]), inputTokens: 1200, outputTokens: 90, error: null, unpublishedText: null,
  }))
  return { replacesTurnId: null, replacedBy: null, route: 'hosted', id, state: tick < 10 ? 'pending' : tick < 16 ? 'assisting' : 'succeeded', paused: false, hold: null, operations, attempts }
}

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
      <ReplyStatus reply={{ state: tick < 10 ? 'pending' : 'unavailable', error: null, control: null }} activity={activity} stream={stream} />
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
