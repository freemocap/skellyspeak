import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'

/** "+ biceps": this take earned a practice effort unit. */
export function PracticeCredit({ size = 13 }: { size?: number }) {
  const tr = useI18n()
  return <span className="take-credit" role="img" aria-label={tr('Counted as practice')} title={tr('Counted as practice')}>+<ToolbarIcon name="practice" size={size} /></span>
}
