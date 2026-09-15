import { useI18n } from '../../../components/localization/i18n'
export function ProgressRules() {
  const tr = useI18n()
  return <details className="practice-rules"><summary>{tr("How XP works")}</summary>
    <p>{tr("Distinct successful wording earns 10 XP per skill without recorded in-app assistance, or 2 XP with suggestions, scaffolds or revision. External assistance is unknown. Repeated wording counts once per skill; an unassisted attempt replaces assisted credit.")}</p>
    <p>{tr("Three unassisted successes earn a star. Map arms and branch bars fill with credited XP, including assisted practice, up to 30 XP per skill. XP totals continue growing after a bar fills. Stars are separate milestones, not proficiency grades.")}</p>
    <p>{tr("Only current saved evidence and current criteria count. Editing, deleting or excluding attempts can reduce totals. Previous criteria remain in history. Your language total includes other conversations. Text transcripts do not establish pronunciation, listening or retention.")}</p>
  </details>
}
