import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { AiSplit } from './AiSplit'
import { InspectionContent, InspectionModeControl, type InspectionMode } from './InspectionContent'
import { useEffect, useState, type ReactNode } from 'react'
import type { AiDefinitionSelection, AiGraphDefinition, AiOperationDefinition } from '../../generated/contracts'
import { getAiGraphDefinitions } from '../../platform/ipc/window'
import { nativeError } from '../../platform/ipc/workspace'
import { humanizeKind } from '../../domain/conversation/activity-summary'
import { useI18n } from '../../components/localization/i18n'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { DefinitionGraph } from './ActivityGraph'

function DefinitionDetails({ graph, node, onSelect }: { graph: AiGraphDefinition; node: AiOperationDefinition; onSelect: (kind: string) => void }) {
  const tr = useI18n()
  const [mode, setMode] = useState<InspectionMode>('readable')
  const downstream = graph.operations.filter(item => item.dependencies.includes(node.kind))
  const links = (kinds: string[]) => kinds.map(kind => <button key={kind} type="button" className="ai-chip" onClick={() => onSelect(kind)}>{humanizeKind(kind)}</button>)
  return <div className="ai-inspector-body">
    <p>{node.description}</p>
    <dl className="ai-facts">
      <dt>{tr('Role')}</dt><dd>{node.role}</dd>
      <dt>{tr('Contract')}</dt><dd>{node.contractVersion === null ? '—' : `v${node.contractVersion}`}</dd>
      <dt>{tr('Depends on')}</dt><dd>{node.dependencies.length ? links(node.dependencies) : tr('Nothing (entry)')}</dd>
      <dt>{tr('Feeds')}</dt><dd>{downstream.length ? links(downstream.map(item => item.kind)) : '—'}</dd>
    </dl>
    <h4>{tr('Prompt templates')}</h4>
    <InspectionModeControl mode={mode} onChange={setMode} />
    {node.templates.length ? <>
      <p className="ai-muted">{tr('Placeholders are filled at runtime. These are definitions, not recorded requests.')}</p>
      {node.templates.map((template, index) => <details key={`${node.kind}:${template.label}`} className="ai-message" open={index === 0}>
        <summary>{template.label}</summary><InspectionContent text={template.text} mode={mode} />
      </details>)}
    </> : <p className="ai-muted">{tr('No chat prompt for this operation.')}</p>}
    {node.outputSchema != null && <details><summary>{tr('Output schema')}</summary><ResponseDetails value={node.outputSchema} /></details>}
    <details><summary>{tr('Definition source')}</summary><p className="ai-definition-source">{node.source}</p></details>
  </div>
}

/** Native blueprints are independent of selected conversation and live snapshots. */
export function GraphDefinitions({ selection, onSelect, renderHeader }: { selection: AiDefinitionSelection; onSelect: (selection: AiDefinitionSelection) => void; renderHeader: (controls: ReactNode) => ReactNode }) {
  const tr = useI18n()
  const [graphs, setGraphs] = useState<AiGraphDefinition[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [request, setRequest] = useState(0)
  useEffect(() => {
    let active = true
    setError(null)
    getAiGraphDefinitions().then(value => {
      if (!active) return
      if (!value.length) { setError(tr('No graph definitions available.')); return }
      setGraphs(value)
    }).catch(failure => { if (active) setError(nativeError(failure)) })
    return () => { active = false }
  }, [request, tr])
  const graph = graphs?.find(item => item.id === selection.graphId) ?? (selection.graphId ? undefined : graphs?.[0])
  const node = graph?.operations.find(item => item.kind === selection.operationKind) ?? graph?.operations[0]
  useEffect(() => {
    if (graph && !selection.graphId) onSelect({ graphId: graph.id, operationKind: node?.kind ?? null })
  }, [graph, node, selection.graphId, onSelect])
  const pick = (kind: string) => { if (graph) onSelect({ graphId: graph.id, operationKind: kind }) }
  const controls = <div className="ai-definition-toolbar">
      <label>{tr('Graph')} <select className="field" aria-label={tr('Graph')} value={graph?.id ?? ''} disabled={!graphs} onChange={event => { setExpanded(false); onSelect({ graphId: event.target.value, operationKind: null }) }}>
        {!graph && <option value="">{graphs ? tr('Choose a graph') : tr('Loading…')}</option>}
        {graphs?.map(item => <option key={item.id} value={item.id}>{humanizeKind(item.id)}</option>)}
      </select></label>
      {graph && <label>{tr('Operation')} <select className="field" aria-label={tr('Operation')} value={node?.kind ?? ''} onChange={event => pick(event.target.value)}>
        {graph.operations.map(item => <option key={item.kind} value={item.kind}>{humanizeKind(item.kind)}</option>)}
      </select></label>}
    </div>
  return <>
    {renderHeader(controls)}
    {error && <ErrorNotice as="p" error={error} className="ai-error">{error} <button type="button" className="btn" onClick={() => setRequest(value => value + 1)}>{tr('Retry')}</button></ErrorNotice>}
    {!graph && graphs && <p className="ai-error" role="alert">{tr('Choose a graph')}</p>}
    {graph && <AiSplit inspector={node && <aside className="ai-inspector" aria-label={tr('Selected operation')}>
        <header className="ai-inspector-head"><h3>{humanizeKind(node.kind)}</h3><button type="button" className="ai-chip" onClick={() => setExpanded(true)}>{tr('Expand')}</button></header>
        <DefinitionDetails graph={graph} node={node} onSelect={pick} />
      </aside>}>
      <div className="ai-view-main">
        <DefinitionGraph graph={graph} selectedKind={node?.kind ?? null} onSelect={pick} />
      </div>

    </AiSplit>}
    {expanded && graph && node && <DetailDialog size="wide" title={tr('Prompt templates')} onClose={() => setExpanded(false)}>
      <h2>{humanizeKind(node.kind)}</h2><DefinitionDetails graph={graph} node={node} onSelect={pick} />
    </DetailDialog>}
  </>
}
