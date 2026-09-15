import { useI18n } from '../../../components/localization/i18n'
import { useState, type ReactNode } from 'react'
import type { SkillSnapshot, SkillRecord } from '../../../domain/learning/evidence/skills'
import type { TreeNode } from '../../../domain/learning/catalog/skillTree'
import { evidenceForSkill, skillIndex } from '../../../domain/learning/catalog/skill-index'
import { SkillOverview } from '../overview/SkillOverview'
import { SkillEvidenceRecord } from './SkillEvidenceRecord'

export function SkillDetailContent({ node, snapshot, chatId, explanation, controls, onSelect, recordControls }: {
  node: TreeNode; snapshot: SkillSnapshot; chatId: string | null; explanation: ReactNode; controls: ReactNode
  onSelect: (id: string) => void; recordControls: (record: SkillRecord) => ReactNode
}) {
  const tr = useI18n()
  const [showAll, setShowAll] = useState(false)
  const index = skillIndex(snapshot)
  const examples = evidenceForSkill(snapshot, node.id, chatId)
  return <div className="skill-detail-content">
    <SkillOverview node={node} snapshot={snapshot} />
    {explanation}{controls}
    <details className="skill-connections"><summary>{tr("Related skills")}</summary><div className="skill-relations">
      {node.parent && <button className="lesson-action" onClick={() => onSelect(node.parent!)}>↑ {index.catalog.node(node.parent).label}</button>}
      {index.catalog.children(node.id).map(item => <button className="lesson-action" key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>)}
    </div></details>
    <h3>{chatId ? tr("Reviewed replies in this conversation") : tr("Reviewed replies")}</h3>
    {(showAll ? examples : examples.slice(0, 12)).map(({ record, judgment }) => <SkillEvidenceRecord key={`${record.attempt_id}:${judgment.skill_id}`} record={record} judgment={judgment} snapshot={snapshot}>{recordControls(record)}</SkillEvidenceRecord>)}
    {!examples.length && <p>{tr("No reviewed replies for this skill yet. Missing evidence is not a failure.")}</p>}
    {examples.length > 12 && <button className="lesson-action" onClick={() => setShowAll(!showAll)}>{showAll ? tr("Show recent") : tr("Show all evidence")}</button>}
  </div>
}
