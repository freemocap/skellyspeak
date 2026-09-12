import { TargetText } from '../TargetText'
import { skillIndex, practiceSuggestions } from '../../lib/skill-index'
import { SkillDetailContent } from './SkillDetailContent'
import { DetailDialog } from '../DetailDialog'
import { useSkillNavigation } from '../../hooks/useSkillNavigation'
import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { SkillSnapshot } from '../../lib/skills'
import type { TreeNode } from '../../pages/skillTree'
import { PracticeContext, DraftAssistanceContext } from './PracticeContext'
import { domainColors } from '../../lib/skill-domains'
import { TopicExplanation } from './TopicExplanation'

function domainOf(snapshot: SkillSnapshot, node: TreeNode): TreeNode { return skillIndex(snapshot).catalog.domain(node.id) }

export function SkillDetailDialog({ node, snapshot, chatId, level, busy, onClose }: {
  node: TreeNode; snapshot: SkillSnapshot; chatId: string; level: string; busy: boolean; onClose: () => void
}) {
  const navigation = useSkillNavigation()
  return <DetailDialog title={node.label} onClose={onClose}>
    <SkillDetailContent node={node} snapshot={snapshot} chatId={chatId}
      explanation={<TopicExplanation chatId={chatId} level={level} topic={`${node.label}: ${node.criterion}`} busy={busy} />}
      controls={<button className="lesson-action" onClick={() => { onClose(); navigation.explore({ target: snapshot.target, skillId: node.id }) }}>Explore on map</button>}
      onSelect={skillId => { onClose(); navigation.explore({ target: snapshot.target, skillId }) }} recordControls={() => null} />
  </DetailDialog>
}

export function SkillPracticeBoard({ snapshot, chatId, level, busy }: { snapshot: SkillSnapshot; chatId: string; level: string; busy: boolean }) {
  const displayMenu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const dismiss = (event: PointerEvent): void => { if (displayMenu.current && !displayMenu.current.contains(event.target as Node)) displayMenu.current.open = false }
    const escape = (event: KeyboardEvent): void => { if (event.key === 'Escape' && displayMenu.current?.open) { displayMenu.current.open = false; displayMenu.current.querySelector('summary')?.focus(); event.stopPropagation() } }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [])
  const initial = snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!initial) throw new Error('Practice focus is missing from the skill catalog')
  const practice = useContext(PracticeContext)
  const assistance = useContext(DraftAssistanceContext)
  const [localDomain, setLocalDomain] = useState(() => domainOf(snapshot, initial).id)
  const selectedNode = snapshot.catalog.find(node => node.id === practice?.selected && node.kind === 'skill')
  const domain = selectedNode ? domainOf(snapshot, selectedNode).id : localDomain
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { if (practice?.selected) setExpanded(practice.selected) }, [practice?.selected, practice?.selectionVersion])
  const [detail, setDetail] = useState<TreeNode | null>(null)
  const { areas, suggested } = practiceSuggestions(snapshot)
  const cards = areas.map(node => selectedNode && domainOf(snapshot, selectedNode).id === domainOf(snapshot, node).id ? selectedNode : node)
  const [allAreas, setAllAreas] = useState(false)
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
  const visibleCards = [...(allAreas ? cards : suggested)].sort((a, b) => Number(b.id === selectedNode?.id) - Number(a.id === selectedNode?.id))
  return <div className="practice-board">
    <details ref={displayMenu} className="practice-display-menu">
      <summary aria-label="Card display options" title="Card display options">⋯</summary>
      <div className="practice-layout-switch" role="group" aria-label="Card layout">
      <button className="practice-area-switch" aria-expanded={allAreas} onClick={() => setAllAreas(!allAreas)}>{allAreas ? 'Suggested areas' : 'All areas'}</button>
      <button aria-pressed={layout === 'list'} onClick={() => changeLayout('list')}>List</button>
      <button aria-pressed={layout === 'grid'} onClick={() => changeLayout('grid')}>Grid</button>
    </div>
    </details>
    <div className={`practice-cards ${layout}`}>
    {visibleCards.map(node => {
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
          {assistance && domain === branch.id && <details className="card-reply-ideas"><summary>Reply ideas for the conversation</summary><p className="lesson-meta">General reply options; these are not specific evidence for this skill.</p>{assistance.suggestions.replies.map(reply => <div key={reply.text}><p><TargetText text={reply.text} /></p><button className="lesson-action" disabled={busy} onClick={() => assistance.useExample(reply.text, 'suggestion')}>Use this reply</button></div>)}{[...assistance.suggestions.frames, ...assistance.suggestions.starters].map(frame => <div key={frame}><p><TargetText text={frame} /></p><button className="lesson-action" disabled={busy} onClick={() => assistance.useExample(frame, 'scaffold')}>Use this scaffold</button></div>)}{assistance.suggestionsError && <p role="alert">{assistance.suggestionsError}</p>}</details>}
          {expanded === node.id && <TopicExplanation key={`${chatId}:${level}:${node.id}`} chatId={chatId} level={level} topic={`${node.label}: ${node.criterion}`} busy={busy} />}
          <button className="lesson-inline-action" onClick={() => setDetail(node)}>Explanation &amp; reviewed replies ↗</button>
        </div>
      </article>
    })}
    </div>
    {detail && <SkillDetailDialog node={detail} snapshot={snapshot} chatId={chatId} level={level} busy={busy} onClose={() => setDetail(null)} />}
  </div>
}
