import { useEffect, useState } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { readWorkspace, selectedConversation, watchConversation, nativeError } from '../../platform/ipc/workspace'
import type { ConversationSnapshot } from '../../contracts'

/** Draw the actual durable operation dependencies; inspecting never dispatches inference. */
export function LiveActivity() {
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    let stopped = false
    void (async () => {
      const workspace = await readWorkspace()
      const conversation = selectedConversation(workspace)
      if (!conversation) return
      let revision = -1
      while (!stopped) {
        const next = await watchConversation(conversation.id, revision)
        if (stopped) return
        setSnapshot(next); revision = next.revision
      }
    })().catch(failure => { if (!stopped) setError(nativeError(failure)) })
    return () => { stopped = true }
  }, [])
  const turn = snapshot?.turns.find(item => item.id === selected) ?? snapshot?.turns[0]
  const positions = new Map<string, number>()
  function depth(id: string, visiting = new Set<string>()): number {
    if (positions.has(id)) return positions.get(id)!
    const op = turn?.operations.find(item => item.id === id)
    if (!op || visiting.has(id)) return 0
    const next = new Set(visiting).add(id)
    const value = op.dependencies.length ? 1 + Math.max(...op.dependencies.map(dep => depth(dep, next))) : 0
    positions.set(id, value); return value
  }
  const rows = new Map<number, number>()
  const nodes: Node[] = turn?.operations.map(op => {
    const column = depth(op.id), row = rows.get(column) ?? 0
    rows.set(column, row + 1)
    return { id: op.id, position: { x: column * 225, y: row * 90 }, data: { label: `${op.kind.replaceAll('_', ' ')} · ${op.state}` }, style: { background: '#192d42', color: '#e8eef7', borderColor: op.state === 'failed' ? '#ce6978' : '#438bb4', width: 200 } }
  }) ?? []
  const edges: Edge[] = turn?.operations.flatMap(op => op.dependencies.map(dep => ({ id: `${dep}:${op.id}`, source: dep, target: op.id, animated: op.state === 'running' }))) ?? []
  return <section className="live-activity">
    {error && <p role="alert">{error}</p>}
    <label>Exchange <select aria-label="AI exchange" value={turn?.id ?? ''} onChange={event => setSelected(event.target.value)}>{snapshot?.turns.map((item, index) => <option key={item.id} value={item.id}>{snapshot.turns.length - index} · {item.state}</option>)}</select></label>
    <div className="live-operation-graph"><ReactFlow key={turn?.id} nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}><Background /><Controls showInteractive={false} /></ReactFlow></div>
    {!turn && <p>No recorded AI operations.</p>}
    {turn?.attempts.map(attempt => <details key={attempt.id}><summary>{turn.operations.find(op => op.id === attempt.operationId)?.kind} · {attempt.state}</summary><dl><dt>Model</dt><dd>{attempt.actualModel ?? attempt.requestedModel}</dd><dt>Tokens in / out</dt><dd>{attempt.inputTokens ?? '—'} / {attempt.outputTokens ?? '—'}</dd><dt>Started</dt><dd>{attempt.startedAt}</dd></dl>{attempt.error && <p>{attempt.error}</p>}</details>)}
  </section>
}
