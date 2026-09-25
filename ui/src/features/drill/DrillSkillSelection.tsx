import { useEffect, useState } from 'react'
import type { DrillSkillTarget, ReadingScope, RecommendationMode } from '../../generated/contracts'
import { getLearnerProfile } from '../../platform/ipc/learner-profile'
import { nativeError } from '../../platform/ipc/workspace'
import { InfoTip } from '../../components/controls/InfoTip'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useI18n } from '../../components/localization/i18n'

export function DrillSkillSelection({ scope, value, disabled, onChange }: {
  scope: ReadingScope; value: DrillSkillTarget | null; disabled: boolean; onChange: (value: DrillSkillTarget | null) => void
}) {
  const tr = useI18n()
  const [catalog, setCatalog] = useState<{ id: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const specific = value?.kind === 'skill'
  useEffect(() => {
    if (!specific) return
    let current = true
    setCatalog([]); setError(null)
    void getLearnerProfile(scope.language).then(profile => {
      if (current) setCatalog(profile.evidence.catalog.filter(node => node.kind === 'skill'))
    }).catch(reason => { if (current) setError(nativeError(reason)) })
    return () => { current = false }
  }, [specific, scope.language])
  return <>
    <div className="form-row"><label htmlFor="drill-skill-focus">{tr('Skill focus')} <InfoTip>{tr('Choose from recorded experience and retry effort, not correctness.')}</InfoTip></label>
      <select aria-label={tr('Skill focus')} id="drill-skill-focus" className="field" value={value?.kind === 'skill' ? 'skill' : value?.mode ?? ''} disabled={disabled} onChange={event => {
        const mode = event.target.value
        onChange(mode === '' ? null : mode === 'skill' ? {kind: 'skill', skillId: ''} : {kind: 'coach', mode: mode as RecommendationMode})
      }}>
        <option value="">{tr('No preference')}</option>
        <option value="skill">{tr('Choose a skill')}</option>
        <option value="explore">{tr('Explore')}</option>
        <option value="continuePracticing">{tr('Continue practicing')}</option>
        <option value="coachChoice">{tr('Coach’s choice')}</option>
      </select>
    </div>
    {specific && <label className="form-row">{tr('Skills')}
      <select className="field" value={value.skillId} disabled={disabled || !catalog.length} onChange={event => onChange({kind: 'skill', skillId: event.target.value})}>
        <option value="">{tr('Choose a skill')}</option>
        {catalog.map(skill => <option key={skill.id} value={skill.id}>{tr(skill.label)}</option>)}
      </select>
    </label>}
    {specific && error && <ErrorNotice error={error}>{error}</ErrorNotice>}
  </>
}
