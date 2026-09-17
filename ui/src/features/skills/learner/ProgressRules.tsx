import { useI18n } from '../../../components/localization/i18n'
export function ProgressRules() {
  const tr = useI18n()
  return <details className="practice-rules"><summary>{tr("How XP works")}</summary>
    <p>{tr("Skill XP comes from evidence in your messages.")}</p>
    <p>{tr("Distinct successful wording earns 10 XP per skill without recorded in-app assistance, or 2 XP with suggestions, scaffolds or revision. External assistance is unknown. Repeated wording counts once per skill; an unassisted attempt replaces assisted credit.")}</p>
    <p>{tr("Every 50 XP reaches another milestone. Each bar shows progress toward the next milestone; total XP keeps growing.")}</p>
    <p>{tr("Only current saved evidence and current criteria count. Editing, deleting or excluding attempts can reduce totals. Previous criteria remain in history. Your language total includes other conversations. Text transcripts do not establish pronunciation, listening or retention.")}</p>
  </details>
}
