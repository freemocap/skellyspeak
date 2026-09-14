import { useI18n } from './i18n'
import type { SkillSnapshot } from '../domain/skills/skills'
import { TargetText } from './TargetText'

/** Configuration changes retain observations, but do not silently re-credit or relabel them. */
export function EvidenceMappingNotice({ snapshot, chatId, messageId }: { snapshot: SkillSnapshot | null; chatId?: string | null; messageId?: number }) {
  const tr = useI18n()
  const records = snapshot?.records.filter(record => record.mapping_error && (chatId === undefined || record.chat_id === chatId) && (messageId === undefined || record.message_id === messageId)) ?? []
  if (!records.length) return null
  return <section className="evidence-mapping-notice" aria-label={tr("Unmapped evidence")}>
    <p role="alert">{records.length} {tr(" observation")}{records.length === 1 ? '' : 's'} {tr(" cannot be mapped to the current construct registry.")}</p>
    <details><summary>{tr("Inspect retained evidence")}</summary>{records.map(record => <article key={record.attempt_id}>
      <p>{record.mapping_error}</p>
      <blockquote><TargetText text={record.source} /></blockquote>
      <dl><dt>{tr("Source")}</dt><dd>{record.chat_id}/{record.message_id}</dd><dt>{tr("Recorded registry")}</dt><dd>{record.construct_registry_hash ?? tr("Missing registry identity")}</dd><dt>{tr("Current registry")}</dt><dd>{snapshot!.construct_registry_hash}</dd></dl>
      <ul>{record.assessment?.judgments.map((item, index) => <li key={`${item.skill_id}:${index}`}><code>{item.skill_id}</code> · {item.outcome.replaceAll('_', ' ')}<blockquote>{item.quotes.map((quote, quoteIndex) => <div key={quoteIndex}><TargetText text={quote} /></div>)}</blockquote></li>)}</ul>
    </article>)}</details>
  </section>
}
