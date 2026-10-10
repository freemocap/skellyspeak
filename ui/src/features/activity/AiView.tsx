import { WorkspaceGraphActivity } from './WorkspaceGraphActivity'
import { useExecutionPreferences } from '../../state/settings/useExecutionPreferences'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { AiExecutionSettings } from '../../components/controls/AiExecutionSettings'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TurnView } from '../../generated/contracts'
import { turnActivity } from '../../domain/conversation/activity-summary'
import { ActivitySummary } from '../../components/feedback/ActivitySummary'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { useI18n } from '../../components/localization/i18n'
import { getAiViewSelection, setAiViewSelection } from '../../platform/ipc/window'
import { nativeError } from '../../platform/ipc/workspace'
import { useConversationActivity } from './useConversationActivity'
import { NativeRunView } from './NativeRunView'

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

function turnLabel(turn: TurnView): string {
  return `${turn.channel ?? 'Graph'} · ${turn.nativeGraph?.run ?? turn.id}`
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
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const conversationId = snapshot?.conversationId ?? null

  // Restore the selected run when moving between windows.
  useEffect(() => {
    let cancelled = false
    getAiViewSelection().then(saved => {
      if (cancelled) return
      saved = useNavigationStore.getState().aiInspection ?? saved
      if (saved) {
        setSelection({ conversationId: saved.conversationId, turnId: saved.turnId, kind: saved.operationKind })
      }
      setSelectionLoaded(true)
    }).catch(error => { if (!cancelled) setSelectionError(nativeError(error)) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!inspection || !selectionLoaded) return
    setSelection({ conversationId: inspection.conversationId, turnId: inspection.turnId, kind: inspection.operationKind })
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
    }).catch(error => { if (current) setSelectionError(nativeError(error)) })
    return () => { current = false }
  }, [selectionLoaded, conversationId, selection])

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
  const summary = useMemo(() => turn ? turnActivity(turn, turn.nativePreview?.capture.text ?? null) : null, [turn])
  const pick = (turnId: string) => setSelection(current => ({ ...current, turnId }))
  const phone = mode === 'screen' || mode === 'tray'

  const renderHeader = () => (
    <header className="ai-view-head">
      <h2 className="ai-view-title">{tr('AI activity')}</h2>
      {summary && <ActivitySummary activity={summary} showLast={false} />}
      <AiExecutionSettings {...executionPreferences} />
      <div className="ai-view-spacer" />
      {mode !== 'tray' && <div className="ai-exchanges" role="group" aria-label={tr('Exchanges')}>
        <button type="button" className="ai-chip" aria-pressed={following} onClick={() => setSelection(current => ({ ...current, turnId: null }))} title={tr('Follow the newest exchange')}>{tr('Follow live')}</button>
        {turns.map(item => {
          const nativeStates = item.nativeGraph ? Object.values(item.nativeGraph.nodes) : null
          const failed = nativeStates?.some(state => state === 'Failed' || state === 'Unknown')
          const busy = nativeStates?.includes('Running')
          return <button key={item.id} type="button" className="ai-chip" title={turnLabel(item)} aria-pressed={!following && item.id === turn?.id} onClick={() => pick(item.id)}>
            {(failed || busy) && <span className="ai-node-dot" data-phase={busy ? 'running' : 'failed'} aria-hidden="true" />}
            {turnLabel(item)}
          </button>
        })}
        {activity.hasOlder && <button type="button" className="ai-chip" disabled={activity.loadingOlder} onClick={activity.loadOlder}>{activity.loadingOlder ? tr('Loading…') : tr('Older')}</button>}
      </div>}
      <div className="ai-view-actions">{actions}</div>
    </header>
  )

  return <section className="ai-view" data-mode={mode} aria-label={tr('AI activity')}>
    {renderHeader()}
    {(activity.error || selectionError) && <ErrorNotice as="p" className="ai-error" error={selectionError || activity.error}>{selectionError || activity.error}</ErrorNotice>}
    {turn?.nativeGraph && conversationId
      ? <NativeRunView key={turn.id} conversationId={conversationId} turn={turn} selected={selection.kind} onSelect={kind => setSelection(current => ({ ...current, kind }))} down={phone} globallyPaused={snapshot?.connection.paused ?? false} />
      : <p className="ai-muted">{conversationId && !activity.error && !selectionError && (!selectionReady || (restoring && activity.hasOlder)) ? tr('Loading…') : tr('No recorded AI operations.')}</p>}
    {!phone && <details className="ai-other">
      <summary>{tr('Other AI activity')}</summary>
      {snapshot?.transcriptionAttempts.map(attempt => <details key={attempt.id}><summary>{attempt.model} · {attempt.state}</summary>{attempt.error && <p>{attempt.error}</p>}<ResponseDetails value={attempt.diagnostics} /></details>)}
      <WorkspaceGraphActivity />
    </details>}
  </section>
}
