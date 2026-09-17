import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { useI18n } from '../../../components/localization/i18n'

/** Saved awards only: do not infer multipliers from today's policy or fabricate dates. */
export function RewardsLedger({ snapshot }: { snapshot: SkillSnapshot }) {
  const tr = useI18n()
  const awards = snapshot.profile.credits.filter(credit => credit.xp > 0)
  const mysteries = snapshot.profile.mystery_credits.filter(credit => credit.xp > 0)
  return <section className="rewards-ledger" aria-label={tr('Rewards')}>
    <h3>{tr('Rewards')}</h3>
    {!awards.length && !mysteries.length && <p>{tr('No credited messages.')}</p>}
    {awards.map(credit => {
      const event = credit.event
      const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
      const date = event ? Number(event.atSecs) : record?.at_secs
      return <details key={`${credit.attempt_id}:${credit.skill_id}`} className="practice-credit">
        <summary><strong>+{credit.xp} {tr(' XP')}</strong> · {snapshot.catalog.find(node => node.id === credit.skill_id)?.label ?? credit.skill_id}</summary>
        {date !== undefined && <time dateTime={new Date(date * 1000).toISOString()}>{new Date(date * 1000).toLocaleString(tr.browserLocale)}</time>}
        <blockquote dir="auto">{event?.quote ?? record?.source}</blockquote>
        {event && <dl className="reward-provenance">
          <div><dt>{tr('Support')}</dt><dd>{event.support}</dd></div>
          <div><dt>{tr('Difficulty')}</dt><dd>{event.difficulty}</dd></div>
          <div><dt>{tr('Novelty')}</dt><dd>{event.novelty}</dd></div>
          <div><dt>{tr('Policy')}</dt><dd>{event.policyHash}</dd></div>
        </dl>}
      </details>
    })}
    {mysteries.map(credit => <p key={`${credit.personaId}:${credit.field}`}>+{credit.xp} {tr(' XP')} · {tr('Mystery partner')} · {credit.field}</p>)}
  </section>
}
