import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
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

export function GuideActions({ guide, example, subskill, menu = false, children }: { guide: GuideReference; example?: number; subskill?: string; menu?: boolean; children?: (actions: ReactNode) => ReactNode }) {
  const run = useContext(GuideActionContext)
  const tr = useI18n()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  if (!run) return children?.(null) ?? null
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
  const actions = <>
    <button type="button" className={menu ? "message-tools-item" : "detail-action"} disabled={busy} onClick={() => void execute()}>{tr(subskill ? 'Start conversation' : example === undefined ? 'Ask coach' : 'Start with this sentence')}</button>
    {(subskill || example !== undefined) && <button type="button" className={menu ? "message-tools-item" : "detail-action"} disabled={busy} onClick={() => void execute(true)}>{tr(example === undefined ? 'Ask coach' : 'Explain this sentence')}</button>}
    {error != null && <ErrorNotice error={error}>{nativeError(error)}</ErrorNotice>}
  </>
  return children ? children(actions) : actions
}
