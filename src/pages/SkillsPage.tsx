import { SkillEvidenceRecord } from '../components/panes/SkillEvidenceRecord'
import { SkillOverview } from '../components/panes/SkillOverview'
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
import { ancestry, displayedTree, mapAnchor, descendants, evidenceLabel, nodeScale, nodePosition, skillTree, treeNode, type TreeLayout, type TreeNode } from './skillTree'
import { TreeCamera, type CameraRequest } from './TreeCamera'
import './skills.css'

type SkillNodeData = Record<string, unknown> & { item: TreeNode; picked: boolean; focus: boolean; status: string; source: Position; target: Position; onPick: (id: string) => void }
function SkillNode({ data }: NodeProps<Node<SkillNodeData>>) {
  const { item, picked, focus, status, source, target, onPick } = data
  return <button className={`tree-node ${item.kind} ${picked ? 'selected' : ''}`} style={{ '--node-color': item.color, '--node-scale': nodeScale(item) } as CSSProperties} aria-label={`${item.code} ${item.label}, ${status}${focus ? ', focus' : ''}`} aria-pressed={picked} onClick={() => onPick(item.id)}>
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
  const navigation = useSkillNavigation()
  const selected = navigation.state.selected?.target === snapshot.target ? navigation.state.selected.skillId : 'experience'
  const setSelected = useCallback((skillId: string) => navigation.select({ target: snapshot.target, skillId }), [navigation.select, snapshot.target])
  const [camera, setCamera] = useState<CameraRequest>({ sequence: 0, target: 'experience', action: 'whole' })
  const [layoutChoice, setLayoutChoice] = useState<'horizontal' | 'radial' | 'down'>('horizontal')
  const direction = useUiDirection()
  const layout: TreeLayout = layoutChoice === 'horizontal' ? direction === 'rtl' ? 'left' : 'right' : layoutChoice
  const [canBack, setCanBack] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [demoFocus, setDemoFocus] = useState<string | null>(null)
  const mobile = useIsMobile()
  const [graphOnMobile, setGraphOnMobile] = useState(true)
  const profile = snapshot.profile
  const focus = demoFocus ?? profile.active_focus
  const item = treeNode(selected)
  const relevant = useMemo(() => new Set(descendants(selected)), [selected])
  const progress = profile.skills.filter((s) => relevant.has(s.skill_id))
  const examples = snapshot.records.filter((r) => r.catalog_version === snapshot.catalog_version).flatMap((record) => (record.assessment?.judgments ?? []).filter((j) => relevant.has(j.skill_id) && j.outcome !== 'not_observed').map((judgment) => ({ record, judgment })))
  const failures = snapshot.records.filter((r) => r.status === 'failed')
  const legacy = snapshot.records.filter((r) => r.catalog_version !== snapshot.catalog_version)
  const restore = useCallback((id: string) => { setSelected(id); setDetailOpen(id !== 'experience'); setShowAll(false) }, [setSelected])
  const pick = useCallback((id: string) => {
    setSelected(id); setDetailOpen(true); setShowAll(false)
    setCamera((v) => ({ sequence: v.sequence + 1, target: mapAnchor(id).id, action: 'focus' }))
  }, [setSelected])
  useEffect(() => {
    const request = navigation.state.mapRequest
    if (request?.location.target === snapshot.target) { setDetailOpen(true); setCamera({ sequence: request.sequence, target: mapAnchor(request.location.skillId).id, action: 'focus' }) }
  }, [navigation.state.mapRequest, snapshot.target])
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
  }, [profile, snapshot.conversation_count])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SkillNodeData>>([])
  useEffect(() => {
    setNodes((previous) => visible.map((node) => ({ ...previous.find((n) => n.id === node.id), id: node.id, type: 'skill', position: nodePosition(node, layout, visible), data: { item: node, status: status(node), picked: mapAnchor(selected).id === node.id, focus: mapAnchor(focus).id === node.id, onPick: pick, ...ports(node, layout, visible) }, draggable: false })))
  }, [layout, selected, focus, pick, setNodes, visible, status])
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
  return <main className="skills-page" onKeyDown={(event) => { if (event.key === 'Escape') setDetailOpen(false) }}>
    <header className="tree-header"><h1>LANGUAGE PROFILE <span>/ {snapshot.target}</span></h1><span className="tree-fixture">{demonstration ? 'DEMO · SAMPLE DATA' : `${profile.xp} XP · ★ ${profile.skills.filter((s) => s.star).length}`}</span></header>
    <div className="tree-toolbar">
      <div className="tree-layouts" aria-label="Tree layout">{([['horizontal', direction === 'rtl' ? 'Right-left' : 'Left-right'], ['radial', 'Radial'], ['down', 'Top-down']] as const).map(([value, label]) => <button key={value} aria-pressed={layoutChoice === value} onClick={() => { setLayoutChoice(value); setGraphOnMobile(true) }}>{label}</button>)}</div>
      {mobile && <button className="tree-refresh" onClick={() => setGraphOnMobile((v) => !v)}>{graphOnMobile ? 'List' : 'Graph'}</button>}
      <label className="tree-jump">Inspect <select value={selected} onChange={(e) => inspect(e.target.value)}>{skillTree.map((n) => <option key={n.id} value={n.id}>{n.code} / {n.label}</option>)}</select></label>
    </div>
    <div className="tree-focus-strip"><button onClick={() => inspect(focus)}>◆ {treeNode(focus).label}</button><span>{profile.choices.focus || demoFocus ? 'Pinned focus' : 'Recommended focus'}</span>{profile.choices.focus && <button disabled={saving} onClick={() => void update({ ...profile.choices, focus: null }, false)}>Follow recommendations</button>}</div>
    {mutationError && <p className="tree-load" role="alert">{mutationError}</p>}
    <div className={`tree-workspace ${detailOpen ? 'details-open' : 'details-closed'}`}>
      <section className="tree-canvas" aria-label="Language skill tree">
        <div className="tree-navigation"><button className="tree-back" disabled={!canBack} onClick={back}>← Back</button><button onClick={wholeTree}>Whole tree</button><nav aria-label="Tree location">{ancestry(selected).map((n) => <button key={n.id} aria-current={n.id === selected ? 'location' : undefined} onClick={() => n.id === 'experience' ? wholeTree() : pick(n.id)}>{n.label}</button>)}</nav></div>
        {mobile && !graphOnMobile ? <div className="tree-list">{visible.map((n) => <button key={n.id} aria-pressed={selected === n.id} onClick={() => n.kind === 'domain' ? inspect(n.id) : pick(n.id)} style={{ '--node-color': n.color } as CSSProperties}><span>{n.code} / {n.label}</span><small>{status(n)}</small></button>)}</div> : <ReactFlow nodes={nodes} onNodesChange={onNodesChange} edges={edges} nodeTypes={nodeTypes} nodeOrigin={[0.5, 0.5]} nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} minZoom={0.08} maxZoom={3} onPaneClick={() => setDetailOpen(false)}><Background variant={BackgroundVariant.Dots} gap={24} color="#3a473f" /><Controls showInteractive={false} showFitView={false} /><MiniMap style={{ width: mobile ? 90 : 130, height: mobile ? 60 : 90 }} pannable zoomable nodeColor={(node) => (node.data as SkillNodeData).item.color} maskColor="#060d0ab8" /><TreeCamera request={camera} layout={layout} onRestore={restore} onCanBackChange={setCanBack} /></ReactFlow>}
        <div className="tree-legend"><span>○ No success</span><span>✓ One · ✓✓ Two · ★ Three</span><span>◆ Practice focus</span></div>
      </section>
      <aside className={`tree-inspector ${detailOpen ? 'expanded' : ''}`} aria-label="Selected node" style={{ '--node-color': item.color, '--node-scale': nodeScale(item) } as CSSProperties}>
        <button className="tree-inspector-toggle" aria-expanded={detailOpen} onClick={() => setDetailOpen((v) => !v)}><span>{item.label}</span><span>{detailOpen ? '−' : '+'}</span></button>
        <div className="tree-inspector-body">
          <div className="tree-detail-actions"><button disabled={!canBack} onClick={back}>← Back</button><button onClick={wholeTree}>Whole tree</button><button aria-label="Close node details" onClick={() => setDetailOpen(false)}>×</button></div>
          <SkillOverview node={item} snapshot={snapshot} />
          <dl className="tree-stats"><div><dt>Successes</dt><dd>{progress.reduce((n, s) => n + s.successes, 0)}</dd></div><div><dt>Assisted</dt><dd>{progress.reduce((n, s) => n + s.assisted, 0)}</dd></div><div><dt>XP</dt><dd>{progress.reduce((n, s) => n + s.xp, 0)}</dd></div></dl>
          {item.kind === 'skill' ? <><p>{status(item)}</p><button className="tree-set-focus" disabled={saving} onClick={selectFocus}>{demonstration ? 'Preview focus' : 'Practise this in conversation'}</button><p>{profile.branches.find((b) => b.skill_id === selected)?.available ? 'Available in the recommended path.' : 'Extension: build three successes in its parent, or choose it now.'}</p><details><summary>Assessment criterion</summary><p>{item.criterion}</p></details></> : item.kind === 'domain' && <button className="tree-set-focus" onClick={() => pick(item.id)}>Zoom to this area</button>}
          <section className="tree-inspector-section"><h3>CONNECTIONS</h3><div className="tree-relations">{item.parent && <button onClick={() => inspect(item.parent!)}>↑ {treeNode(item.parent).label}</button>}{skillTree.filter((n) => n.parent === selected).map((n) => <button key={n.id} onClick={() => inspect(n.id)}>{n.code} / {n.label} · {status(n)}</button>)}</div></section>
          <section className="tree-inspector-section"><h3>EVIDENCE / {examples.length}</h3>
            {(showAll ? examples : examples.slice(0, 12)).map(({ record, judgment }) => <SkillEvidenceRecord key={`${record.attempt_id}-${judgment.skill_id}`} record={record} judgment={judgment} snapshot={snapshot}>
              {!demonstration && <button className="tree-refresh" disabled={saving} onClick={() => void update({ ...profile.choices, excluded_attempts: profile.choices.excluded_attempts.includes(record.attempt_id) ? profile.choices.excluded_attempts.filter((id) => id !== record.attempt_id) : [...profile.choices.excluded_attempts, record.attempt_id] }, false)}>{profile.choices.excluded_attempts.includes(record.attempt_id) ? 'Excluded · restore attempt' : 'Exclude attempt from progress'}</button>}
            </SkillEvidenceRecord>)}
            {examples.length > 12 && <button className="tree-refresh" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show recent' : 'Show all evidence'}</button>}
            {!examples.length && <p>No direct evidence yet. An unobserved skill is not a failure.</p>}
          </section>
          <details className="tree-method"><summary>Progress rules & ownership</summary><p>Local learner / {snapshot.target}. Profile revision {profile.choices.revision}; rules {profile.rules_version}. One success earns a check, two earn two checks, three earn a star. No fast/strict mode. A star is repeated evidence, not certified mastery.</p><p>Each distinct successful response per skill earns 10 XP without recorded in-app assistance, or 2 practice XP with suggestions, scaffolds or revision. Assisted practice does not advance stars. External assistance is unknown. Identical wording, ignoring case and whitespace, counts once per skill. Repeating it without recorded assistance replaces its assisted credit.</p><p>Only current saved sources count. Editing, truncating, deleting a chat or excluding an attempt can reduce these evidence-based totals. Old catalogs stay in history and earn no new-skill credit. Focus is saved per target language; explicit lesson choices and conversation difficulty remain under your control. Text transcripts do not establish pronunciation, listening, retention or transfer.</p></details>
          <details className="tree-method"><summary>Assessment activity · {snapshot.records.filter((r) => r.status === 'pending').length} pending · {failures.length} failed</summary><button className="tree-refresh" onClick={refresh}>Refresh</button>{failures.map((r) => <p key={r.attempt_id}>{r.chat_id}/{r.message_id}: {r.error}</p>)}</details>
          {legacy.length > 0 && <details className="tree-method"><summary>Previous rubric evidence · {legacy.length} attempts</summary><p>Retained for inspection. These judgments do not establish the current meaning-domain skills.</p>{legacy.map((r) => <details key={r.attempt_id}><summary>{r.source}</summary><p>Catalog {r.catalog_version} · {r.chat_id}/{r.message_id} · {r.attempt_id}</p>{r.assessment?.judgments.filter((j) => j.outcome !== 'not_observed').map((j) => <p key={j.skill_id}>{evidenceLabel(j.skill_id, r.catalog_version)}: {j.outcome} — {j.rationale}</p>)}</details>)}</details>}
        </div>
      </aside>
    </div>
    <footer className="tree-footer"><span>{snapshot.learner_id} / {snapshot.target}</span><span>{demonstration ? 'BROWSER DEMO' : 'PROFILE & EVIDENCE SAVED LOCALLY'}</span></footer>
  </main>
}
