import { useI18n } from '../../../components/localization/i18n'
export function ProgressRules() {
  const tr = useI18n()
  return <details className="practice-rules"><summary>{tr("How XP works")}</summary>
    <p>{tr("Skill XP comes from evidence in your messages.")}</p>
    <p>{tr("A skill first used in a message earns 1 experience XP. A changed retry earns 1 effort XP for each previously used skill still present; a newly introduced skill earns experience instead. Unchanged retries add nothing. Correctness and assistance do not change these amounts.")}</p>
    <p>{tr("Each credited message is a skill point for each skill it shows. A skill levels up at 1, 2, 3, 5, 8, 13… points, and your language's skill level is your weakest skill's level. Each bar shows progress toward that skill's next level.")}</p>
    <p>{tr("Only current saved evidence and current criteria count. Editing, deleting or excluding assessments can reduce totals. Previous criteria remain in history. Your language total includes other conversations. Text transcripts do not establish pronunciation, listening or retention.")}</p>
  </details>
}
