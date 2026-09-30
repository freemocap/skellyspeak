import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useI18n } from '../../../components/localization/i18n'

/// How many fixes the learner sent for a message: a hammer and the count, in
/// the line under the bubble between Fix it and the message's XP. It counts up
/// with every revision, rather than marking a message as fixed once.
export function FixCount({ count }: { count: number }) {
  const tr = useI18n()
  const label = tr('Fix count', { count })
  return <span className="feedback-fixes" title={label}>
    <ToolbarIcon name="fixes" size={13} />
    <span aria-hidden="true">{tr.number(count)}</span>
    <span className="sr-only">{label}</span>
  </span>
}
