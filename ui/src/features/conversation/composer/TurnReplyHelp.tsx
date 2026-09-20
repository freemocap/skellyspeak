import type { StoredTurn } from '../../../types'
import type { ReplyHelpKind } from '../../../generated/contracts'
import { executeAction, readWorkspace, watchConversation } from '../../../platform/ipc/workspace'
import { useNavigationStore } from '../../../state/navigation/navigation'
import { MessageReadingScope } from '../reading/MessageReadingScope'
import { ReplyHelp } from './ReplyHelp'

export async function requestReplyHelp(conversationId: string, messageId: string, helpKind: ReplyHelpKind, retry = false) {
  // Reconcile command uncertainty/another window before choosing a new request.
  const snapshot = await watchConversation(conversationId)
  const message = snapshot.messages.find(item => item.id === messageId)
  const turn = snapshot.turns.find(item => item.id === message?.turnId)
  const operation = turn?.operations.find(item => item.replyHelpKind === helpKind)
  if (operation && (!retry || !['failed', 'unknown'].includes(operation.state))) return
  const workspace = await readWorkspace()
  await executeAction(workspace, operation || helpKind === 'brief'
    ? {kind:'retryReplyHelp', messageId, helpKind}
    : {kind:helpKind === 'grammar' ? 'requestExplanations' : 'requestSuggestions', messageId})
}

export function TurnReplyHelp({ turn, conversationId, busy, onAsk, onUse }: {
  turn?: StoredTurn; conversationId?: string; busy: boolean; onAsk?: (question: string) => void
  onUse: (text: string, source: 'suggestion' | 'scaffold') => void
}) {
  const a = turn?.assistant, help = a?.help
  if (!a?.messageId || !help || !conversationId) return null
  const eligible = !turn?.replacedBy && !turn?.execution?.replacedBy && !['cancelled','invalidated'].includes(turn?.execution?.state ?? '')
  const request = (kind: ReplyHelpKind, retry = false) => requestReplyHelp(conversationId, a.messageId!, kind, retry)
  return <MessageReadingScope scope={help.scope}><ReplyHelp key={a.messageId}
    brief={help.brief?.explanation} briefPending={['ready','running','waiting_dependencies'].includes(help.lanes.brief.state ?? '')}
    grammar={help.grammar?.cards} replies={help.assistance?.replies}
    starters={help.assistance ? [...help.assistance.frames, ...help.assistance.starters] : undefined}
    lanes={help.lanes} onExplainGrammar={eligible ? () => request('grammar') : undefined}
    onSuggestReply={eligible ? () => request('replies') : undefined} onRetry={eligible ? kind => request(kind, true) : undefined}
    onInspect={() => useNavigationStore.getState().inspectAi({conversationId, turnId:turn!.turnId!, operationKind:null})}
    onAsk={onAsk ? question => onAsk(`${question}\nPartner message: ${a.reply}`) : undefined}
    busy={busy} errors={[]} onUse={onUse} /></MessageReadingScope>
}
