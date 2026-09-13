// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ChatMessage, ConversationSnapshot } from '../../contracts'
import { EarlierVersions } from './EarlierVersions'
import { conversationTurns } from '../../domain/language/conversation-view'
const read = vi.hoisted(() => vi.fn())
vi.mock('../../platform/ipc/workspace', () => ({ watchConversation: read, nativeError: (error: Error) => error.message }))
function message(sequence: number, turnId: string, role: string, text: string, replacesTurnId: string | null, replacedBy: string | null): ChatMessage {
  return { sequence, turnId, role, text, replacesTurnId, replacedBy, id: `message-${sequence}`, createdAt: '', wordGloss: null, glossState: null, glossError: null, glossOperationId: null, translationState: null, translation: null }
}
it('loads one bounded page and joins a predecessor split across the page boundary', async () => {
  const snapshot = { conversationId: 'chat', revision: 9, hasOlder: true, messages: [
    message(2, 'first', 'assistant', 'Earlier partner reply', null, 'second'),
    message(3, 'second', 'user', 'Revised wording', 'first', null),
  ] } as ConversationSnapshot
  read.mockResolvedValue({ ...snapshot, hasOlder: false, messages: [message(1, 'first', 'user', 'Exact earlier wording', null, 'second')] })
  render(<EarlierVersions snapshot={snapshot} turn={conversationTurns(snapshot)[1]} />)
  fireEvent.click(screen.getByText('Earlier version'))
  expect(screen.getByText('Earlier partner reply')).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Load earlier versions' })))
  expect(read).toHaveBeenCalledWith('chat', -1, 2)
  expect(screen.getByText('Exact earlier wording')).toBeVisible()
  expect(screen.getAllByText('Earlier partner reply')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Load earlier versions' })).toBeNull()
})
