import type { ReactNode } from 'react'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useI18n } from '../../components/localization/i18n'

/** One line of help that draws the Add to Practice icon where the sentence
 * names it, so the words point at the control itself. The message's `{value0}`
 * is where each language puts the icon; `lead` is an optional mark before the
 * line, such as a tip's bulb. */
export function AddToPracticeHint({ message, lead }: { message: string; lead?: ReactNode }) {
  const tr = useI18n()
  const icon = <span className="drill-hint-icon" role="img" aria-label={tr("Add to Practice")}><ToolbarIcon name="deck-add" size={14} /></span>
  return <p className="drill-hint">{lead}<span>{tr.rich(message, { value0: icon })}</span></p>
}
