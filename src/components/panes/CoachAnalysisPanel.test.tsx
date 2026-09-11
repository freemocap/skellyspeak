// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CoachAnalysisPanel } from './CoachAnalysisPanel'
import type { ConversationSnapshot, Snapshot } from '../../contracts'

const backend = vi.hoisted(() => ({ read: vi.fn(), execute: vi.fn(), watch: vi.fn() }))
vi.mock('../../lib/tauri', () => ({ isTauri: true }))
vi.mock('../../lib/workspace', () => ({ readWorkspace: backend.read, executeAction: backend.execute, watchConversation: backend.watch, nativeError: (error: unknown) => String(error) }))
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))
vi.mock('../chat/ConversationMap', () => ({ ConversationMap: () => null }))
const snapshot = { conversationId: 'chat-1', sessionId: 'session', revision: 7, coachMessages: [], turns: [] } as unknown as ConversationSnapshot
function panel(chatId = 'chat-1', draftQuestion = '') {
  return <CoachAnalysisPanel level="zero" topic="" chatId={chatId} prepareContext={vi.fn()} conversationBusy={false} plan={null} profile={null} observationStatus="" tab="lesson" onTab={vi.fn()} draftQuestion={draftQuestion} onDraftConsumed={vi.fn()} pinnedTurn={null} inspect={null} nativeLanguageName="English" showRomanization={false} rtl={false} />
}
beforeEach(() => {
  vi.resetAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  backend.watch.mockResolvedValueOnce(snapshot).mockImplementation(() => new Promise(() => {}))
  backend.read.mockResolvedValue({ sessionId: 'session', conversations: [{ id: 'chat-1', archived: false, revision: 19 }] } as unknown as Snapshot)
  backend.execute.mockResolvedValue({ revision: 20 })
})
describe('native private coaching', () => {
  it('observes saved messages without requesting AI and exposes unavailable lesson controls', async () => {
    backend.watch.mockReset().mockResolvedValueOnce({ ...snapshot, coachMessages: [{ id: 'm', role: 'assistant', text: 'Saved private answer' }] }).mockImplementation(() => new Promise(() => {}))
    render(panel())
    await waitFor(() => expect(screen.getByLabelText('Coach conversation')).toHaveTextContent('Saved private answer'))
    expect(backend.watch).toHaveBeenNthCalledWith(2, 'chat-1', 7)
    expect(backend.execute).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Edit choices' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear coach thread' })).toBeDisabled()
  })
  it('submits once with current conversation revision and displays only saved replies', async () => {
    render(panel())
    await waitFor(() => expect(backend.watch).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText('Message your coach'), { target: { value: 'Explain this' } })
    fireEvent.submit(screen.getByLabelText('Message your coach').closest('form')!)
    fireEvent.submit(screen.getByLabelText('Message your coach').closest('form')!)
    await waitFor(() => expect(backend.execute).toHaveBeenCalledTimes(1))
    expect(backend.execute).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session' }), { kind: 'askCoach', conversationId: 'chat-1', text: 'Explain this', expectedRevision: 19 })
    await waitFor(() => expect(screen.getByLabelText('Message your coach')).toHaveValue(''))
    expect(screen.queryByText('Explain this')).toBeNull()
  })
  it('retains input after rejection without an automatic retry', async () => {
    backend.execute.mockRejectedValue(new Error('Admission held'))
    render(panel())
    await waitFor(() => expect(backend.watch).toHaveBeenCalledTimes(2))
    fireEvent.change(screen.getByLabelText('Message your coach'), { target: { value: 'My question' } })
    fireEvent.click(screen.getByLabelText('Send to coach'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Admission held')
    expect(screen.getByLabelText('Message your coach')).toHaveValue('My question')
    expect(backend.execute).toHaveBeenCalledTimes(1)
  })
  it('does not publish an old watch result after changing conversations', async () => {
    let resolveOld!: (value: ConversationSnapshot) => void
    backend.watch.mockReset().mockImplementationOnce(() => new Promise<ConversationSnapshot>(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ ...snapshot, conversationId: 'chat-2' }).mockImplementation(() => new Promise(() => {}))
    const view = render(panel())
    view.rerender(panel('chat-2'))
    resolveOld({ ...snapshot, coachMessages: [{ id: 'old', role: 'assistant', text: 'Old private answer' }] } as ConversationSnapshot)
    await waitFor(() => expect(backend.watch).toHaveBeenCalledWith('chat-2', 7))
    expect(screen.queryByText('Old private answer')).toBeNull()
  })
  it('opens a supplied draft without dispatching or losing it when the dialog closes', async () => {
    render(panel('chat-1', 'Explain this phrase'))
    expect(await screen.findByRole('dialog', { name: 'Coach conversation' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Close Coach conversation' }))
    expect(screen.getByLabelText('Message your coach')).toHaveValue('Explain this phrase')
    expect(backend.execute).not.toHaveBeenCalled()
  })
})
