import { useExecutionPreferences } from '../../state/settings/useExecutionPreferences'
import { bindRewardOrigin } from '../../platform/ipc/reward-origin'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { AiExecutionSettings } from '../../components/controls/AiExecutionSettings'
import { useNavigationStore } from '../../state/navigation/navigation'
import { ReadingActivity } from './ReadingActivity'
import { AiSplit } from './AiSplit'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AiDefinitionSelection, TurnView } from '../../generated/contracts'
import { operationPhase, turnActivity } from '../../domain/conversation/activity-summary'
import { ActivitySummary } from '../../components/feedback/ActivitySummary'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { useI18n } from '../../components/localization/i18n'
import { getAiViewSelection, setAiViewSelection } from '../../platform/ipc/window'
import { nativeError } from '../../platform/ipc/workspace'
import { useConversationActivity } from './useConversationActivity'
import { ActivityGraph } from './ActivityGraph'
import { NativeRunView } from './NativeRunView'
import { GraphDefinitions } from './GraphDefinitions'
import { OperationInspector } from './OperationInspector'
import { AttemptBodies } from './AttemptBodies'
import { latestAttempt } from '../../domain/conversation/activity-summary'
import { OperationDetailDialog } from './OperationDetailDialog'
import { ExchangeTimeline } from './ExchangeTimeline'
import { GenerationActivity } from './GenerationActivity'
import { useAttemptStreamSync, useReplyStream } from '../../state/session/attempt-streams'

/// The phone's views lead with the live graph, stacked down the screen so it
/// stays readable, with the tapped operation inspected beneath it. `screen`
/// fills the phone; `tray` sits above the recording panel under a single
/// header line, leaving exchanges to the full screen.
export type AiViewMode = 'docked' | 'expanded' | 'window' | 'screen' | 'tray'

interface Selection {
  conversationId: string | null
  /// Null follows the newest turn.
  turnId: string | null
  kind: string | null
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [active])
  return active ? now : Date.now()
}

function turnLabel(turn: TurnView, tr: ReturnType<typeof useI18n>): string {
  const started = turn.attempts.map(attempt => Date.parse(attempt.startedAt)).filter(Number.isFinite)
  return started.length ? tr.date(Math.min(...started), { timeStyle: 'medium' }) : tr('Not started')
}

