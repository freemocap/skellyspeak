import { useState, type ReactNode } from 'react'
import type { SkillSnapshot, SkillRecord } from '../../lib/skills'
import type { TreeNode } from '../../pages/skillTree'
import { evidenceForSkill, skillIndex } from '../../lib/skill-index'
import { SkillOverview } from './SkillOverview'
import { SkillEvidenceRecord } from './SkillEvidenceRecord'

export function SkillDetailContent({ node, snapshot, chatId, explanation, controls, onSelect, recordControls }: {
  node: TreeNode; snapshot: SkillSnapshot; chatId: string | null; explanation: ReactNode; controls: ReactNode
  onSelect: (id: string) => void; recordControls: (record: SkillRecord) => ReactNode
}) {
  const [showAll, setShowAll] = useState(false)
  const index = skillIndex(snapshot)
  const examples = evidenceForSkill(snapshot, node.id, chatId)
  return <div className="skill-detail-content">
    <SkillOverview node={node} snapshot={snapshot} />
    {explanation}{controls}
    <details className="skill-connections"><summary>Related skills</summary><div className="skill-relations">
      {node.parent && <button className="lesson-action" onClick={() => onSelect(node.parent!)}>↑ {index.catalog.node(node.parent).label}</button>}
      {index.catalog.children(node.id).map(item => <button className="lesson-action" key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>)}
    </div></details>
    <h3>{chatId ? 'Reviewed replies in this conversation' : 'Reviewed replies'}</h3>
    {(showAll ? examples : examples.slice(0, 12)).map(({ record, judgment }) => <SkillEvidenceRecord key={`${record.attempt_id}:${judgment.skill_id}`} record={record} judgment={judgment} snapshot={snapshot}>{recordControls(record)}</SkillEvidenceRecord>)}
    {!examples.length && <p>No reviewed replies for this skill yet. Missing evidence is not a failure.</p>}
    {examples.length > 12 && <button className="lesson-action" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show recent' : 'Show all evidence'}</button>}
  </div>
}
