import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { TurnView } from '../../generated/contracts'
import type { AttemptPreview, DefinitionSnapshot, InspectionSnapshot, RunHistory } from '../../generated/graph-contracts'
import { readGraphHistory } from '../../platform/ipc/window'
import { nativeError } from '../../platform/ipc/workspace'
import { useI18n } from '../../components/localization/i18n'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { AiSplit } from './AiSplit'
import { NativeGraph } from './NativeGraph'
import { NativeInspector } from './NativeInspector'
import { NativeRunControls } from './NativeRunControls'

type Selection = 'live' | 'structure' | InspectionSnapshot

/** Structure and recorded state use the same native artifact and renderer.
 * History reads return native snapshots; selecting one never executes a graph. */
export function NativeRunView({ conversationId, turn, selected, onSelect, down, globallyPaused }: {
  conversationId: string; turn: TurnView; selected: string | null; onSelect: (node: string) => void
  down: boolean; globallyPaused: boolean
}) {
  const loadHistory = useCallback((before: string | null) => readGraphHistory(conversationId, turn.nativeGraph!.run, before), [conversationId, turn.nativeGraph!.run])
  return <NativeGraphTimeline graph={turn.nativeGraph!} selected={selected} onSelect={onSelect} down={down} loadHistory={loadHistory}
    preview={turn.nativePreview} response={turn.nativeResponse} controls={<NativeRunControls turn={turn} globallyPaused={globallyPaused} />} />
}

export function NativeGraphTimeline({ graph, selected, onSelect, down, loadHistory, preview, response, controls }: {
  graph: InspectionSnapshot; selected: string | null; onSelect: (node: string) => void; down: boolean
  loadHistory: (before: string | null) => Promise<RunHistory>; preview?: AttemptPreview; response?: unknown; controls?: ReactNode
}) {
  const tr = useI18n()
  const [selection, setSelection] = useState<Selection>('live')
  const [history, setHistory] = useState<RunHistory | null>(null)
  const [before, setBefore] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [historyRequest, setHistoryRequest] = useState(0)
  // History is a deliberate read, never recomputed for every live node change.
  useEffect(() => {
    if (!historyRequest) return
    let current = true
    setLoading(true); setError(null)
    loadHistory(before).then(value => {
      if (!current) return
      if (value.engine !== graph.engine || value.run !== graph.run || value.frames.some(frame => frame.engine !== graph.engine || frame.run !== graph.run || frame.artifact_id !== graph.artifact_id)) {
        throw new Error('Graph history does not match the selected run.')
      }
      setHistory(value)
    }).catch(cause => { if (current) setError(nativeError(cause)) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [loadHistory, graph.engine, graph.run, graph.artifact_id, historyRequest, before])
  const live = selection === 'live'
  const shown: DefinitionSnapshot | InspectionSnapshot = selection === 'structure'
    ? { protocol: graph.protocol, artifact_id: graph.artifact_id, artifact: graph.artifact }
    : live ? graph : selection
  const chosen = typeof selection === 'string' ? selection : selection.revision
  const frames = history?.frames ?? []
  return <>
    <div className="ai-definition-toolbar">
      <label>{tr('Run timeline')} <select className="field" aria-label={tr('Run timeline')} value={chosen} onFocus={() => setHistoryRequest(value => value + 1)} onChange={event => {
        const value = event.target.value
        if (value === 'live' || value === 'structure') { setSelection(value); if (value === 'live') setBefore(null) }
        else { const frame = frames.find(item => item.revision === value); if (frame) setSelection(frame) }
      }}>
        <option value="structure">{tr('Graph structure')}</option>
        <option value="live">{tr('Follow live')}</option>
        {typeof selection !== 'string' && !frames.some(frame => frame.revision === selection.revision) && <option value={selection.revision}>{tr('Revision')} {selection.revision}</option>}
        {frames.map(frame => <option key={frame.revision} value={frame.revision}>{tr('Revision')} {frame.revision}</option>)}
      </select></label>
      {historyRequest > 0 && <button type="button" className="ai-chip" disabled={loading} onClick={() => setHistoryRequest(value => value + 1)}>{tr('Refresh')}</button>}
      {history?.before && <button type="button" className="ai-chip" disabled={loading} onClick={() => setBefore(history.before)}>{tr('Older')}</button>}
      {loading && <span>{tr('Loading…')}</span>}
      {live && controls}
    </div>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
    <AiSplit inspector={<NativeInspector graph={shown} selected={selected} preview={live ? preview : undefined} response={live ? response : undefined} />}>
      <div className="ai-view-main"><NativeGraph animate={live} graph={shown} selected={selected} down={down} onSelect={onSelect} /></div>
    </AiSplit>
  </>
}
