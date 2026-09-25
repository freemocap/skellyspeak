import { executeAction, readWorkspace, watchConversation } from './workspace'

export async function retryTurn(turnId: string) {
  await executeAction(await readWorkspace(), {kind:'controlTurn', turnId, control:'retry'})
}

/** Evidence views hold message sequence numbers, not execution identifiers. */
export async function retryMessageWork(conversationId: string, sequence: number) {
  const snapshot = await watchConversation(conversationId)
  const message = snapshot.messages.find(item => item.sequence === sequence && item.role === 'user')
  if (!message?.turnId) throw new Error('The source turn is unavailable.')
  await retryTurn(message.turnId)
}
