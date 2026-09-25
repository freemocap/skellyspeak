import { useState } from 'react'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { experienceProfile } from '../../../domain/learning/statistics/experience-profile'

export function ExperienceProfile({ snapshot, initialVariety, onInspect, selectedVariety, onVarietyChange }: {
  snapshot: SkillSnapshot; initialVariety?: string; onInspect: (id: string, variety?: string) => void; selectedVariety?: string; onVarietyChange?: (value: string) => void
}) {
  const tr = useI18n()
  const [selection, setSelection] = useState<{ scope: string; variety: string } | null>(null)
  const scope = JSON.stringify([snapshot.target, initialVariety])
  const variety = selectedVariety ?? (selection?.scope === scope ? selection.variety : initialVariety ?? '*')
  const varieties = [...new Set([...(initialVariety ? [initialVariety] : []), ...(snapshot.guides?.map(guide => guide.id) ?? []), ...snapshot.records.map(record => record.variety ?? '')])].sort()
  let profile
  try { profile = experienceProfile(snapshot, variety === '*' ? null : variety) }
  catch (error) { return <ErrorNotice as="div" error={error}>{String(error)}</ErrorNotice> }
  return <section className="learner-model">
    <div className="learner-model-controls">
      <label>{tr('Variety ')}<select value={variety} onChange={event => { setSelection({ scope, variety: event.target.value }); onVarietyChange?.(event.target.value) }}>
        <option value="*">{tr('All varieties')}</option>
        {varieties.map(id => <option key={id} value={id}>{id || tr('Unspecified variety')}</option>)}
      </select></label>
      <span>{tr('Skills with recorded experience')}: {tr.number(profile.used)} / {tr.number(profile.skills.length)} <InfoTip>{tr('Skill XP comes from evidence in your messages.')}</InfoTip></span>
      <InfoTip>{tr('XP equals experience plus effort, with 1 XP per credited skill. Correctness, assistance, difficulty and novelty do not change the award. Unchanged retries add no credit.')}</InfoTip>
    </div>
    <div className="learner-model-table"><table>
      <thead><tr><th scope="col">{tr('Skill')}</th><th scope="col">{tr('Experience')}</th><th scope="col">{tr('Effort')}</th><th scope="col">XP</th></tr></thead>
      <tbody>{profile.skills.map(skill => <tr key={skill.id}>
        <th scope="row"><button className="inspection-action" onClick={() => onInspect(skill.id, variety === '*' ? undefined : variety)}>{tr(skill.label)}</button></th>
        <td>{tr.number(skill.experience)}</td><td>{tr.number(skill.effort)}</td><td>{tr.number(skill.xp)}</td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row">Σ</th><td>{tr.number(profile.experience)}</td><td>{tr.number(profile.effort)}</td><td>{tr.number(profile.xp)}</td></tr></tfoot>
    </table></div>
  </section>
}
