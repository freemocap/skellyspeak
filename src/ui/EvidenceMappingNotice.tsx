import type { SkillSnapshot } from '../domain/skills/skills'
import { TargetText } from './TargetText'

/** Configuration changes retain observations, but do not silently re-credit or relabel them. */
export function EvidenceMappingNotice({ snapshot, chatId, messageId }: { snapshot: SkillSnapshot | null; chatId?: string | null; messageId?: number }) {
  const records = snapshot?.records.filter(record => record.mapping_error && (chatId === undefined || record.chat_id === chatId) && (messageId === undefined || record.message_id === messageId)) ?? []
  if (!records.length) return null
  return <section className="evidence-mapping-notice" aria-label="Unmapped evidence">
    <p role="alert">{records.length} observation{records.length === 1 ? '' : 's'} cannot be mapped to the current construct registry.</p>
    <details><summary>Inspect retained evidence</summary>{records.map(record => <article key={record.attempt_id}>
      <p>{record.mapping_error}</p>
      <blockquote><TargetText text={record.source} /></blockquote>
      <dl><dt>Source</dt><dd>{record.chat_id}/{record.message_id}</dd><dt>Recorded registry</dt><dd>{record.construct_registry_hash ?? 'Missing registry identity'}</dd><dt>Current registry</dt><dd>{snapshot!.construct_registry_hash}</dd></dl>
      <ul>{record.assessment?.judgments.map((item, index) => <li key={`${item.skill_id}:${index}`}><code>{item.skill_id}</code> · {item.outcome.replaceAll('_', ' ')}<blockquote>{item.quotes.map((quote, quoteIndex) => <div key={quoteIndex}><TargetText text={quote} /></div>)}</blockquote></li>)}</ul>
    </article>)}</details>
  </section>
}
