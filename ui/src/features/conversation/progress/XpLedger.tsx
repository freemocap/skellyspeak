import { useI18n } from '../../../components/localization/i18n'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { TargetText } from '../../../components/reading/TargetText'
import { domainColors, skillDomain } from '../../../domain/learning/catalog/skill-domains'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { xpReportCredits, type XpMessageScope } from './XpEvidenceReport'

/** Every credited award in this conversation, newest first, read from saved evidence. */
export function XpLedger({ snapshot, chatId, onInspectMessage }: { snapshot: SkillSnapshot; chatId: string; onInspectMessage: (message: XpMessageScope) => void }) {
  const tr = useI18n()
  const rows = xpReportCredits(snapshot).filter(row => row.record.chat_id === chatId)
  const total = rows.reduce((sum, row) => sum + row.credit.xp, 0)
  return <section className="xp-ledger" role="dialog" aria-label={tr('Conversation XP')}>
    <header className="xp-ledger-heading">
      <h2>{tr('Conversation XP')}</h2>
      <strong>+{tr.number(total)}{tr(' XP')}</strong>
      <span>{tr.number(snapshot.profile.xp)}{tr(' XP total')}</span>
    </header>
    {!rows.length && <p className="xp-ledger-empty">{tr('No credited messages.')}</p>}
    {rows.length > 0 && <ul className="xp-ledger-rows">{rows.map(({ credit, record, skill, judgment }) => {
      const colors = domainColors(skillDomain(snapshot, skill).id)
      return <li key={`${credit.attempt_id}:${credit.skill_id}`}>
        <button type="button" aria-haspopup="dialog" onClick={() => onInspectMessage({ chatId: record.chat_id, messageId: record.message_id, source: record.source })}>
          <span className="xp-domain-dot" style={{ background: colors.bright }} />
          <span className="xp-ledger-skill" style={{ color: colors.ink }}>{tr(skill.label)}</span>
          <strong>+{tr.number(credit.xp)}</strong>
          <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}>
            <span className="xp-ledger-quote" dir="auto"><TargetText text={judgment.quotes[0] ?? record.source} /></span>
          </ReadingLanguageScope>
          <time dateTime={new Date(record.at_secs * 1000).toISOString()}>{tr.date(record.at_secs * 1000, { timeStyle: 'short' })}</time>
        </button>
      </li>
    })}</ul>}
  </section>
}
