import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { TargetText } from '../../../components/reading/TargetText'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { useI18n } from '../../../components/localization/i18n'

/** Saved awards only: do not infer multipliers from today's policy or fabricate dates. */
export function RewardsLedger({ snapshot }: { snapshot: SkillSnapshot }) {
  const tr = useI18n()
  const awards = snapshot.profile.credits.filter(credit => credit.xp > 0)
  return <section className="rewards-ledger" aria-label={tr('Rewards')}>
    <h3>{tr('Rewards')}</h3>
    {!awards.length && <p>{tr('No credited messages.')}</p>}
    {awards.map(credit => {
      const skill = snapshot.catalog.find(node => node.id === credit.skill_id)
      const event = credit.event
      const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
      const date = event ? Number(event.atSecs) : record?.at_secs
      return <ReadingLanguageScope key={`${credit.attempt_id}:${credit.skill_id}`} language={record?.target ?? snapshot.target} variety={record?.variety} explanation={record?.native}><details className="practice-credit">
        <summary><strong>+{tr.number(credit.xp)} {tr(' XP')}</strong> · {skill ? tr(skill.label) : credit.skill_id}</summary>
        {date !== undefined && <time dateTime={new Date(date * 1000).toISOString()}>{new Date(date * 1000).toLocaleString(tr.browserLocale)}</time>}
        <blockquote dir="auto"><TargetText text={event?.quote ?? record?.source ?? ''} /></blockquote>
        {event && <dl className="reward-provenance">
          <div><dt>{tr('Support')}</dt><dd>{event.support}</dd></div>
          <div><dt>{tr('Difficulty')}</dt><dd>{event.difficulty}</dd></div>
          <div><dt>{tr('Novelty')}</dt><dd>{event.novelty}</dd></div>
          <div><dt>{tr('Policy')}</dt><dd>{event.policyHash}</dd></div>
        </dl>}
      </details></ReadingLanguageScope>
    })}
  </section>
}
