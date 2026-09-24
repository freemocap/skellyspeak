import { useI18n } from '../../../components/localization/i18n'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { milestoneProgress, XP_MILESTONE } from './xp-progress'

/** Progress toward the skill's next milestone; the latest gain is drawn at full strength. */
export function XpMeter({ snapshot, skillId, label, gain, color }: { snapshot: SkillSnapshot; skillId: string; label: string; gain: number; color: string }) {
  const tr = useI18n()
  const progress = milestoneProgress(snapshot, skillId, gain)
  const valueText = tr('{value0} XP; next milestone {value1}', { value0: progress.total, value1: progress.next })
  return <div className="xp-meter">
    <div className="xp-meter-track" role="progressbar" aria-label={tr('{value0} practice XP', { value0: tr(label) })} aria-valuemin={0} aria-valuemax={XP_MILESTONE} aria-valuenow={progress.inCycle} aria-valuetext={valueText} style={{ color }}>
      <span className="xp-meter-earlier" style={{ width: `${progress.earlier / XP_MILESTONE * 100}%` }} />
      <span className="xp-meter-added" style={{ width: `${progress.added / XP_MILESTONE * 100}%` }} />
    </div>
    <span className="xp-meter-caption">{valueText}</span>
  </div>
}
