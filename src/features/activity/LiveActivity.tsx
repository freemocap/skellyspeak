import { useEffect, useState } from 'react'
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { readWorkspace, selectedConversation, watchConversation, nativeError } from '../../platform/ipc/workspace'
import { GenerationActivity } from './GenerationActivity'
import type { ConversationSnapshot } from '../../contracts'

/** Draw the actual durable operation dependencies; inspecting never dispatches inference. */
export function LiveActivity() {
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    let stopped = false
    void (async () => {
      let workspace = await readWorkspace()
      let conversationId: string | null = null
      let revision = -1
      while (!stopped) {
        const desired = selectedConversation(workspace)?.id ?? null
        if (desired !== conversationId) {
          conversationId = desired; revision = -1
          setSnapshot(null); setSelected(null); setError(null)
        }
        if (!conversationId) {
          // No conversation exists to long-poll yet. Keep this inspector alive
          // so opening/creating one in the main window supplies its scope.
          await new Promise(resolve => setTimeout(resolve, 500))
          if (stopped) return
          workspace = await readWorkspace()
          continue
        }
        let next: ConversationSnapshot
        try { next = await watchConversation(conversationId, revision) }
        catch (failure) {
          if (stopped) return
          workspace = await readWorkspace()
          if (stopped) return
          // Deleting/archiving the abandoned conversation may reject its wait.
          if (selectedConversation(workspace)?.id !== conversationId) continue
          throw failure
        }
        if (stopped) return
        // Native selection changes increment the same global revision that
        // wakes this wait. Re-read the directory before accepting its old scope.
        workspace = await readWorkspace()
        if (stopped) return
        if (selectedConversation(workspace)?.id !== conversationId) continue
        if (next.conversationId !== conversationId) throw new Error('AI activity returned a different conversation.')
        setSnapshot(next); revision = next.revision
      }
    })().catch(failure => { if (!stopped) { setSnapshot(null); setError(nativeError(failure)) } })
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
    return { id: op.id, position: { x: column * 225, y: row * 90 }, data: { label: `${op.kind.replaceAll('_', ' ')} · ${op.state}` }, className: op.state === 'failed' ? 'activity-node failed' : 'activity-node' }
  }) ?? []
  const edges: Edge[] = turn?.operations.flatMap(op => op.dependencies.map(dep => ({ id: `${dep}:${op.id}`, source: dep, target: op.id, animated: op.state === 'running' }))) ?? []
  return <section className="live-activity">
    {error && <p role="alert">{error}</p>}
    <label>Exchange <select aria-label="AI exchange" value={turn?.id ?? ''} onChange={event => setSelected(event.target.value)}>{snapshot?.turns.map((item, index) => <option key={item.id} value={item.id}>{snapshot.turns.length - index} · {item.state}</option>)}</select></label>
    <div className="live-operation-graph"><ReactFlow key={turn?.id} nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}><Background /><Controls showInteractive={false} /></ReactFlow></div>
    {!turn && <p>No recorded AI operations.</p>}
    {turn?.attempts.map(attempt => <details key={attempt.id}><summary>{turn.operations.find(op => op.id === attempt.operationId)?.kind} · {attempt.state}</summary><dl><dt>Model</dt><dd>{attempt.actualModel ?? attempt.requestedModel}</dd><dt>Tokens in / out</dt><dd>{attempt.inputTokens ?? '—'} / {attempt.outputTokens ?? '—'}</dd><dt>Started</dt><dd>{attempt.startedAt}</dd></dl>{attempt.error && <p>{attempt.error}</p>}</details>)}
    <GenerationActivity />
  </section>
}
