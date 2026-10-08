import { useEffect, useRef, type ReactNode } from 'react'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { useI18n } from '../../../components/localization/i18n'
import { cutOff, useFitStage } from '../../../components/layout/useFitStage'

/// Where the difficulty select is shown: beside the partner, or leading the
/// conversation settings sheet while the header has no room for it.
export type DifficultyPlace = 'header' | 'settings'

/// The header's layouts, fullest first. The counters give up their shape and
/// unit before the difficulty select leaves the row; once it has left, the
/// counters take their full form again if that fits. The partner's name
/// shortens only when nothing else is left to give.
const LAYOUTS = ['full', 'compact-counters', 'difficulty-in-settings', 'difficulty-in-settings compact-counters'] as const

/// A layout fits when the partner's whole name shows and nothing runs past the row.
function overflows(head: HTMLElement) {
  return cutOff(head) || cutOff(head.querySelector('.conversation-identity')) || cutOff(head.querySelector('.partner-identity strong'))
}

/** Partner identity leads; the conversation list opens from the start of the
 * header, with difficulty beside the partner and secondary settings in the
 * panel. The header is one row at every width: it measures its own room (which
 * the coach panel changes as much as the window does) and picks the fullest
 * layout that fits, telling its owner when difficulty has to move to the
 * settings sheet. */
export function ConversationHeader({ leading, persona, difficulty, error, onDifficultyPlace, children }: {
  leading?: ReactNode; persona: ReactNode; difficulty?: ReactNode; error: string | null
  onDifficultyPlace?: (place: DifficultyPlace) => void
  children: ReactNode
}) {
  const tr = useI18n()
  const head = useRef<HTMLDivElement>(null)
  const layout = useFitStage(head, LAYOUTS, overflows)
  const place: DifficultyPlace = layout.includes('difficulty-in-settings') ? 'settings' : 'header'
  const report = useRef(onDifficultyPlace)
  report.current = onDifficultyPlace
  useEffect(() => { report.current?.(place) }, [place])
  return <div ref={head} className="chat-head">
    {leading}
    <div className="conversation-title">
      <div className="conversation-identity">{persona}{difficulty}</div>
      {error && <ErrorDetails label={tr("Conversation settings")} errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
