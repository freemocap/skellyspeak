import { Fragment } from 'react'
import { NativeAttemptDetails } from './NativeAttemptDetails'
import type { AttemptPreview, DefinitionSnapshot, InspectionSnapshot } from '../../generated/graph-contracts'
import { InspectionContent } from './InspectionContent'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { useI18n } from '../../components/localization/i18n'

export function NativeInspector({ graph, selected, preview, response }: { graph: DefinitionSnapshot | InspectionSnapshot; selected: string | null; preview?: AttemptPreview; response?: unknown }) {
  const tr = useI18n()
  if (selected?.startsWith('input:') || selected?.startsWith('output:')) {
    const input = selected.startsWith('input:')
    const port = selected.slice(input ? 6 : 7)
    const definition = graph.artifact.definition
    const value = input ? definition.inputs[port] : { port: definition.outputs[port], binding: definition.results[port] }
    return <aside className="ai-inspector" aria-label={tr('Selected operation')}>
      <header className="ai-inspector-head"><h3>{port}</h3></header>
      <div className="ai-inspector-body"><ResponseDetails value={value} /></div>
    </aside>
  }
  const name = selected?.startsWith('node:') ? selected.slice(5) : Object.keys(graph.artifact.definition.nodes)[0]
  const node = graph.artifact.definition.nodes[name]
  if (!node) return null
  const operation = graph.artifact.operations[node.operation]
  const nodePreview = preview && 'attempts' in graph && graph.attempts[name]?.some(attempt => attempt.id === preview.attempt) ? preview : undefined
  const nodeResponse = response && typeof response === 'object' && 'node' in response && response.node === name ? response : null
  return <aside className="ai-inspector" aria-label={tr('Selected operation')}>
    <header className="ai-inspector-head"><h3>{name}</h3></header>
    <div className="ai-inspector-body">
      <dl className="ai-facts">
        <dt>{tr('Contract')}</dt><dd>{operation.contract}</dd>
        <dt>{tr('Definition source')}</dt><dd>{operation.implementation}</dd>
        {'nodes' in graph && <><dt>{tr('State')}</dt><dd>{graph.nodes[name]}</dd></>}
      </dl>
      <h4 className="ai-section-title">{tr('Source')}</h4>
      <dl className="ai-facts">{Object.entries(node.inputs).map(([port, source]) => <Fragment key={port}>
        <dt>{port}</dt><dd>{'Output' in source ? `${source.Output.node}.${source.Output.port}` : 'Input' in source ? source.Input : JSON.stringify(source)}</dd>
      </Fragment>)}</dl>
      <ResponseDetails value={{ node, operation }} />
      {'attempts' in graph && <><h4>{tr('Attempts')}</h4><ResponseDetails value={{ attempts: graph.attempts[name], reasons: graph.reasons[name] }} /></>}
      {'attempts' in graph && <NativeAttemptDetails key={JSON.stringify([graph.engine, graph.run, name])} graph={graph} node={name} />}
      {nodePreview && <details><summary>{nodePreview.live ? tr('Response · streaming') : tr('Response')}</summary><InspectionContent text={nodePreview.capture.text} mode="readable" /></details>}
      {nodeResponse != null && <ResponseDetails value={nodeResponse} />}
    </div>
  </aside>
}
