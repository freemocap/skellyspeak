import { beforeEach, expect, it, vi } from 'vitest'
import { requestReplyHelp } from './TurnReplyHelp'
const backend = vi.hoisted(() => ({ executeAction: vi.fn(), readWorkspace: vi.fn(), watchConversation: vi.fn() }))
vi.mock('../../../platform/ipc/workspace', () => backend)
function snapshot(state?: string) {
  return {messages:[{id:'m',turnId:'t'}],turns:[{id:'t',operations:state ? [{id:'op',replyHelpKind:'grammar',kind:'native-owned',state}] : []}]}
}
beforeEach(() => {
  vi.clearAllMocks()
  backend.readWorkspace.mockResolvedValue({sessionId:'session'})
  backend.watchConversation.mockResolvedValue(snapshot())
  backend.executeAction.mockResolvedValue({entityId:'op'})
})
it('reconciles the source before explicitly enqueueing absent grammar', async () => {
  await requestReplyHelp('c','m','grammar')
  expect(backend.watchConversation).toHaveBeenCalledWith('c')
  expect(backend.executeAction).toHaveBeenCalledExactlyOnceWith({sessionId:'session'},{kind:'requestExplanations',messageId:'m'})
})
it.each(['ready','running','held','succeeded','failed','unknown'])('opening a %s operation never resubmits it', async state => {
  backend.watchConversation.mockResolvedValue(snapshot(state))
  await requestReplyHelp('c','m','grammar')
  expect(backend.executeAction).not.toHaveBeenCalled()
})
it('explicit retry uses the scoped action and reconciles an already running retry', async () => {
  backend.watchConversation.mockResolvedValue(snapshot('failed'))
  await requestReplyHelp('c','m','grammar',true)
  expect(backend.executeAction).toHaveBeenCalledExactlyOnceWith({sessionId:'session'},{kind:'retryReplyHelp',messageId:'m',helpKind:'grammar'})
  backend.watchConversation.mockResolvedValue(snapshot('running'))
  await requestReplyHelp('c','m','grammar',true)
  expect(backend.executeAction).toHaveBeenCalledOnce()
})
