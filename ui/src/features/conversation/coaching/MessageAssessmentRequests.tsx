import { useEffect, useRef } from 'react'
import type { TurnView } from '../../../generated/contracts'
import { requestMessageHelp } from '../../../platform/ipc/message-help'
import { useI18n } from '../../../components/localization/i18n'
import { useHelpRequest, HelpStatus } from '../composer/HelpRequest'

/** Mounted only inside the learner's open feedback card. */
export function MessageAssessmentRequests({ messageId, execution, assessed, coached }: {
  messageId: string; execution?: TurnView; assessed: boolean; coached: boolean
}) {
  const tr = useI18n()
  return <>
    <Request messageId={messageId} execution={execution} kind="skill_assessment" help="assessment" saved={assessed} label={tr('Message assessment')} />
    <Request messageId={messageId} execution={execution} kind="coach_feedback" help="coaching" saved={coached} label={tr('Coaching feedback')} />
  </>
}

function Request({ messageId, execution, kind, help, saved, label }: {
  messageId: string; execution?: TurnView; kind: string; help: 'assessment' | 'coaching'; saved: boolean; label: string
}) {
  const tr = useI18n()
  const operation = execution?.operations.find(item => item.kind === kind)
  const attempt = execution?.attempts.filter(item => item.operationId === operation?.id).at(-1)
  const state = operation?.state ?? (saved ? 'succeeded' : null)
  const lane = { state, revision: `${operation?.id}:${state}:${attempt?.id}:${attempt?.state}`,
    error: ['failed', 'unknown'].includes(state ?? '') ? attempt?.error : undefined, details: { operation, attempt } }
  const request = useHelpRequest(lane)
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (state === null) request.submit(() => requestMessageHelp(messageId, help))
  }, [messageId, help, state, request])
  if (saved && state === 'succeeded') return null
  return <section aria-label={label}>
    <strong>{label}</strong>
    {state === null && !request.pending && !request.failure && <p>{tr('Not assessed')}</p>}
    <HelpStatus lane={lane} pending={request.pending} failure={request.failure} label={tr('Analyzing…')} subject={label}
      onRetry={() => request.submit(() => requestMessageHelp(messageId, help, ['failed', 'unknown'].includes(state ?? '')))} />
  </section>
}
