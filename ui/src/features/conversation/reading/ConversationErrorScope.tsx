import type { ReactNode } from 'react'
import type { TurnView } from '../../../generated/contracts'
import { ErrorInspectionContext } from '../../../components/feedback/ErrorDetails'
import { useNavigationStore } from '../../../state/navigation/navigation'

export function errorOperation(turn: TurnView, error: string) {
  const attempt = [...turn.attempts].reverse().find(item => item.error && error.includes(item.error))
  const failed = turn.operations.filter(item => ['failed', 'unknown'].includes(item.state))
  return turn.operations.find(item => item.id === attempt?.operationId || error.includes(item.id))
    ?? (failed.length === 1 ? failed[0] : undefined)
}

/** Keep error inspection tied to the recorded exchange, including older messages. */
export function ConversationErrorScope({ conversationId, turn, onInspect, children }: {
  conversationId?: string; turn?: TurnView; onInspect?: () => void; children: ReactNode
}) {
  return <ErrorInspectionContext value={conversationId && turn ? error => {
    onInspect?.()
    useNavigationStore.getState().inspectAi({ conversationId, turnId: turn.id, operationKind: errorOperation(turn, error)?.kind ?? null })
  } : null}>{children}</ErrorInspectionContext>
}
