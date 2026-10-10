/** Presentation fixture only: many boundary ports, production graph and inspector.
 * No IPC, providers, saved learner content, or alternative runtime semantics. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import type { InspectionSnapshot } from '../src/generated/graph-contracts'
import { NativeGraph } from '../src/features/activity/NativeGraph'
import { NativeInspector } from '../src/features/activity/NativeInspector'
import { AiSplit } from '../src/features/activity/AiSplit'
import { AiExecutionSettings } from '../src/components/controls/AiExecutionSettings'
import { PREVIEW_SETTINGS } from './preview-settings'
import '../src/styles/index.css'
const port = { contract: 'text@1', optional: false }
const inputs = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`captured_setting_${i + 1}`, port]))
const graph: InspectionSnapshot = {
  protocol: 1, engine: 'fixture', run: '1', revision: '8', artifact_id: 'presentation-fixture',
  artifact: { types: { 'text@1': 'Text' }, operations: {
    capture: { contract: 'capture', implementation: 'fixture/capture', inputs, outputs: { text: port }, resource: 'Local', reuse: 'Exact' },
    text: { contract: 'text', implementation: 'fixture/text', inputs: { text: port }, outputs: { text: port }, resource: 'Provider', reuse: 'Exact' },
  }, definition: { contract: 'fixture', compositions: {}, inputs, outputs: { text: port },
    nodes: {
      capture: { operation: 'capture', inputs: Object.fromEntries(Object.keys(inputs).map(name => [name, { Input: name }])), after: [], guard: null, activation: 'Automatic' },
      reply: { operation: 'text', inputs: { text: { Output: { node: 'capture', port: 'text' } } }, after: [], guard: null, activation: 'Automatic' },
      translation: { operation: 'text', inputs: { text: { Output: { node: 'reply', port: 'text' } } }, after: [], guard: null, activation: 'OnDemand' },
    }, results: { text: { Output: { node: 'reply', port: 'text' } } },
  } }, nodes: { capture: 'Adopted', reply: 'Running', translation: 'Unrequested' }, activation: {},
  paused: false, active: true, stepping: null, step_available: false, attempts: {}, reasons: {},
}
function Preview() {
  const [selected, select] = useState<string | null>(null)
  return <section className="ai-view" data-mode="expanded" style={{ height: '100dvh' }}>
    <header className="ai-view-head"><h2 className="ai-view-title">AI activity — presentation fixture</h2>
      <AiExecutionSettings settings={{ ...PREVIEW_SETTINGS, execution: { assessment: 'automatic', replyBrief: 'on_demand', reading: 'on_demand' } }} busy={false} error={null} reload={() => {}} change={async () => {}} />
    </header>
    <AiSplit inspector={<NativeInspector graph={graph} selected={selected} />}>
      <div className="ai-view-main"><NativeGraph graph={graph} selected={selected} onSelect={select} animate /></div>
    </AiSplit>
  </section>
}
createRoot(document.getElementById('root')!).render(<Preview />)
