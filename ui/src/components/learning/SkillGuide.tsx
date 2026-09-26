import { useEffect, useState } from 'react'
import { useI18n } from '../localization/i18n'
import { GuideDocument } from './GuideDocument'
import { ReadingLanguageScope } from '../reading/ReadingLanguageScope'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'

/** Authored guidance resolves the language core plus an explicitly selected variety. */
export function SkillGuide({ snapshot, skillId, active }: { snapshot: SkillSnapshot; skillId: string; active?: string }) {
  const tr = useI18n()
  const [choice, choose] = useState<{ scope: string; id: string } | null>(null)
  const scope = JSON.stringify([snapshot.target, skillId, active])
  useEffect(() => { choose(null) }, [scope])
  const id = choice?.scope === scope ? choice.id : active
  const guide = snapshot.guides?.find(item => item.id === id)
  const text = guide?.skills[skillId]
  return <details className="practice-skill">
    <summary>{tr('Skill guide')}</summary>
    <div className="learner-model-controls learner-model">
      <label>{tr('Variety ')}<select value={id ?? ''} onChange={event => choose({ scope, id: event.target.value })}>
        <option value="">{tr('Choose a variety')}</option>
        {snapshot.guides?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </div>
    {text ? <ReadingLanguageScope language={snapshot.target} variety={id} explanation="english"><GuideDocument text={text} /></ReadingLanguageScope> : id ? <p>{tr('No authored guide is available for this selection.')}</p> : null}
  </details>
}
