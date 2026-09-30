import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import { domainColors, skillDomain } from '../../../domain/learning/catalog/skill-domains'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { xpReportCredits, type XpMessageScope } from './XpEvidenceReport'
import { conversationSkills } from './conversationSkills'
import { conversationUnits, effortDimensions } from '../../../components/learning/effort-dimensions'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import type { EffortProgress } from '../../../generated/contracts'

/** This conversation's progress: its effort units, credited skills by use, and
 * every credited award, newest first, read from saved evidence. */
export function XpLedger({ snapshot, chatId, effort, effortError, onInspectMessage }: {
  snapshot: SkillSnapshot; chatId: string; effort: EffortProgress | null; effortError?: string | null; onInspectMessage: (message: XpMessageScope) => void
}) {
  const tr = useI18n()
  const rows = xpReportCredits(snapshot).filter(row => row.record.chat_id === chatId)
  const skills = conversationSkills(snapshot, chatId)
  const messages = new Set(rows.map(row => row.record.message_id)).size
  const total = rows.reduce((sum, row) => sum + row.credit.xp, 0)
  return <section className="xp-ledger" aria-label={tr('Conversation XP')}>
    <header className="xp-ledger-heading">
      <h2>{tr('Conversation XP')}</h2>
      <strong>+{tr.number(total)}{tr(' XP')}</strong>
      <span>{tr.number(snapshot.profile.xp)}{tr(' XP total')}</span>
    </header>
    <div className="xp-ledger-stats">
      <dl>
        <div><dt>{tr('Contributing messages')}</dt><dd>{tr.number(messages)}</dd></div>
        <div><dt>{tr('XP per contributing message')}</dt><dd>{messages ? tr.number(total / messages, { maximumFractionDigits: 1 }) : '—'}</dd></div>
        <div><dt>{tr('Skills with credit')}</dt><dd>{tr.number(skills.length)}</dd></div>
        {effortDimensions.filter(({ field }) => conversationUnits.includes(field)).map(({ field, icon, label }) =>
          <div key={field} data-unit={field}><dt><ToolbarIcon name={icon} size={13} />{tr(label)}</dt><dd>{effort ? tr.number(effort[field]) : '—'}</dd></div>)}
      </dl>
      {effortError && <ErrorNotice error={effortError}>{effortError}</ErrorNotice>}
      {skills.length > 0 && <table className="xp-ledger-skills">
        <caption>{tr('Skills in this conversation')}</caption>
        <thead><tr><th scope="col">{tr('Skill')}</th><th scope="col">{tr('Credited messages')}</th><th scope="col">{tr(' XP')}</th><th scope="col">{tr('Share of XP')}</th></tr></thead>
        <tbody>{skills.map(({ skill, uses, xp }) => {
          const colors = domainColors(skillDomain(snapshot, skill).id)
          return <tr key={skill.id}>
            <th scope="row"><span className="xp-domain-dot" style={{ background: colors.bright }} /><span style={{ color: colors.ink }}>{tr(skill.label)}</span></th>
            <td>{tr.number(uses)}</td><td>{tr.number(xp)}</td><td>{tr.number(total ? xp / total : 0, { style: 'percent', maximumFractionDigits: 0 })}</td>
          </tr>
        })}</tbody>
      </table>}
    </div>
    <div className="xp-ledger-scroll">
    {!rows.length && <p className="xp-ledger-empty">{tr('No credited messages.')}</p>}
    {rows.length > 0 && <ul className="xp-ledger-rows">{rows.map(({ credit, record, skill, judgment }) => {
      const colors = domainColors(skillDomain(snapshot, skill).id)
      return <li key={`${credit.attempt_id}:${credit.skill_id}`}>
        <button type="button" aria-haspopup="dialog" onClick={() => onInspectMessage({ chatId: record.chat_id, messageId: record.message_id, source: record.source })}>
          <span className="xp-domain-dot" style={{ background: colors.bright }} />
          <span className="xp-ledger-skill" style={{ color: colors.ink }}>{tr(skill.label)}</span>
          <strong>+{tr.number(credit.xp)}</strong>
          <time dateTime={new Date(record.at_secs * 1000).toISOString()}>{tr.date(record.at_secs * 1000, { timeStyle: 'short' })}</time>
        </button>
          <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}>
            <span className="xp-ledger-quote" dir="auto"><TargetPhrase text={judgment.quotes[0] ?? record.source} /></span>
          </ReadingLanguageScope>
      </li>
    })}</ul>}
    </div>
  </section>
}
