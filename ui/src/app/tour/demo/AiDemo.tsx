import { useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { NativeGraph } from '../../../features/activity/NativeGraph'
import { NativeInspector } from '../../../features/activity/NativeInspector'
import type { DefinitionSnapshot } from '../../../generated/graph-contracts'
import definition from '../../../generated/coach-graph.json'

const graph = definition as DefinitionSnapshot

/** The tour displays the generated executable coach artifact without executing it. */
export function AiDemo() {
  const tr = useI18n()
  const [selected, setSelected] = useState<string | null>('node:reply')
  return <div className="demo-page">
    <section className="ai-view" data-mode="expanded" aria-label={tr('AI activity')}>
      <header className="ai-view-head"><h2 className="ai-view-title">{tr('AI activity')}</h2></header>
      <div className="ai-view-body">
        <div className="ai-view-main"><NativeGraph graph={graph} selected={selected} onSelect={setSelected} /></div>
        <NativeInspector graph={graph} selected={selected} />
      </div>
    </section>
  </div>
}
