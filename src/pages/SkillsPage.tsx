import { ProgressRules } from '../components/panes/ProgressRules'
import { DetailDialog } from '../components/DetailDialog'
import { skillIndex } from '../lib/skill-index'
import { SkillDetailContent } from '../components/panes/SkillDetailContent'
import { useSkillNavigation } from '../hooks/useSkillNavigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Background, BackgroundVariant, Controls, MiniMap, Handle, Position, ReactFlow, useNodesState, type Node, type NodeProps, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useIsMobile } from '../hooks/useIsMobile'
import { useUiDirection } from '../hooks/useUiDirection'
import { useSkillEvidence } from '../hooks/useSkillEvidence'
import { isTauri } from '../lib/tauri'
import { skillDemo } from '../lib/skillDemo'
import type { ProfileChoices, SkillProgress, SkillSnapshot } from '../lib/skills'
import { evidenceLabel, nodePosition, type TreeLayout, type TreeNode } from './skillTree'
import { TreeCamera, type CameraRequest } from './TreeCamera'
import './skills.css'

type SkillNodeData = Record<string, unknown> & { item: TreeNode; scale: number; picked: boolean; focus: boolean; status: string; source: Position; target: Position; onPick: (id: string) => void }
function SkillNode({ data }: NodeProps<Node<SkillNodeData>>) {
  const { item, picked, focus, status, source, target, onPick } = data
  return <button className={`tree-node ${item.kind} ${picked ? 'selected' : ''}`} style={{ '--node-color': item.color, '--node-scale': data.scale } as CSSProperties} aria-label={`${item.code} ${item.label}, ${status}${focus ? ', focus' : ''}`} aria-pressed={picked} onClick={() => onPick(item.id)}>
    <Handle type="target" position={target} /><span className="tree-node-code">{item.code}<span>{focus ? '◆ FOCUS' : picked ? 'SELECTED' : ''}</span></span>
    <strong>{item.label}</strong><span className="tree-node-status">{status}</span><Handle type="source" position={source} />
  </button>
}
const nodeTypes = { skill: SkillNode }
function ports(node: TreeNode, layout: TreeLayout, visible: TreeNode[]) {
  if (layout === 'down') return { source: Position.Bottom, target: Position.Top }
  if (layout === 'right') return { source: Position.Right, target: Position.Left }
  if (layout === 'left') return { source: Position.Left, target: Position.Right }
  const point = nodePosition(node, layout, visible)
  return point.x >= 0 ? { source: Position.Right, target: Position.Left } : { source: Position.Left, target: Position.Right }
}
export function marks(progress: SkillProgress): string {
  return progress.star ? `★ ${progress.successes} successes` : `${'✓'.repeat(progress.successes)}${'○'.repeat(3 - progress.successes)} ${progress.successes}/3`
}

