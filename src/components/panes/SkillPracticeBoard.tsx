import { SkillEvidenceRecord } from './SkillEvidenceRecord'
import { SkillOverview } from './SkillOverview'
import { DetailDialog } from '../DetailDialog'
import { useSkillNavigation } from '../../hooks/useSkillNavigation'
import { useContext, useEffect, useState, type CSSProperties } from 'react'
import type { SkillSnapshot } from '../../lib/skills'
import type { TreeNode } from '../../pages/skillTree'
import { PracticeContext } from './PracticeContext'
import { domainColors } from '../../lib/skill-domains'
import { TopicExplanation } from './TopicExplanation'

function domainOf(snapshot: SkillSnapshot, node: TreeNode): TreeNode {
  if (node.kind === 'domain') return node
  const parent = snapshot.catalog.find(item => item.id === node.parent)
  if (!parent) throw new Error(`Missing parent for ${node.id}`)
  return domainOf(snapshot, parent)
}

export function SkillDetailDialog({ node, snapshot, chatId, level, busy, onClose }: {
  node: TreeNode; snapshot: SkillSnapshot; chatId: string; level: string; busy: boolean; onClose: () => void
}) {
  const navigation = useSkillNavigation()
  const records = snapshot.records.filter(record => record.chat_id === chatId && record.catalog_version === snapshot.catalog_version && record.status === 'complete' && record.assessment?.judgments.some(j => j.skill_id === node.id))
  return <DetailDialog title={node.label} onClose={onClose}>
    <SkillOverview node={node} snapshot={snapshot} />
    <TopicExplanation key={`${chatId}:${level}:${node.id}`} chatId={chatId} level={level} topic={`${node.label}: ${node.criterion}`} busy={busy} />
    <h3>Reviewed replies in this conversation</h3>
    {!records.length && <p>No reviewed replies for this skill yet.</p>}
    {records.slice(0, 5).map(record => <SkillEvidenceRecord key={record.attempt_id} record={record} judgment={record.assessment!.judgments.find(j => j.skill_id === node.id)!} snapshot={snapshot}>{null}</SkillEvidenceRecord>)}
    <button className="lesson-action" onClick={() => { onClose(); navigation.explore({ target: snapshot.target, skillId: node.id }) }}>Explore on map</button>
  </DetailDialog>
}

