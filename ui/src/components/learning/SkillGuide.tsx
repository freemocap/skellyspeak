import { useEffect, useState } from 'react'
import { useI18n } from '../localization/i18n'
import { GuideActions } from './GuideActions'
import { GuideDocument } from './GuideDocument'
import { ReadingLanguageScope } from '../reading/ReadingLanguageScope'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'
import { getSkillGuide } from '../../platform/ipc/skill-evidence'
import type { SkillGuideResult } from '../../generated/contracts'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { ResponseDetails } from '../feedback/ResponseDetails'
import { nativeError } from '../../platform/ipc/workspace'
import { ActivityIndicator } from '../feedback/ActivityIndicator'

/** Authored guidance resolves the language core plus an explicitly selected
 * variety. The guide loads when it is first opened; `initiallyOpen` opens it at once. */
export function SkillGuide({ snapshot, skillId, active, initiallyOpen }: { snapshot: SkillSnapshot; skillId: string; active?: string; initiallyOpen: boolean }) {
  const tr = useI18n()
  const [open, setOpen] = useState(initiallyOpen)
  const [choice, choose] = useState<{ scope: string; id: string } | null>(null)
  const scope = JSON.stringify([snapshot.target, skillId, active, snapshot.guide_explanation_language])
  useEffect(() => { choose(null) }, [scope])
  const id = choice?.scope === scope ? choice.id : active
  const guide = snapshot.guides?.find(item => item.id === id)
  const text = guide?.skills[skillId]
  return <details className="practice-skill" open={initiallyOpen || undefined} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{tr('Skill guide')}</summary>
    <div className="learner-model-controls learner-model">
      <label>{tr('Variety ')}<select value={id ?? ''} onChange={event => choose({ scope, id: event.target.value })}>
        <option value="">{tr('Choose a variety')}</option>
        {snapshot.guides?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </div>
    {id && snapshot.guide_explanation_language ? <ResolvedGuide key={JSON.stringify([scope, id])} open={open} language={snapshot.target} variety={id} skill={skillId} explanation={snapshot.guide_explanation_language} authored={text} />
      : text ? <ReadingLanguageScope language={snapshot.target} variety={id}><GuideDocument text={text} /></ReadingLanguageScope> : id ? <p>{tr('No authored guide is available for this selection.')}</p> : null}
  </details>
}

function ResolvedGuide({ open, language, variety, skill, explanation, authored }: {
  open: boolean; language: string; variety: string; skill: string; explanation: string; authored?: string | null
}) {
  const tr = useI18n()
  const [result, setResult] = useState<SkillGuideResult | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [started, setStarted] = useState(false)
  useEffect(() => { if (open) setStarted(true) }, [open])
  useEffect(() => {
    if (!started) return
    let current = true
    setError(null)
    getSkillGuide(language, variety, skill, explanation, attempt > 0)
      .then(value => { if (current) setResult(value) })
      .catch(reason => { if (current) setError(reason) })
    return () => { current = false }
  }, [started, language, variety, skill, explanation, attempt])
  const text = result?.markdown ?? authored
  return <>
    {!text && started && !error && <p className="activity-line"><ActivityIndicator label={tr('Translating guide…')} /></p>}
    {error != null && <ErrorNotice error={error} onRetry={() => { setAttempt(value => value + 1) }}>{nativeError(error)}<ResponseDetails value={error} /></ErrorNotice>}
    {text && <ReadingLanguageScope language={language} variety={variety} explanation={explanation}><GuideDocument text={text} context={result?.context} /></ReadingLanguageScope>}
    {result?.context && <GuideActions guide={result.context.reference} />}
    {result?.generated && <p>{tr('AI-generated translation')}</p>}
    {result && <ResponseDetails value={result.provenance} />}
  </>
}
