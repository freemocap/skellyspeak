import { useSettingsStore } from '../../../state/settings/settings'
import { SkillGuide } from '../../../components/learning/SkillGuide'
import { useI18n } from '../../../components/localization/i18n'
import { useState, type ReactNode } from 'react'
import type { SkillSnapshot, SkillRecord } from '../../../domain/learning/evidence/skills'
import type { TreeNode } from '../../../domain/learning/catalog/skillTree'
import { evidenceForSkill } from '../../../domain/learning/catalog/skill-index'
import { SkillOverview } from '../overview/SkillOverview'
import { SkillEvidenceRecord } from './SkillEvidenceRecord'

/** One skill: its overview, then its guide beside the reviewed replies for it.
 * The columns wrap into one on narrow panes. `guideOpen` keeps the guide
 * permanently visible where the skill has a page of its own. */
export function SkillDetailContent({ variety, languageName, languageTag, node, snapshot, chatId, explanation, controls, recordControls, guideOpen }: {
  variety?: string; languageName: string; languageTag?: string; node: TreeNode; snapshot: SkillSnapshot; chatId: string | null; explanation: ReactNode; controls: ReactNode
  onSelect: (id: string) => void; recordControls: (record: SkillRecord) => ReactNode; guideOpen: boolean
}) {
  const active = useSettingsStore(state => state.settings?.target_language === snapshot.target ? state.settings.target_variety : undefined)
  const tr = useI18n()
  const [showAll, setShowAll] = useState(false)
  const examples = evidenceForSkill(snapshot, node.id, chatId).filter(({ record }) => variety === undefined || (record.variety ?? '') === variety)
  return <div className="skill-detail-content">
    <SkillOverview node={node} languageName={languageName} snapshot={snapshot} variety={variety}>{explanation}{controls}</SkillOverview>
    <div className="skill-detail-columns">
      <section className="skill-detail-guide">
        <SkillGuide active={variety ?? active} snapshot={snapshot} skillId={node.id} initiallyOpen={guideOpen} collapsible={!guideOpen} />
      </section>
      <section className="skill-detail-evidence">
        <h3>{chatId ? tr("Reviewed replies in this conversation") : tr("Reviewed replies")} <span className="skill-detail-count">{tr.number(examples.length)}</span></h3>
        {(showAll ? examples : examples.slice(0, 12)).map(({ record, judgment }) => <SkillEvidenceRecord languageTag={languageTag} key={`${record.attempt_id}:${judgment.skill_id}`} record={record} judgment={judgment} snapshot={snapshot}>{recordControls(record)}</SkillEvidenceRecord>)}
        {!examples.length && <p className="skill-detail-empty">{tr("No reviewed replies for this skill yet. Missing evidence is not a failure.")}</p>}
        {examples.length > 12 && <button className="detail-action" onClick={() => setShowAll(!showAll)}>{showAll ? tr("Show recent") : tr("Show all evidence")}</button>}
      </section>
    </div>
  </div>
}
