import { useI18n } from '../../../components/localization/i18n'
export function ProgressRules() {
  const tr = useI18n()
  return <details className="practice-rules"><summary>{tr("How XP works")}</summary>
    <p>{tr("Skill XP comes from evidence in your messages.")}</p>
    <p>{tr("A skill first used in a message earns 1 experience XP. A changed retry earns 1 effort XP for each previously used skill still present; a newly introduced skill earns experience instead. Unchanged retries add nothing. Correctness and assistance do not change these amounts.")}</p>
    <p>{tr("Every 50 XP reaches another milestone. Each bar shows progress toward the next milestone; total XP keeps growing.")}</p>
    <p>{tr("Only current saved evidence and current criteria count. Editing, deleting or excluding attempts can reduce totals. Previous criteria remain in history. Your language total includes other conversations. Text transcripts do not establish pronunciation, listening or retention.")}</p>
  </details>
}
