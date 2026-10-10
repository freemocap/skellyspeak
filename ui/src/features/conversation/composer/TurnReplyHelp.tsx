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
  if (!message) throw new Error('Reply help source is unavailable.')
  const state = helpKind === 'brief' ? message.briefState : helpKind === 'grammar' ? message.explanationsState : message.suggestionsState
  if (state && (!retry || !['failed', 'unknown'].includes(state))) return
  const workspace = await readWorkspace()
  if (helpKind === 'brief') {
    await executeAction(workspace, { kind: 'requestMessageHelp', messageId, help: 'reply_brief', retry })
  } else {
    await executeAction(workspace, retry
      ? { kind: 'retryReplyHelp', messageId, helpKind }
      : { kind: helpKind === 'grammar' ? 'requestExplanations' : 'requestSuggestions', messageId })
  }
}

export function TurnReplyHelp({ turn, conversationId, busy, onAsk, onUse, inline = false }: {
  inline?: boolean; turn?: StoredTurn; conversationId?: string; busy: boolean; onAsk?: (question: string) => void
  onUse: (text: string, source: 'suggestion' | 'scaffold') => void
}) {
  const a = turn?.assistant, help = a?.help
  if (!a?.messageId || !help || !conversationId) return null
  const eligible = !turn?.replacedBy && !turn?.execution?.replacedBy && !['cancelled','invalidated'].includes(turn?.execution?.state ?? '')
  const request = (kind: ReplyHelpKind, retry = false) => requestReplyHelp(conversationId, a.messageId!, kind, retry)
  return <MessageReadingScope scope={help.scope}><ReplyHelp inline={inline} key={a.messageId}
    brief={help.brief?.explanation} briefPending={['ready','running','waiting_dependencies'].includes(help.lanes.brief.state ?? '')}
    grammar={help.grammar?.cards} replies={help.assistance?.replies}
    starters={help.assistance ? [...help.assistance.frames, ...help.assistance.starters] : undefined}
    lanes={help.lanes} onExplainGrammar={eligible ? () => request('grammar') : undefined}
    onRequestBrief={eligible ? () => request('brief') : undefined}
    onSuggestReply={eligible ? () => request('replies') : undefined} onRetry={eligible ? kind => request(kind, true) : undefined}
    onInspect={() => useNavigationStore.getState().inspectAi({conversationId, turnId:turn!.turnId!, operationKind:null})}
    onAsk={onAsk ? question => onAsk(`${question}\nPartner message: ${a.reply}`) : undefined}
    busy={busy} errors={[]} onUse={onUse} /></MessageReadingScope>
}