/// A live view of the selected conversation's recorded AI operations.
export function AiView({ mode, actions }: { mode: AiViewMode; actions: ReactNode }) {
  const inspection = useNavigationStore(state => state.aiInspection)
  const executionPreferences = useExecutionPreferences()
  const tr = useI18n()
  const activity = useConversationActivity()
  const { snapshot, turns } = activity
  const [selection, setSelection] = useState<Selection>({ conversationId: null, turnId: null, kind: null })
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [inspectedAttempt, setInspectedAttempt] = useState<string | null>(null)
  const [definition, setDefinition] = useState<AiDefinitionSelection | undefined>()
  const lastDefinition = useRef<AiDefinitionSelection | undefined>(undefined)
  useEffect(() => { if (definition) lastDefinition.current = definition }, [definition])
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const conversationId = snapshot?.conversationId ?? null

  // Read the handoff once, even with an empty workspace. Definitions have no
  // conversation scope, and must survive both window moves and live selection.
  useEffect(() => {
    let cancelled = false
    getAiViewSelection().then(saved => {
      if (cancelled) return
      saved = useNavigationStore.getState().aiInspection ?? saved
      if (saved) {
        setSelection({ conversationId: saved.conversationId, turnId: saved.turnId, kind: saved.operationKind })
        setDefinition(saved.definition)
      }
      setSelectionLoaded(true)
    }).catch(error => { if (!cancelled) setSelectionError(nativeError(error)) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!inspection || !selectionLoaded) return
    setSelection({ conversationId: inspection.conversationId, turnId: inspection.turnId, kind: inspection.operationKind })
    setDefinition(undefined)
    useNavigationStore.setState({ aiInspection: null })
  }, [inspection, selectionLoaded])
  useEffect(() => {
    if (selectionLoaded && conversationId && selection.conversationId !== conversationId) {
      setSelection({ conversationId, turnId: null, kind: null })
    }
  }, [selectionLoaded, conversationId, selection.conversationId])
  useEffect(() => {
    if (!selectionLoaded || (conversationId && selection.conversationId !== conversationId)) return
    let current = true
    void setAiViewSelection({ conversationId: selection.conversationId, turnId: selection.turnId, operationKind: selection.kind,
      ...(definition ? { definition } : {}),
    }).catch(error => { if (current) setSelectionError(nativeError(error)) })
    return () => { current = false }
  }, [selectionLoaded, conversationId, selection, definition])

  const selectionReady = selectionLoaded && selection.conversationId === conversationId && conversationId !== null
  const pinned = selection.turnId ? turns.find(turn => turn.id === selection.turnId) : undefined
  // A saved selection can live beyond the snapshot's newest 50 turns. Page
  // until it is found; never silently display a different exchange meanwhile.
  const restoring = selectionReady && selection.turnId !== null && !pinned
  useEffect(() => {
    if (restoring && activity.hasOlder && !activity.loadingOlder && !activity.error) activity.loadOlder()
  }, [restoring, activity.hasOlder, activity.loadingOlder, activity.error, activity.loadOlder])
  const turn = !selectionReady ? undefined : selection.turnId ? pinned : turns[0]
  const following = selectionReady && selection.turnId === null
  const running = turn?.operations.some(operation => operationPhase(operation.state) === 'running') ?? false
  const now = useNow(running)
  const operation = turn?.operations.find(item => item.kind === selection.kind)
    ?? turn?.operations.find(item => operationPhase(item.state) === 'running')
    ?? turn?.operations[0]
  useAttemptStreamSync(conversationId)
  const replyText = useReplyStream(turn)?.text ?? null
  const summary = useMemo(() => turn ? turnActivity(turn, replyText) : null, [turn, replyText])
  const selectedAttempt = turn && operation ? latestAttempt(turn, operation.id) : null
  const pick = (turnId: string) => setSelection(current => ({ ...current, turnId: turnId === turns[0]?.id ? null : turnId }))
  const phone = mode === 'screen' || mode === 'tray'

  const renderHeader = (controls?: ReactNode) => (
    <header className="ai-view-head">
      <h2 className="ai-view-title">{tr('AI activity')}</h2>
      {!definition && summary && <ActivitySummary activity={summary} showLast={false} />}
      {/* Definitions are a graph to read at a desk; the phone keeps recorded runs. */}
      {!phone && <div role="group" aria-label={tr('AI activity view')}>
        <button type="button" className="ai-chip" aria-pressed={!definition} disabled={!selectionLoaded} onClick={() => setDefinition(undefined)}>{tr('Recorded runs')}</button>
        <button type="button" className="ai-chip" aria-pressed={!!definition} disabled={!selectionLoaded} onClick={() => setDefinition(current => current ?? lastDefinition.current ?? { graphId: '', operationKind: null })}>{tr('Graph definitions')}</button>
      </div>}
      {controls}
      <div className="ai-view-spacer" />
      {!definition && mode !== 'tray' && <div className="ai-exchanges" role="group" aria-label={tr('Exchanges')}>
        <button type="button" className="ai-chip" aria-pressed={following} onClick={() => setSelection(current => ({ ...current, turnId: null }))} title={tr('Follow the newest exchange')}>{tr('Follow live')}</button>
        {turns.map(item => {
          const failed = item.operations.some(op => ['failed', 'unknown'].includes(operationPhase(op.state) ?? ''))
          const busy = item.operations.some(op => operationPhase(op.state) === 'running')
          return <button key={item.id} type="button" className="ai-chip" aria-pressed={!following && item.id === turn?.id} onClick={() => pick(item.id)}>
            {(failed || busy) && <span className="ai-node-dot" data-phase={busy ? 'running' : 'failed'} aria-hidden="true" />}
            {turnLabel(item, tr)}
          </button>
        })}
        {activity.hasOlder && <button type="button" className="ai-chip" disabled={activity.loadingOlder} onClick={activity.loadOlder}>{activity.loadingOlder ? tr('Loading…') : tr('Older')}</button>}
      </div>}
      <div className="ai-view-actions">{actions}</div>
    </header>
  )

  return <section className="ai-view" data-mode={mode} aria-label={tr('AI activity')}>
    {!definition && renderHeader()}
    {!definition && <AiExecutionSettings {...executionPreferences} />}
    {(!definition && activity.error || selectionError) && <ErrorNotice as="p" className="ai-error" error={selectionError || activity.error}>{selectionError || activity.error}</ErrorNotice>}
    {definition ? <GraphDefinitions selection={definition} onSelect={setDefinition} renderHeader={renderHeader} /> : <>
    {turn?.nativeGraph && conversationId ? <NativeRunView key={turn.id} conversationId={conversationId} turn={turn} selected={selection.kind} onSelect={kind => setSelection(current => ({ ...current, kind }))} down={phone} globallyPaused={snapshot?.connection.paused ?? false} /> : <AiSplit inspector={turn && operation && <OperationInspector turn={turn} operation={operation} turns={turns} now={now} onPickTurn={pick} onExpand={() => { if (selectedAttempt) bindRewardOrigin(`inspection:${selectedAttempt.id}`); setInspectedAttempt(selectedAttempt?.id ?? null); setDetailOpen(true) }}>
        {selectedAttempt && <AttemptBodies attempt={selectedAttempt} deliberate={selectedAttempt.id === inspectedAttempt} />}
      </OperationInspector>}>
      <div className="ai-view-main">
        {turn ? <ActivityGraph turn={turn} orientation={phone ? 'down' : 'across'} follow={mode === 'tray'} selectedKind={operation?.kind ?? null} onSelect={kind => {
          setSelection(current => ({ ...current, kind }))
          const chosen = turn.operations.find(item => item.kind === kind)
          const attemptId = chosen ? latestAttempt(turn, chosen.id)?.id : null
          if (attemptId) bindRewardOrigin('inspection:' + attemptId)
          setInspectedAttempt(chosen ? latestAttempt(turn, chosen.id)?.id ?? null : null)
        }} now={now} />
          : <p className="ai-muted">{conversationId && !activity.error && !selectionError && (!selectionReady || (restoring && activity.hasOlder)) ? tr('Loading…') : tr('No recorded AI operations.')}</p>}
        {turn && !turn.nativeGraph && (mode === 'expanded' || mode === 'window') && <ExchangeTimeline turn={turn} now={now} />}
      </div>
    </AiSplit>}
        {!phone && <details className="ai-other">
          <summary>{tr('Other AI activity')}</summary>
          {snapshot?.transcriptionAttempts.map(attempt => <details key={attempt.id}><summary>{attempt.model} · {attempt.state}</summary>{attempt.error && <p>{attempt.error}</p>}<ResponseDetails value={attempt.diagnostics} /></details>)}
          <GenerationActivity /><ReadingActivity />
        </details>}
    {detailOpen && turn && operation && <OperationDetailDialog turn={turn} operation={operation} turns={turns} now={now} onPickTurn={pick} onClose={() => setDetailOpen(false)} />}
    </>}
  </section>
}
