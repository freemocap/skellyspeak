import { ReadingLanguageScope } from '../reading/ReadingLanguageScope'
import { useI18n } from '../localization/i18n'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'
import { TargetPhrase } from '../reading/TargetPhrase'

/** Configuration changes retain observations, but do not silently re-credit or relabel them. */
export function EvidenceMappingNotice({ snapshot, chatId, messageId }: { snapshot: SkillSnapshot | null; chatId?: string | null; messageId?: number }) {
  const tr = useI18n()
  const records = snapshot?.records.filter(record => record.mapping_error && (chatId === undefined || record.chat_id === chatId) && (messageId === undefined || record.message_id === messageId)) ?? []
  if (!records.length) return null
  return <section className="evidence-mapping-notice" aria-label={tr("Unmapped evidence")}>
    <p role="alert">{tr.number(records.length)} {tr(" observation")}{records.length === 1 ? '' : 's'} {tr(" cannot be mapped to the current construct registry.")}</p>
    <details><summary>{tr("Inspect retained evidence")}</summary>{records.map(record => <ReadingLanguageScope key={record.attempt_id} language={record.target} variety={record.variety} explanation={record.native}><article>
      <p>{record.mapping_error}</p>
      <blockquote><TargetPhrase text={record.source} /></blockquote>
      <dl><dt>{tr("Source")}</dt><dd>{record.chat_id}/{record.message_id}</dd><dt>{tr("Recorded registry")}</dt><dd>{record.construct_registry_hash ?? tr("Missing registry identity")}</dd><dt>{tr("Current registry")}</dt><dd>{snapshot!.construct_registry_hash}</dd></dl>
      <ul>{record.assessment?.judgments.map((item, index) => <li key={`${item.skill_id}:${index}`}><code>{item.skill_id}</code> · {(item.presence ?? item.outcome ?? 'unclear').replaceAll('_', ' ')}<blockquote>{item.quotes.map((quote, quoteIndex) => <div key={quoteIndex}><TargetPhrase text={quote} /></div>)}</blockquote></li>)}</ul>
    </article></ReadingLanguageScope>)}</details>
  </section>
}
