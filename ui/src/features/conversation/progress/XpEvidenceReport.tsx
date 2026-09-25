import { retryMessageWork } from '../../../platform/ipc/retry-ai'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { SkillGuide } from '../../../components/learning/SkillGuide'
import { useSettingsStore } from '../../../state/settings/settings'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import { useI18n } from '../../../components/localization/i18n'
import { requireCatalogVersion, type SkillSnapshot } from '../../../domain/learning/evidence/skills'

export type XpMessageScope = { chatId: string; messageId: number; source: string }

/** Use awarded credits, never assessment outcomes or quote counts, for XP totals. */
export function xpReportCredits(snapshot: SkillSnapshot, skillId?: string, message?: XpMessageScope) {
  const records = new Map(snapshot.records.map(record => [record.attempt_id, record]))
  return snapshot.profile.credits.filter(credit => credit.xp > 0 && (!skillId || credit.skill_id === skillId)).flatMap(credit => {
    const record = records.get(credit.attempt_id)
    if (!record) throw new Error('Missing credited record')
    if (message && (record.chat_id !== message.chatId || record.message_id !== message.messageId || record.source !== message.source)) return []
    if (record.status !== 'complete' || snapshot.profile.choices.excluded_attempts.includes(record.attempt_id)) return []
    requireCatalogVersion(snapshot, record)
    const skill = snapshot.catalog.find(node => node.id === credit.skill_id)
    const judgment = record.assessment?.judgments.find(item => item.skill_id === credit.skill_id)
    if (!skill || !judgment) throw new Error('Missing credited skill assessment')
    return [{ credit, record, skill, judgment }]
  }).sort((a, b) => b.record.at_secs - a.record.at_secs)
}

export function XpEvidenceReport({ snapshot, skillId, message, onClose }: {
  snapshot: SkillSnapshot; skillId?: string; message?: XpMessageScope; onClose: () => void
}) {
  const active = useSettingsStore(state => state.settings?.target_language === snapshot.target ? state.settings.target_variety : undefined)
  const tr = useI18n()
  const rows = xpReportCredits(snapshot, skillId, message)
  const varieties = [...new Set(rows.map(row => row.record.variety).filter((id): id is string => !!id))]
  const guideVariety = varieties.length === 1 ? varieties[0] : active
  const skill = skillId ? snapshot.catalog.find(node => node.id === skillId) : null
  const title = skill ? tr(skill.label) : tr('Message XP')
  const total = rows.reduce((sum, row) => sum + row.credit.xp, 0)
  return <DetailDialog title={title} onClose={onClose}>
    <section className="xp-evidence-report">
      <h2>{title}</h2>
      <p><strong>{tr.number(total)} {tr(' XP')}</strong></p>
      {skill && <p>{tr('Criterion: ')}{tr(skill.criterion)}</p>}
      {skill && <SkillGuide snapshot={snapshot} skillId={skill.id} active={guideVariety} />}
      {!rows.length && <p>{tr('No credited messages.')}</p>}
      {rows.map(({ credit, record, skill: node, judgment }) => <article className="practice-credit" key={`${credit.attempt_id}:${credit.skill_id}`}>
        <header><strong>{tr(node.label)} · {tr.number(credit.xp)} {tr(' XP')}</strong><time dateTime={new Date(record.at_secs * 1000).toISOString()}>{tr.date(record.at_secs * 1000)}</time></header>
        {!skill && <p>{tr('Criterion: ')}{tr(node.criterion)}</p>}
        {!skill && <SkillGuide snapshot={snapshot} skillId={node.id} active={record.variety ?? undefined} />}
        <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}>
          <blockquote dir="auto"><TargetPhrase text={record.source} /></blockquote>
          {judgment.quotes.length > 0 && <p dir="auto"><TargetPhrase text={[...new Set(judgment.quotes)].join(' · ')} /></p>}
        </ReadingLanguageScope>
        <p>{tr(judgment.evidence_kind === 'quoted' ? 'Supporting text' : 'Whole message')}</p>
        {record.attribution_error && <ErrorNotice onRetry={() => retryMessageWork(record.chat_id, record.message_id)} error={record.attribution_error}>{record.attribution_error}</ErrorNotice>}
        {judgment.rationale && <p>{judgment.rationale}</p>}
        <details><summary>{tr('Evidence details')}</summary>
          {record.decision_policy?.minimumPositiveProbability !== undefined && <p>{tr('Positive evidence threshold')}: {record.decision_policy.minimumPositiveProbability}</p>}
          <p>{tr('Model: ')}{record.model} {tr(' · Rubric ')}{record.catalog_version} {tr(' · Prompt ')}{record.prompt_version}<br />{tr('Chat ')}{record.chat_id} {tr(' · Message ')}{record.message_id} {tr(' · Attempt ')}{record.attempt_id}</p>
          {credit.event && <dl className="reward-provenance">
            <div><dt>{tr('Support')}</dt><dd>{credit.event.support}</dd></div>
            <div><dt>{tr('Difficulty')}</dt><dd>{credit.event.difficulty}</dd></div>
            <div><dt>{tr('Novelty')}</dt><dd>{credit.event.novelty}</dd></div>
            <div><dt>{tr('Policy')}</dt><dd>{credit.event.policyHash}</dd></div>
          </dl>}
        </details>
      </article>)}
    </section>
  </DetailDialog>
}