export default function SkillsPage({ evidence, onPractice }: { evidence: ReturnType<typeof useSkillEvidence>; onPractice: () => void }) {
  if (isTauri && evidence.error) return <div className="tree-load" role="alert">Profile: {evidence.error}<button onClick={evidence.refresh}>Retry</button></div>
  if (isTauri && !evidence.snapshot) return <p className="tree-load" role="status">Loading your language profile…</p>
  return <SkillTreeView snapshot={isTauri ? evidence.snapshot! : skillDemo} demonstration={!isTauri} refresh={evidence.refresh} save={evidence.save} saving={evidence.saving} onPractice={onPractice} />
}
export function SkillTreeView({ snapshot, demonstration, refresh, save, saving, onPractice }: { snapshot: SkillSnapshot; demonstration: boolean; refresh: () => void; save: (choices: ProfileChoices) => Promise<void>; saving: boolean; onPractice: () => void }) {
  const catalog = useMemo(() => skillIndex(snapshot).catalog, [snapshot])
  const { node: treeNode, descendants, ancestry, mapAnchor, scale, displayed: displayedTree, nodes: skillTree } = catalog
  const navigation = useSkillNavigation()
  const selected = navigation.state.selected?.target === snapshot.target ? navigation.state.selected.skillId : 'experience'
  const setSelected = useCallback((skillId: string) => navigation.select({ target: snapshot.target, skillId }), [navigation.select, snapshot.target])
  const [camera, setCamera] = useState<CameraRequest>({ sequence: 0, target: 'experience', action: 'whole' })
  const [layoutChoice, setLayoutChoice] = useState<'horizontal' | 'radial' | 'down'>('horizontal')
  const direction = useUiDirection()
  const layout: TreeLayout = layoutChoice === 'horizontal' ? direction === 'rtl' ? 'left' : 'right' : layoutChoice
  const [canBack, setCanBack] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [demoFocus, setDemoFocus] = useState<string | null>(null)
  const mobile = useIsMobile()
  const [graphVisible, setGraphVisible] = useState(false)
  const profile = snapshot.profile
  const focus = demoFocus ?? profile.active_focus
  const item = treeNode(selected)
  const failures = snapshot.records.filter((r) => r.status === 'failed')
  const legacy = snapshot.records.filter((r) => r.catalog_version !== snapshot.catalog_version)
  const restore = useCallback((id: string) => { setSelected(id); setDetailOpen(id !== 'experience') }, [setSelected])
  const pick = useCallback((id: string) => {
    setSelected(id); setDetailOpen(true)
    setCamera((v) => ({ sequence: v.sequence + 1, target: mapAnchor(id).id, action: 'focus' }))
  }, [setSelected, mapAnchor])
  useEffect(() => {
    const request = navigation.state.mapRequest
    if (request?.location.target === snapshot.target) { setDetailOpen(true); setCamera({ sequence: request.sequence, target: mapAnchor(request.location.skillId).id, action: 'focus' }) }
  }, [navigation.state.mapRequest, snapshot.target, mapAnchor])
  const wholeTree = () => {
    setSelected('experience'); setDetailOpen(false)
    setCamera((v) => ({ sequence: v.sequence + 1, target: 'experience', action: 'whole' }))
  }
  const back = () => setCamera((v) => ({ ...v, sequence: v.sequence + 1, action: 'back' }))
  const visible = displayedTree
  const status = useCallback((node: TreeNode) => {
    if (node.kind === 'root') return `${snapshot.conversation_count ? '●' : '○'} ${snapshot.conversation_count} conversations · ${profile.xp} XP`
    const p = profile.skills.find((s) => s.skill_id === node.id)
    if (p) return `${marks(p)}${p.assisted ? ` · ${p.assisted} assisted` : ''}`
    const children = new Set(descendants(node.id))
    const branch = profile.skills.filter((s) => children.has(s.skill_id))
    return `★ ${branch.filter((s) => s.star).length}/${branch.length} · ${branch.reduce((total, s) => total + s.xp, 0)} XP`
  }, [profile, snapshot.conversation_count, descendants])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SkillNodeData>>([])
  useEffect(() => {
    setNodes((previous) => visible.map((node) => ({ ...previous.find((n) => n.id === node.id), id: node.id, type: 'skill', position: nodePosition(node, layout, visible), data: { item: node, scale: scale(node.id), status: status(node), picked: mapAnchor(selected).id === node.id, focus: mapAnchor(focus).id === node.id, onPick: pick, ...ports(node, layout, visible) }, draggable: false })))
  }, [layout, selected, focus, pick, setNodes, visible, status, scale, mapAnchor])
  const edges = useMemo<Edge[]>(() => visible.filter((node) => node.parent !== null).map((node) => ({ id: `${node.parent}-${node.id}`, source: node.parent!, target: node.id, type: layout === 'radial' ? 'straight' : 'smoothstep', style: { stroke: selected === node.id || selected === node.parent ? '#f4f6f8' : node.color, strokeWidth: selected === node.id || selected === node.parent ? 3 : 2, vectorEffect: 'non-scaling-stroke' } })), [layout, selected, visible])
  const update = async (choices: ProfileChoices, practice: boolean) => {
    setMutationError(null)
    try { await save(choices); if (practice) onPractice() } catch (error) { setMutationError(String(error)) }
  }
  const selectFocus = () => {
    if (demonstration) { setDemoFocus(selected); return }
    void update({ ...profile.choices, focus: selected }, true)
  }
  const inspect = pick
  const detailContent = (<SkillDetailContent node={item} snapshot={snapshot} chatId={null} explanation={null} onSelect={inspect}
            controls={item.kind === 'skill' && <><button className="lesson-action" disabled={saving} onClick={selectFocus}>{demonstration ? 'Preview focus' : 'Practise this in conversation'}</button><p>{profile.branches.find(b => b.skill_id === selected)?.available ? 'Available in the recommended path.' : 'Extension: build three successes in its parent, or choose it now.'}</p></>}
            recordControls={record => !demonstration && <button className="lesson-action" disabled={saving} onClick={() => void update({ ...profile.choices, excluded_attempts: profile.choices.excluded_attempts.includes(record.attempt_id) ? profile.choices.excluded_attempts.filter(id => id !== record.attempt_id) : [...profile.choices.excluded_attempts, record.attempt_id] }, false)}>{profile.choices.excluded_attempts.includes(record.attempt_id) ? 'Excluded · restore attempt' : 'Exclude attempt from progress'}</button>} />)
  return <main className="skills-page" onKeyDown={(event) => { if (event.key === 'Escape') setDetailOpen(false) }}>
    <header className="tree-header"><h1>LANGUAGE PROFILE <span>/ {snapshot.target}</span></h1><span className="tree-fixture">{demonstration ? 'DEMO · SAMPLE DATA' : `${profile.xp} XP · ★ ${profile.skills.filter((s) => s.star).length}`}</span></header>
    <div className="tree-toolbar">
      {graphVisible && <div className="tree-layouts" aria-label="Tree layout">{([['horizontal', direction === 'rtl' ? 'Right-left' : 'Left-right'], ['radial', 'Radial'], ['down', 'Top-down']] as const).map(([value, label]) => <button key={value} aria-pressed={layoutChoice === value} onClick={() => { setLayoutChoice(value); setGraphVisible(true) }}>{label}</button>)}</div>}
      <button className="tree-refresh" onClick={() => setGraphVisible(v => !v)}>{graphVisible ? 'Cards' : 'Map'}</button>
      <label className="tree-jump">Inspect <select value={selected} onChange={(e) => inspect(e.target.value)}>{skillTree.map((n) => <option key={n.id} value={n.id}>{n.code} / {n.label}</option>)}</select></label>
    </div>
    <div className="tree-focus-strip"><button onClick={() => inspect(focus)}>◆ {treeNode(focus).label}</button><span>{profile.choices.focus || demoFocus ? 'Pinned focus' : 'Recommended focus'}</span>{profile.choices.focus && <button disabled={saving} onClick={() => void update({ ...profile.choices, focus: null }, false)}>Follow recommendations</button>}</div>
    {mutationError && <p className="tree-load" role="alert">{mutationError}</p>}
    <div className={`tree-workspace ${detailOpen ? 'details-open' : 'details-closed'}`}>
      <section className="tree-canvas" aria-label="Language skill tree">
        <div className="tree-navigation"><button className="tree-back" disabled={!canBack} onClick={back}>← Back</button><button onClick={wholeTree}>Whole tree</button><nav aria-label="Tree location">{ancestry(selected).map((n) => <button key={n.id} aria-current={n.id === selected ? 'location' : undefined} onClick={() => n.id === 'experience' ? wholeTree() : pick(n.id)}>{n.label}</button>)}</nav></div>
        {!graphVisible ? <div className="tree-list">{catalog.nodes.filter(n => n.kind === 'domain').map(domain => <details key={domain.id} className="tree-domain-card" style={{ '--node-color': domain.color } as CSSProperties}>
          <summary>{domain.label}<small>{status(domain)}</small></summary>
          {catalog.nodes.filter(node => node.kind === 'skill' && catalog.domain(node.id).id === domain.id).map(node => <button key={node.id} aria-pressed={selected === node.id} onClick={() => pick(node.id)} onDoubleClick={() => setDetailModal(true)}><span>{node.label}</span><small>{status(node)}</small></button>)}
        </details>)}</div> : <ReactFlow nodes={nodes} onNodesChange={onNodesChange} edges={edges} nodeTypes={nodeTypes} nodeOrigin={[0.5, 0.5]} nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} minZoom={0.08} maxZoom={3} onPaneClick={() => setDetailOpen(false)}><Background variant={BackgroundVariant.Dots} gap={24} color="var(--line2)" /><Controls showInteractive={false} showFitView={false} /><MiniMap style={{ width: mobile ? 90 : 130, height: mobile ? 60 : 90 }} pannable zoomable nodeColor={(node) => (node.data as SkillNodeData).item.color} maskColor="#09111ab8" /><TreeCamera catalog={catalog} request={camera} layout={layout} onRestore={restore} onCanBackChange={setCanBack} /></ReactFlow>}
        {graphVisible && <div className="tree-legend"><span>○ No success</span><span>✓ One · ✓✓ Two · ★ Three</span><span>◆ Practice focus</span></div>}
      </section>
      <aside className={`tree-inspector ${detailOpen ? 'expanded' : ''}`} aria-label="Selected node" style={{ '--node-color': item.color, '--node-scale': scale(item.id) } as CSSProperties}>
        <button className="tree-inspector-toggle" aria-expanded={detailOpen} onClick={() => setDetailOpen((v) => !v)}><span>{item.label}</span><span>{detailOpen ? '−' : '+'}</span></button>
        <div className="tree-inspector-body">
          <div className="tree-detail-actions"><button disabled={!canBack} onClick={back}>← Back</button><button onClick={wholeTree}>Whole tree</button><button aria-label="Close node details" onClick={() => setDetailOpen(false)}>×</button></div>
          {!detailModal && detailContent}
          <button className="lesson-action" onClick={() => setDetailModal(true)}>Open full details</button>
          <ProgressRules />
          <p className="lesson-meta">Profile revision {profile.choices.revision} · rules {profile.rules_version} · {snapshot.target}</p>
          <details className="tree-method"><summary>Assessment activity · {snapshot.records.filter((r) => r.status === 'pending').length} pending · {failures.length} failed</summary><button className="tree-refresh" onClick={refresh}>Refresh</button>{failures.map((r) => <p key={r.attempt_id}>{r.chat_id}/{r.message_id}: {r.error}</p>)}</details>
          {legacy.length > 0 && <details className="tree-method"><summary>Previous rubric evidence · {legacy.length} attempts</summary><p>Retained for inspection. These judgments do not establish the current meaning-domain skills.</p>{legacy.map((r) => <details key={r.attempt_id}><summary>{r.source}</summary><p>Catalog {r.catalog_version} · {r.chat_id}/{r.message_id} · {r.attempt_id}</p>{r.assessment?.judgments.filter((j) => j.outcome !== 'not_observed').map((j) => <p key={j.skill_id}>{evidenceLabel(j.skill_id, r.catalog_version)}: {j.outcome} — {j.rationale}</p>)}</details>)}</details>}
        </div>
      </aside>
    </div>
    {detailModal && <DetailDialog title={item.label} onClose={() => setDetailModal(false)}>{detailContent}</DetailDialog>}
    <footer className="tree-footer"><span>{snapshot.learner_id} / {snapshot.target}</span><span>{demonstration ? 'BROWSER DEMO' : 'PROFILE & EVIDENCE SAVED LOCALLY'}</span></footer>
  </main>
}
