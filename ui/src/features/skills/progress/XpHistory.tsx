import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import { skillColors } from '../../../domain/learning/catalog/skill-domains'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { useI18n } from '../../../components/localization/i18n'

/** The XP history: every saved award, newest first, one row each with its
 * skill, kind (skill XP or effort XP) and date; opening a row shows the quote
 * and the policy that awarded it. Saved awards only: do not infer multipliers
 * from today's policy or fabricate dates. */
export function XpHistory({ snapshot }: { snapshot: SkillSnapshot }) {
  const tr = useI18n()
  const awards = snapshot.profile.credits.filter(credit => credit.xp > 0).map(credit => {
    const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
    const date = credit.event ? Number(credit.event.atSecs) : record?.at_secs
    return { credit, record, date }
  }).sort((left, right) => (right.date ?? 0) - (left.date ?? 0))
  return <section className="rewards-ledger progress-section" aria-labelledby="progress-xp-history">
    <h3 id="progress-xp-history">{tr('XP history')}</h3>
    {!awards.length && <p>{tr('No credited messages.')}</p>}
    <ol className="rewards-ledger-list">{awards.map(({ credit, record, date }) => {
      const skill = snapshot.catalog.find(node => node.id === credit.skill_id)
      const event = credit.event
      const effort = (credit.effort ?? event?.effort ?? 0) > 0
      return <li key={`${credit.attempt_id}:${credit.skill_id}`}><ReadingLanguageScope language={record?.target ?? snapshot.target} variety={record?.variety} explanation={record?.native}><details className="xp-history-row">
        <summary style={{ color: skillColors(credit.skill_id).mark }}>
          <strong>+{tr.number(credit.xp)}</strong>
          <span className="xp-history-skill" style={{ color: skillColors(credit.skill_id).ink }}>{skill ? tr(skill.label) : credit.skill_id}</span>
          <span className="xp-history-kind" data-kind={effort ? 'effort' : 'experience'}>{effort ? tr('Effort XP') : tr('Skill XP')}</span>
          {date !== undefined && <time dateTime={new Date(date * 1000).toISOString()}>{tr.date(date * 1000, { dateStyle: 'medium' })}</time>}
        </summary>
        <blockquote dir="auto"><TargetPhrase text={event?.quote ?? record?.source ?? ''} /></blockquote>
        {event && <p className="xp-history-policy">{tr('Policy')} {event.policyHash}</p>}
      </details></ReadingLanguageScope></li>
    })}</ol>
  </section>
}
