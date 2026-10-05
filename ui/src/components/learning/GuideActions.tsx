import { createContext, useContext, useRef, useState } from 'react'
import type { Action, GuideReference } from '../../generated/contracts'
import { useI18n } from '../localization/i18n'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { nativeError } from '../../platform/ipc/workspace'

export type GuideAction =
  | { kind: 'skill'; guide: GuideReference; subskillId: string }
  | { kind: 'coach'; guide: GuideReference; text: string; focus?: Extract<Action, { kind: 'askGuideCoach' }>['focus'] }
  | { kind: 'example'; guide: GuideReference; example: number; phrase?: string }
export type RunGuideAction = (action: GuideAction) => Promise<void>
// Application composition supplies navigation and the selected conversation.
export const GuideActionContext = createContext<RunGuideAction | null>(null)

export function GuideActions({ guide, example, subskill }: { guide: GuideReference; example?: number; subskill?: string }) {
  const run = useContext(GuideActionContext)
  const tr = useI18n()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (!run) return null
  async function execute(coach = false) {
    if (!run || locked.current) return
    locked.current = true; setBusy(true); setError(null)
    let action: GuideAction
    if (coach && (subskill || example !== undefined)) {
      action = { kind: 'coach', guide, text: tr('Explain this selection.'),
        focus: subskill ? { kind: 'subskill', subskillId: subskill } : { kind: 'example', index: example! } }
    } else if (subskill) {
      action = { kind: 'skill', guide, subskillId: subskill }
    } else if (example !== undefined) {
      action = { kind: 'example', guide, example }
    } else {
      action = { kind: 'coach', guide, text: tr('Explain this skill.') }
    }
    try { await run(action) }
    catch (error) { setError(error) }
    finally { locked.current = false; setBusy(false) }
  }
  return <>
    <button type="button" className="detail-action" disabled={busy} onClick={() => void execute()}>{tr(subskill ? 'Use this in a conversation' : example === undefined ? 'Ask the coach' : 'Start a conversation from this phrase')}</button>
    {(subskill || example !== undefined) && <button type="button" className="detail-action" disabled={busy} onClick={() => void execute(true)}>{tr('Ask the coach')}</button>}
    {error != null && <ErrorNotice error={error}>{nativeError(error)}</ErrorNotice>}
  </>
}