export function SkillPracticeBoard({ snapshot, chatId, level, busy }: { snapshot: SkillSnapshot; chatId: string; level: string; busy: boolean }) {
  const initial = snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!initial) throw new Error('Practice focus is missing from the skill catalog')
  const practice = useContext(PracticeContext)
  const [localDomain, setLocalDomain] = useState(() => domainOf(snapshot, initial).id)
  const selectedNode = snapshot.catalog.find(node => node.id === practice?.selected && node.kind === 'skill')
  const domain = selectedNode ? domainOf(snapshot, selectedNode).id : localDomain
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { if (practice?.selected) setExpanded(practice.selected) }, [practice?.selected, practice?.selectionVersion])
  const [detail, setDetail] = useState<TreeNode | null>(null)
  const domains = snapshot.catalog.filter(node => node.kind === 'domain')
  const cards = domains.map(branch => {
    if (selectedNode && domainOf(snapshot, selectedNode).id === branch.id) return selectedNode
    if (domainOf(snapshot, initial).id === branch.id) return initial
    const skill = snapshot.catalog.find(node => node.kind === 'skill' && node.parent === branch.id)
    if (!skill) throw new Error(`No entry skill for ${branch.id}`)
    return skill
  })
  const [allAreas, setAllAreas] = useState(false)
  const suggested = [initial, ...cards.filter(node => domainOf(snapshot, node).id !== domainOf(snapshot, initial).id).sort((a, b) => snapshot.profile.skills.find(item => item.skill_id === a.id)!.xp - snapshot.profile.skills.find(item => item.skill_id === b.id)!.xp)].slice(0, 3)
  const selectedOutsideSuggestions = !!selectedNode && !suggested.some(node => node.id === selectedNode.id)
  useEffect(() => { if (selectedOutsideSuggestions) setAllAreas(true) }, [selectedNode?.id, selectedOutsideSuggestions])
  const [layout, setLayout] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('skellyspeak_practice_layout')
    if (saved === null) return 'list'
    if (saved !== 'list' && saved !== 'grid') throw new Error('Invalid practice card layout')
    return saved
  })
  const changeLayout = (value: 'list' | 'grid'): void => {
    localStorage.setItem('skellyspeak_practice_layout', value)
    setLayout(value)
  }
  return <div className="practice-board">
    <div className="practice-board-heading">
      <p className="lesson-meta">{domains.find(node => node.id === domain)!.label} · {domain === domainOf(snapshot, initial).id ? 'Current practice focus' : 'Browsing'}</p>
    </div>
    <p className="lesson-meta">Your focus and two areas with less recorded practice.</p>
    <button className="lesson-inline-action" aria-expanded={allAreas} onClick={() => setAllAreas(!allAreas)}>{allAreas ? 'Suggested areas' : 'All areas'}</button>
    <div className="practice-layout-switch" role="group" aria-label="Card layout">
      <button aria-pressed={layout === 'list'} onClick={() => changeLayout('list')}>List</button>
      <button aria-pressed={layout === 'grid'} onClick={() => changeLayout('grid')}>Grid</button>
    </div>
    <div className={`practice-cards ${layout}`}>
    {(allAreas ? cards : suggested).map(node => {
      const branch = domainOf(snapshot, node)
      const progress = snapshot.profile.skills.find(item => item.skill_id === node.id)
      if (!progress) throw new Error(`Missing progress for ${node.id}`)
      return <article style={{ '--domain-color': domainColors(branch.id).bright } as CSSProperties} data-reward-skill={node.id} className={`practice-card ${domain === branch.id ? 'is-selected' : ''}`} key={node.id}>
        <button className="practice-card-toggle" aria-pressed={domain === branch.id} aria-expanded={expanded === node.id} aria-controls={`practice-${node.id}`} onClick={event => { if (event.detail < 2) { setLocalDomain(branch.id); if (expanded !== node.id) practice?.select(node.id); setExpanded(expanded === node.id ? null : node.id) } }} onDoubleClick={() => setDetail(node)}>
          <span className="practice-card-domain">{branch.label}</span>
          <span className="practice-turn-heading"><strong>{node.label}</strong><span>{progress.xp} XP</span></span>
          <span className="practice-milestone"><progress aria-label={`${node.label} successes toward a star`} value={Math.min(progress.successes, 3)} max={3} /><span>{progress.star ? '★ Star earned' : `${progress.successes}/3 successes to a star`}</span><span>▾</span></span>
        </button>
        <div id={`practice-${node.id}`} hidden={expanded !== node.id} className="practice-card-help">
          <p>{node.criterion}</p>
          {practice && domain === branch.id && <details className="card-reply-ideas"><summary>Reply ideas</summary>{practice.suggestions.replies.map(reply => <button key={reply} className="lesson-action" disabled={busy} onClick={() => practice.useExample(reply, 'suggestion')}>{reply}</button>)}{[...practice.suggestions.frames, ...practice.suggestions.starters].map(frame => <button key={frame} className="lesson-action" disabled={busy} onClick={() => practice.useExample(frame, 'scaffold')}>{frame}</button>)}{practice.suggestionsError && <p role="alert">{practice.suggestionsError}</p>}</details>}
          {expanded === node.id && <TopicExplanation key={`${chatId}:${level}:${node.id}`} chatId={chatId} level={level} topic={`${node.label}: ${node.criterion}`} busy={busy} />}
          <button className="lesson-inline-action" onClick={() => setDetail(node)}>Explanation &amp; reviewed replies ↗</button>
        </div>
      </article>
    })}
    </div>
    {detail && <SkillDetailDialog node={detail} snapshot={snapshot} chatId={chatId} level={level} busy={busy} onClose={() => setDetail(null)} />}
  </div>
}
