import { useI18n } from '../../components/localization/i18n'
import type { DrillComparison } from '../../generated/contracts'

/// The measured match as a percentage, or a statement that it could not be
/// measured — never a made-up number.
export function match(comparison: DrillComparison, tr: ReturnType<typeof useI18n>) {
  if (comparison.reliability?.accepted === false) return tr("Not scored")
  return comparison.matchRatio === null
    ? tr("Not measurable")
    : tr("{value0}%", { value0: String(Math.round(comparison.matchRatio * 100)) })
}

/// Only what the comparison established mechanically: an exact transcript, and
/// the advisory script note native already computed.
export function facts(comparison: DrillComparison, tr: ReturnType<typeof useI18n>) {
  const chips: { label: string; tone: string }[] = []
  const reliability = comparison.reliability
  if (reliability) {
    chips.push({ label: reliability.confidence === null ? tr("Confidence unavailable")
      : tr("Recognition confidence: {value0}", { value0: tr.number(reliability.confidence, { style: 'percent', maximumFractionDigits: 0 }) }),
      tone: reliability.confidence === null ? 'neutral' : reliability.confidence >= reliability.minimumConfidence ? 'success' : 'danger' })
    if (!reliability.accepted) chips.push({ label: reliability.reason === 'no_speech'
      ? tr("No speech detected — not scored") : reliability.reason === 'low_confidence'
        ? tr("Low confidence — not scored") : tr("Confidence unavailable — not scored"), tone: reliability.reason === 'confidence_unavailable' ? 'neutral' : 'danger' })
  }
  if (Number(comparison.edits) === 0 && comparison.matchRatio !== null) chips.push({ label: tr("Exact"), tone: 'success' })
  if (comparison.scriptNote === 'mismatch') chips.push({ label: tr("Different script"), tone: 'warning' })
  return chips
}
