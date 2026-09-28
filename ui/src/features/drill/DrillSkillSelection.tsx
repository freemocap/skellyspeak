import { useEffect, useState } from 'react'
import type { DrillSkillTarget, ReadingScope } from '../../generated/contracts'
import { getLearnerProfile } from '../../platform/ipc/learner-profile'
import { nativeError } from '../../platform/ipc/workspace'
import { InfoTip } from '../../components/controls/InfoTip'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useI18n } from '../../components/localization/i18n'

/** Which recorded skill new phrases should practise, if the learner names one.
 *
 * One list, and no mode beside it: the drill asks for phrases to say, so the only
 * choice worth offering is the skill to aim them at. Leaving it unset asks for a
 * general set, which is why nothing here gates Generate. */
export function DrillSkillSelection({ scope, value, disabled, onChange }: {
  scope: ReadingScope; value: DrillSkillTarget | null; disabled: boolean; onChange: (value: DrillSkillTarget | null) => void
}) {
  const tr = useI18n()
  const [catalog, setCatalog] = useState<{ id: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const chosen = value?.kind === 'skill' ? value.skillId : ''
  useEffect(() => {
    let current = true
    setError(null)
    void getLearnerProfile(scope.language).then(profile => {
      if (current) setCatalog(profile.evidence.catalog.filter(node => node.kind === 'skill'))
    }).catch(reason => { if (current) setError(nativeError(reason)) })
    return () => { current = false }
  }, [scope.language])
  return <>
    <label className="form-row drill-add-skill">{tr('Skill')}
      <InfoTip>{tr('Aim new cards at a recorded skill, or leave unset for general practice.')}</InfoTip>
      <select className="field" aria-label={tr('Skill')} value={chosen} disabled={disabled || !catalog.length}
        onChange={event => onChange(event.target.value ? { kind: 'skill', skillId: event.target.value } : null)}>
        <option value="">{tr('Any skill')}</option>
        {catalog.map(skill => <option key={skill.id} value={skill.id}>{tr(skill.label)}</option>)}
      </select>
    </label>
    {error && <ErrorNotice error={error}>{error}</ErrorNotice>}
  </>
}
